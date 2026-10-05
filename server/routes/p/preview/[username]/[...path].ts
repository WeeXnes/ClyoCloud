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
    const userPreviewPath = path.join(config.previewPath, username)
    
    const requestedPreview = resolve(join(userPreviewPath, decodedPath + '.gif'))
    const requestedFile = resolve(join(userStoragePath, decodedPath))

    if (!isPathWithin(userPreviewPath, requestedPreview) || !isPathWithin(userStoragePath, requestedFile)) {
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
    const supportedVideoTypes = ['video/mp4', 'application/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
    
    if (!contentType || !supportedVideoTypes.includes(contentType)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Unsupported file type for video preview',
        })
    }

    try {
        try {
            const previewStats = await stat(requestedPreview)
            if (previewStats.isFile()) {
                if (handleHttpCache(event, previewStats as any, true)) {
                    return
                }
                setHeader(event, 'Content-Type', 'image/gif')
                setHeader(event, 'Content-Length', previewStats.size)
                setHeader(event, 'Content-Disposition', 'inline')
                return createReadStream(requestedPreview)
            }
        } catch (error) {
            // Preview not found, proceed to generate
        }

        const fileStats = await stat(requestedFile)
        if (!fileStats.isFile()) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Original file not found',
            })
        }

        await fs.promises.mkdir(path.dirname(requestedPreview), { recursive: true });

        let duration
        try {
            const stdout = await runFfprobe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', requestedFile])
            duration = parseFloat(stdout)
            if (isNaN(duration)) {
                throw new Error('Failed to parse video duration.')
            }
        } catch (ffprobeError: any) {
            duration = 10 // Fallback
        }

        const numFrames = 8
        const inputArgs: string[] = []
        const filterParts: string[] = []
        
        for (let i = 1; i <= numFrames; i++) {
            const seekTime = (duration * (i * 0.1)).toFixed(2)
            inputArgs.push('-ss', seekTime, '-t', '0.5', '-i', requestedFile)
            filterParts.push(`[${i-1}:v]`)
        }

        const filterComplex = `${filterParts.join('')}concat=n=${numFrames}:v=1:a=0,fps=10,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,split[v1][v2];[v1]scale=320:180:force_original_aspect_ratio=increase,crop=320:180,boxblur=15:1[bg];[v2]scale=-1:180[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`

        try {
            await runFfmpeg([
                ...inputArgs,
                '-filter_complex', filterComplex,
                '-y', requestedPreview
            ])
        } catch (ffmpegError: any) {
            console.error(`Error generating public video preview: ${ffmpegError.message}`)
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to generate video preview',
            })
        }

        const previewStats = await stat(requestedPreview)
        if (handleHttpCache(event, previewStats as any, true)) {
            return
        }
        setHeader(event, 'Content-Type', 'image/gif')
        setHeader(event, 'Content-Length', previewStats.size)
        setHeader(event, 'Content-Disposition', 'inline')
        return createReadStream(requestedPreview)
    } catch (error: any) {
        console.error('Error processing public preview:', error.message)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'File not found or processing error',
        })
    }
})
