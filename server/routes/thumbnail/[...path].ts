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

    //console.log(`Requested thumbnail: ${requestedThumbnail}`)
    //console.log(`Requested file: ${requestedFile}`)

    if (!requestedThumbnail.startsWith(resolve(thumbnailPath)) || !requestedFile.startsWith(resolve(storagePath))) {
        console.error(`Access denied: Path outside allowed directories`)
        throw createError({
            statusCode: 403,
            statusMessage: 'Access denied: Path outside allowed directories'
        })
    }

    const contentType = mime.lookup(requestedFile)
    const supportedVideoTypes = ['video/mp4', 'application/mp4']
    const supportedImageTypes = ['image/png', 'image/jpeg', 'image/gif']
    const supportedTypes = [...supportedVideoTypes, ...supportedImageTypes]
    if (!contentType || !supportedTypes.includes(contentType)) {
        console.error(`Unsupported file type: ${contentType}`)
        throw createError({
            statusCode: 400,
            statusMessage: 'Unsupported file type. Only MP4, PNG, JPEG, and GIF are supported'
        })
    }

    try {
        try {
            const thumbnailStats = await stat(requestedThumbnail)
            if (thumbnailStats.isFile()) {
                //console.log(`Serving existing thumbnail: ${requestedThumbnail}`)
                setHeader(event, 'Content-Type', 'image/jpeg')
                setHeader(event, 'Content-Length', thumbnailStats.size)
                setHeader(event, 'Content-Disposition', 'inline')
                return createReadStream(requestedThumbnail)
            }
        } catch (error) {
            //console.log(`Thumbnail not found, generating new one: ${requestedThumbnail}`)
        }

        const fileStats = await stat(requestedFile)
        if (!fileStats.isFile()) {
            console.error(`Original file not found: ${requestedFile}`)
            throw createError({
                statusCode: 404,
                statusMessage: 'Original file not found'
            })
        }

        await execAsync(`mkdir -p "${path.dirname(requestedThumbnail)}"`)

        if (supportedImageTypes.includes(contentType)) {
            let needsResize = true
            try {
                const ffprobeCommand = `ffprobe -v error -show_entries stream=width,height -of json "${requestedFile}"`
                const { stdout } = await execAsync(ffprobeCommand)
                const data = JSON.parse(stdout)
                const { width, height } = data.streams[0] || {}
                if (width && height && width <= 320 && height <= 180) {
                    needsResize = false
                    //console.log(`Image is small enough (${width}x${height}), serving directly: ${requestedFile}`)
                }
            } catch (ffprobeError) {
                console.warn(`Error checking image dimensions, proceeding with resize: ${ffprobeError}`)
            }

            if (!needsResize) {
                setHeader(event, 'Content-Type', contentType)
                setHeader(event, 'Content-Length', fileStats.size)
                setHeader(event, 'Content-Disposition', 'inline')
                return createReadStream(requestedFile)
            }

            const ffmpegCommand = `ffmpeg -i "${requestedFile}" -vf "scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2" "${requestedThumbnail}" -y`
            try {
                await execAsync(ffmpegCommand)
                console.log(`Image thumbnail generated successfully: ${requestedThumbnail}`)
            } catch (ffmpegError) {
                console.error(`Error generating image thumbnail: ${ffmpegError}`)
                throw createError({
                    statusCode: 500,
                    statusMessage: 'Failed to generate image thumbnail'
                })
            }
        } else {
            const ffmpegCommand = `ffmpeg -i "${requestedFile}" -ss 5 -vf "thumbnail,scale=320:180" -frames:v 1 "${requestedThumbnail}" -y`
            try {
                await execAsync(ffmpegCommand)
                console.log(`Video thumbnail generated successfully: ${requestedThumbnail}`)
            } catch (ffmpegError) {
                console.error(`Error generating video thumbnail: ${ffmpegError}`)
                throw createError({
                    statusCode: 500,
                    statusMessage: 'Failed to generate video thumbnail'
                })
            }
        }

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