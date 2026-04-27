import { createWriteStream, createReadStream } from 'fs'
import { mkdir } from 'fs/promises'
import { defineEventHandler, createError } from 'h3'
import { IncomingForm, Fields, Files } from 'formidable'
import path, { join, resolve } from 'path'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const userStoragePath = path.join(config.storagePath, event.context.user.name)
    const maxFileSize = config.maxFileSize || 500 * 1024 * 1024 // Default to 500MB

    try {
        const form = new IncomingForm({
            maxFileSize,
            multiples: true,
            keepExtensions: true,
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

        const folderPath = Array.isArray(fields.path) ? fields.path[0] : fields.path || ''
        const uploadedFiles = Array.isArray(files.files) ? files.files : files.files ? [files.files] : []

        if (uploadedFiles.length === 0) {
            console.error('Files field missing or empty')
            throw createError({
                statusCode: 400,
                statusMessage: 'At least one file is required',
            })
        }

        const decodedPath = decodeURIComponent(folderPath)
        const resolvedDir = resolve(join(userStoragePath, decodedPath))

        // Security check
        if (!resolvedDir.startsWith(resolve(userStoragePath))) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Access denied: Path outside user directory',
            })
        }

        await mkdir(resolvedDir, { recursive: true })

        for (const fileData of uploadedFiles) {
            const decodedFilename = decodeURIComponent(fileData.originalFilename || 'unnamed_file')
            
            // Security: Prevent uploading .cloudinfo or hidden files
            if (decodedFilename.endsWith('.cloudinfo') || decodedFilename.startsWith('.')) {
                console.warn(`[SECURITY] Blocked upload attempt of sensitive file: ${decodedFilename}`)
                continue // Skip this file
            }

            const resolvedPath = resolve(join(resolvedDir, decodedFilename))

            console.log(`Saving file to: ${resolvedPath}`)
            const writeStream = createWriteStream(resolvedPath)
            await new Promise((resolve: any, reject) => {
                const readStream = createReadStream(fileData.filepath)
                readStream.pipe(writeStream)
                writeStream.on('finish', resolve)
                writeStream.on('error', reject)
                readStream.on('error', reject)
            })

            const relativePath = path.relative(userStoragePath, resolvedPath)
            await logActivity(event.context.user.name, 'UPLOAD', relativePath)
        }

        return { message: 'Files uploaded successfully' }
    } catch (error: any) {
        console.error('Error uploading file:', error)
        throw createError({
            statusCode: error.statusCode || (error.code === 'ERR_FORM_TOO_LARGE' ? 413 : 500),
            statusMessage: error.statusMessage || error.message || `File too large. Maximum allowed size is ${maxFileSize / 1024 / 1024} MB`,
        })
    }
})