import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { defineEventHandler, getRouterParam, setHeader, createError } from 'h3'
import mime from 'mime-types'
import path, { join, resolve } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const thumbnailPath = config.thumbnailPath
    const storagePath = config.storagePath

    const filePath = getRouterParam(event, 'path')

    if (!filePath) {
        throw createError({
            statusCode: 400,
            statusMessage: 'File path is required'
        })
    }

    const decodedPath = decodeURIComponent(filePath)
    const requestedThumbnail = resolve(join(thumbnailPath, decodedPath + '.jpg'))
    const requestedFile = resolve(join(storagePath, decodedPath))

    console.log(`Requested thumbnail: ${requestedThumbnail}`)
    console.log(`Requested file: ${requestedFile}`)

    // Security check to prevent directory traversal
    if (!requestedThumbnail.startsWith(resolve(thumbnailPath)) || !requestedFile.startsWith(resolve(storagePath))) {
        console.error(`Access denied: Path outside allowed directories`)
        throw createError({
            statusCode: 403,
            statusMessage: 'Access denied: Path outside allowed directories'
        })
    }

    // Check if the original file is a supported video type
    const contentType = mime.lookup(requestedFile)
    const supportedTypes = ['video/mp4', 'application/mp4']
    if (!contentType || !supportedTypes.includes(contentType)) {
        console.error(`Unsupported file type: ${contentType}`)
        throw createError({
            statusCode: 400,
            statusMessage: 'Unsupported file type. Only MP4 is supported'
        })
    }

    try {
        // Check if thumbnail exists
        try {
            const thumbnailStats = await stat(requestedThumbnail)
            if (thumbnailStats.isFile()) {
                console.log(`Serving existing thumbnail: ${requestedThumbnail}`)
                setHeader(event, 'Content-Type', 'image/jpeg')
                setHeader(event, 'Content-Length', thumbnailStats.size)
                setHeader(event, 'Content-Disposition', 'inline')
                return createReadStream(requestedThumbnail)
            }
        } catch (error) {
            // Thumbnail doesn't exist, continue to generate
            console.log(`Thumbnail not found, generating new one: ${requestedThumbnail}`)
        }

        // Verify original file exists
        const fileStats = await stat(requestedFile)
        if (!fileStats.isFile()) {
            console.error(`Original file not found: ${requestedFile}`)
            throw createError({
                statusCode: 404,
                statusMessage: 'Original file not found'
            })
        }

        // Create thumbnail directory if it doesn't exist
        await execAsync(`mkdir -p "${path.dirname(requestedThumbnail)}"`)

        // Generate thumbnail using ffmpeg
        const ffmpegCommand = `ffmpeg -i "${requestedFile}" -vf "thumbnail,scale=320:180" -frames:v 1 "${requestedThumbnail}" -y`
        try {
            await execAsync(ffmpegCommand)
            console.log(`Thumbnail generated successfully: ${requestedThumbnail}`)
        } catch (ffmpegError) {
            console.error(`Error generating thumbnail: ${ffmpegError}`)
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to generate thumbnail'
            })
        }

        // Verify and serve the generated thumbnail
        const thumbnailStats = await stat(requestedThumbnail)
        if (!thumbnailStats.isFile()) {
            console.error(`Generated thumbnail not found: ${requestedThumbnail}`)
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to generate thumbnail'
            })
        }

        console.log(`Serving generated thumbnail: ${requestedThumbnail}`)
        setHeader(event, 'Content-Type', 'image/jpeg')
        setHeader(event, 'Content-Length', thumbnailStats.size)
        setHeader(event, 'Content-Disposition', 'inline')
        return createReadStream(requestedThumbnail)

    } catch (error) {
        console.error('Error processing thumbnail:', error)
        throw createError({
            statusCode: 404,
            statusMessage: 'File not found or processing error'
        })
    }
})