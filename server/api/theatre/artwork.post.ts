import { createWriteStream, createReadStream } from 'fs'
import fs from 'fs/promises'
import { defineEventHandler, createError } from 'h3'
import { IncomingForm, Fields, Files } from 'formidable'
import path from 'path'
import { isPathWithin } from '~/server/utils/fileUtils'

export default defineEventHandler(async (event) => {
    // Only authenticated users can upload artwork
    if (!event.context.user || !event.context.user.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const config = useRuntimeConfig()
    const maxFileSize = 20 * 1024 * 1024 // 20MB limit for artwork images

    try {
        const form = new IncomingForm({
            maxFileSize,
            multiples: false,
            keepExtensions: true,
        })

        const { fields, files } = await new Promise<{ fields: Fields; files: Files }>((resolve, reject) => {
            form.parse(event.node.req, (err: Error | null, fields: Fields, files: Files) => {
                if (err) {
                    console.error('Formidable artwork parsing error:', err)
                    return reject(err)
                }
                resolve({ fields, files })
            })
        })

        const type = Array.isArray(fields.type) ? fields.type[0] : fields.type || ''
        const name = Array.isArray(fields.name) ? fields.name[0] : fields.name || ''
        const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file

        if (!type || !name || !uploadedFile) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Type, name, and file are required fields',
            })
        }

        if (type !== 'movie' && type !== 'show') {
            throw createError({
                statusCode: 400,
                statusMessage: 'Invalid media type',
            })
        }

        const rootDir = type === 'movie' ? config.moviesPath : config.showsPath
        const targetFolder = path.join(rootDir, name)

        // Security check
        if (!isPathWithin(rootDir, targetFolder)) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Access denied: Target path outside root directory',
            })
        }

        await fs.mkdir(targetFolder, { recursive: true })

        // Extract file extension and save it as poster.[ext]
        const ext = path.extname(uploadedFile.originalFilename || 'poster.jpg').toLowerCase()
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Invalid image format. Allowed formats: JPG, JPEG, PNG, WEBP',
            })
        }

        const artworkFileName = `poster${ext}`
        const resolvedPath = path.resolve(path.join(targetFolder, artworkFileName))

        // Write the uploaded file
        const writeStream = createWriteStream(resolvedPath)
        const readStream = createReadStream(uploadedFile.filepath)
        await new Promise((resolveWrite, rejectWrite) => {
            readStream.pipe(writeStream)
            writeStream.on('finish', resolveWrite)
            writeStream.on('error', rejectWrite)
            readStream.on('error', rejectWrite)
        })

        // Also clean up any other poster images to avoid conflicts (e.g., if we uploaded png and there was a jpg)
        const possibleExtensions = ['.jpg', '.jpeg', '.png', '.webp']
        for (const extCheck of possibleExtensions) {
            if (extCheck !== ext) {
                try {
                    await fs.unlink(path.join(targetFolder, `poster${extCheck}`))
                } catch (e) {}
            }
        }

        // Update the theatre.json metadata
        const metadataPath = path.join(targetFolder, 'theatre.json')
        let metadata: any = {}
        try {
            const fileContent = await fs.readFile(metadataPath, 'utf-8')
            metadata = JSON.parse(fileContent)
        } catch (err) {}

        // Save URL referencing our artwork serving endpoint
        metadata.artworkUrl = `/api/theatre/artwork?type=${type}&name=${encodeURIComponent(name)}&t=${Date.now()}`
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')

        return {
            success: true,
            message: 'Artwork uploaded and set successfully',
            artworkUrl: metadata.artworkUrl
        }
    } catch (error: any) {
        console.error('Error uploading artwork:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Failed to upload artwork file',
        })
    }
})
