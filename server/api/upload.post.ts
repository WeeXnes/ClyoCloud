import { createWriteStream, createReadStream } from 'fs'
import { mkdir } from 'fs/promises'
import { defineEventHandler, createError } from 'h3'
import { IncomingForm, Fields, Files } from 'formidable'
import path, { join, resolve } from 'path'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const storagePath = config.storagePath
    const maxFileSize = config.maxFileSize || 500 * 1024 * 1024 // Default to 500MB

    try {
        // Initialize formidable with max file size
        const form = new IncomingForm({
            maxFileSize: maxFileSize,
            multiples: false, // Single file upload
            keepExtensions: true
        })

        const { fields, files } = await new Promise<{ fields: Fields; files: Files }>((resolve, reject) => {
            form.parse(event.node.req, (err: Error | null, fields: Fields, files: Files) => {
                if (err) {
                    console.error('Formidable parsing error:', err)
                    return reject(err)
                }
                resolve({ fields, files })
            })
        })

        // Extract path and file
        const folderPath = Array.isArray(fields.path) ? fields.path[0] : fields.path || ''
        const fileData = files.file && Array.isArray(files.file) ? files.file[0] : files.file

        if (!fileData || !fileData.originalFilename) {
            console.error('File field missing or no filename provided')
            throw createError({
                statusCode: 400,
                statusMessage: 'File is required'
            })
        }

        const decodedPath = decodeURIComponent(folderPath)
        const decodedFilename = decodeURIComponent(fileData.originalFilename)
        const resolvedDir = resolve(join(storagePath, decodedPath))
        const resolvedPath = resolve(join(resolvedDir, decodedFilename))

        // Security check to prevent directory traversal
        if (!resolvedDir.startsWith(resolve(storagePath))) {
            console.error(`Access denied: Resolved path ${resolvedDir} is outside storage directory ${storagePath}`)
            throw createError({
                statusCode: 403,
                statusMessage: 'Access denied: Path outside storage directory'
            })
        }

        // Create directory if it doesn't exist
        console.log(`Creating directory if needed: ${resolvedDir}`)
        await mkdir(resolvedDir, { recursive: true })

        // Save the file
        console.log(`Saving file to: ${resolvedPath}`)
        const writeStream = createWriteStream(resolvedPath)
        await new Promise((resolve: any, reject) => {
            const readStream = createReadStream(fileData.filepath) // Use fs.createReadStream with fileData.filepath
            readStream.pipe(writeStream)
            writeStream.on('finish', resolve)
            writeStream.on('error', reject)
            readStream.on('error', reject)
        })

        return { message: 'File uploaded successfully' }
    } catch (error: any) {
        console.error('Error uploading file:', error)
        throw createError({
            statusCode: error.statusCode || (error.code === 'ERR_FORM_TOO_LARGE' ? 413 : 500),
            statusMessage: error.statusMessage || error.message || `File too large. Maximum allowed size is ${maxFileSize / 1024 / 1024} MB`
        })
    }
})