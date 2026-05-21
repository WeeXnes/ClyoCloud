import fs, { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { defineEventHandler, getRouterParam, setHeader, createError } from 'h3'
import mime from 'mime-types'
import path, { join, resolve } from 'path'
import { runFfmpeg, runFfprobe } from '~/server/utils/ffmpeg'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const userStoragePath = path.join(config.storagePath, event.context.user.name)
    const userThumbnailPath = path.join(config.thumbnailPath, event.context.user.name)
    const filePath = getRouterParam(event, 'path')

    if (!filePath) {
        throw createError({
            statusCode: 400,
            statusMessage: 'File path is required',
        })
    }

    const decodedPath = decodeURIComponent(filePath)
    const requestedThumbnail = resolve(join(userThumbnailPath, decodedPath + '.jpg'))
    const requestedFile = resolve(join(userStoragePath, decodedPath))

    if (!requestedThumbnail.startsWith(resolve(userThumbnailPath)) || !requestedFile.startsWith(resolve(userStoragePath))) {
        console.error(`Access denied: Path outside allowed directories`)
        throw createError({
            statusCode: 403,
            statusMessage: 'Access denied: Path outside allowed directories',
        })
    }

    const contentType = mime.lookup(requestedFile)
    const supportedVideoTypes = ['video/mp4', 'application/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
    const supportedImageTypes = ['image/png', 'image/jpeg', 'image/gif']
    const supportedTypes = [...supportedVideoTypes, ...supportedImageTypes]
    if (!contentType || !supportedTypes.includes(contentType)) {
        console.error(`Unsupported file type: ${contentType}`)
        throw createError({
            statusCode: 400,
            statusMessage: 'Unsupported file type. Only MP4, WEBM, MOV, MKV, PNG, JPEG, and GIF are supported',
        })
    }

    try {
        try {
            const thumbnailStats = await stat(requestedThumbnail)
            if (thumbnailStats.isFile()) {
                setHeader(event, 'Content-Type', 'image/jpeg')
                setHeader(event, 'Content-Length', thumbnailStats.size)
                setHeader(event, 'Content-Disposition', 'inline')
                return createReadStream(requestedThumbnail)
            }
        } catch (error) {
            // Thumbnail not found, proceed to generate
        }

        const fileStats = await stat(requestedFile)
        if (!fileStats.isFile()) {
            console.error(`Original file not found: ${requestedFile}`)
            throw createError({
                statusCode: 404,
                statusMessage: 'Original file not found',
            })
        }

        await fs.promises.mkdir(path.dirname(requestedThumbnail), { recursive: true });

        if (supportedImageTypes.includes(contentType)) {
            let needsResize = true
            try {
                const stdout = await runFfprobe(['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', requestedFile])
                const data = JSON.parse(stdout)
                const { width, height } = data.streams[0] || {}
                if (width && height && width <= 320 && height <= 180) {
                    needsResize = false
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

            try {
                await runFfmpeg([
                    '-i', requestedFile,
                    '-filter_complex', '[0:v]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,scale=320:180:force_original_aspect_ratio=increase,crop=320:180,boxblur=15:1[bg];[0:v]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,scale=-1:180[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2',
                    '-y', requestedThumbnail
                ])
                console.log(`Image thumbnail generated successfully: ${requestedThumbnail}`)
            } catch (ffmpegError) {
                console.error(`Error generating image thumbnail: ${ffmpegError}`)
                throw createError({
                    statusCode: 500,
                    statusMessage: 'Failed to generate image thumbnail',
                })
            }
        } else {
            let duration
            try {
                const stdout = await runFfprobe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', requestedFile])
                duration = parseFloat(stdout)
                if (isNaN(duration)) {
                    throw new Error('Failed to parse video duration.')
                }
            } catch (ffprobeError: any) {
                console.error(`Error getting video duration: ${ffprobeError.message}`)
                throw createError({
                    statusCode: 500,
                    statusMessage: 'Failed to get video duration',
                })
            }

            const seekTime = (duration * 0.1).toString()
            try {
                await runFfmpeg([
                    '-ss', seekTime,
                    '-i', requestedFile,
                    '-vframes', '1',
                    '-filter_complex', '[0:v]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,scale=320:180:force_original_aspect_ratio=increase,crop=320:180,boxblur=15:1[bg];[0:v]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,scale=-1:180[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2',
                    '-frames:v', '1',
                    '-q:v', '2',
                    '-y', requestedThumbnail
                ])
                console.log(`Video thumbnail generated successfully: ${requestedThumbnail}`)
            } catch (ffmpegError: any) {
                console.error(`Error generating video thumbnail: ${ffmpegError.message}`)

                const secondSeekTime = (duration * 0.5).toString()
                try {
                    await runFfmpeg([
                        '-ss', secondSeekTime,
                        '-i', requestedFile,
                        '-vf', 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,scale=320:180',
                        '-frames:v', '1',
                        '-pix_fmt', 'yuvj420p',
                        requestedThumbnail,
                        '-y'
                    ])
                    console.log(`Video thumbnail generated successfully on second attempt: ${requestedThumbnail}`)
                } catch (secondFfmpegError: any) {
                    console.error(`Final Error generating video thumbnail: ${secondFfmpegError.message}`)
                    throw createError({
                        statusCode: 500,
                        statusMessage: 'Final Error generating video thumbnail',
                    })
                }
            }
        }

        const thumbnailStats = await stat(requestedThumbnail)
        if (!thumbnailStats.isFile()) {
            console.error(`Generated thumbnail not found: ${requestedThumbnail}`)
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to generate thumbnail',
            })
        }

        setHeader(event, 'Content-Type', 'image/jpeg')
        setHeader(event, 'Content-Length', thumbnailStats.size)
        setHeader(event, 'Content-Disposition', 'inline')
        return createReadStream(requestedThumbnail)
    } catch (error: any) {
        console.error('Error processing thumbnail:', error.message)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'File not found or processing error',
        })
    }
})
