import fs, { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { defineEventHandler, getRouterParam, setHeader, createError } from 'h3'
import mime from 'mime-types'
import path, { join, resolve } from 'path'
import { runFfmpeg, runFfprobe } from '~/server/utils/ffmpeg'
import { isFilePublic } from '~/server/utils/publicCheck'

import { isPathWithin } from '~/server/utils/fileUtils'
import { handleHttpCache } from '~/server/utils/httpCache'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const username = getRouterParam(event, 'username')
    const filePath = getRouterParam(event, 'path')

    if (!username || !filePath) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Username and file path are required',
        })
    }

    const decodedPath = decodeURIComponent(filePath)
    const userStoragePath = path.join(config.storagePath, username)
    const userThumbnailPath = path.join(config.thumbnailPath, username)
    
    const requestedThumbnail = resolve(join(userThumbnailPath, decodedPath + '.jpg'))
    const requestedFile = resolve(join(userStoragePath, decodedPath))

    if (!isPathWithin(userThumbnailPath, requestedThumbnail) || !isPathWithin(userStoragePath, requestedFile)) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Access denied',
        })
    }

    // Check if file is public
    const publicAccess = await isFilePublic(config.storagePath, username, decodedPath)
    if (!publicAccess) {
        throw createError({
            statusCode: 404,
            statusMessage: 'File not found or not public',
        })
    }

    const contentType = mime.lookup(requestedFile)
    const supportedVideoTypes = ['video/mp4', 'application/mp4', 'video/webm']
    const supportedImageTypes = ['image/png', 'image/jpeg', 'image/gif']
    const supportedTypes = [...supportedVideoTypes, ...supportedImageTypes]
    if (!contentType || !supportedTypes.includes(contentType)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Unsupported file type',
        })
    }

    try {
        try {
            const thumbnailStats = await stat(requestedThumbnail)
            if (thumbnailStats.isFile()) {
                if (handleHttpCache(event, thumbnailStats as any, true)) {
                    return
                }
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
            throw createError({
                statusCode: 404,
                statusMessage: 'Original file not found',
            })
        }

        await fs.promises.mkdir(path.dirname(requestedThumbnail), { recursive: true });

        if (supportedImageTypes.includes(contentType)) {
            try {
                await runFfmpeg([
                    '-i', requestedFile,
                    '-filter_complex', '[0:v]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,scale=320:180:force_original_aspect_ratio=increase,crop=320:180,boxblur=15:1[bg];[0:v]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,scale=-1:180[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2',
                    '-y', requestedThumbnail
                ])
            } catch (ffmpegError) {
                console.error(`Error generating public image thumbnail: ${ffmpegError}`)
                throw createError({ statusCode: 500, statusMessage: 'Failed to generate thumbnail' })
            }
        } else {
            let duration
            try {
                const stdout = await runFfprobe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', requestedFile])
                duration = parseFloat(stdout)
            } catch (ffprobeError) {
                duration = 1 // Fallback
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
            } catch (ffmpegError) {
                console.error(`Error generating public video thumbnail: ${ffmpegError}`)
                throw createError({ statusCode: 500, statusMessage: 'Failed to generate thumbnail' })
            }
        }

        const thumbnailStats = await stat(requestedThumbnail)
        if (handleHttpCache(event, thumbnailStats as any, true)) {
            return
        }
        setHeader(event, 'Content-Type', 'image/jpeg')
        setHeader(event, 'Content-Length', thumbnailStats.size)
        setHeader(event, 'Content-Disposition', 'inline')
        return createReadStream(requestedThumbnail)
    } catch (error: any) {
        console.error('Error processing public thumbnail:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Internal Server Error',
        })
    }
})
