import fs, { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { defineEventHandler, getRouterParam, setHeader, createError } from 'h3'
import mime from 'mime-types'
import path, { join, resolve } from 'path'
import { runFfmpeg, runFfprobe } from '~/server/utils/ffmpeg'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const userStoragePath = path.join(config.storagePath, event.context.user.name)
    const userPreviewPath = path.join(config.previewPath, event.context.user.name)
    const filePath = getRouterParam(event, 'path')

    if (!filePath) {
        throw createError({
            statusCode: 400,
            statusMessage: 'File path is required',
        })
    }

    const decodedPath = decodeURIComponent(filePath)
    const requestedPreview = resolve(join(userPreviewPath, decodedPath + '.gif'))
    const requestedFile = resolve(join(userStoragePath, decodedPath))

    if (!requestedPreview.startsWith(resolve(userPreviewPath)) || !requestedFile.startsWith(resolve(userStoragePath))) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Access denied: Path outside allowed directories',
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
            console.error(`Error getting video duration: ${ffprobeError.message}`)
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to get video duration',
            })
        }

        // Generate GIF from 8 frames at 10%, 20%, ..., 80%
        const numFrames = 8
        const inputArgs: string[] = []
        const filterParts: string[] = []
        
        for (let i = 1; i <= numFrames; i++) {
            const seekTime = (duration * (i * 0.1)).toFixed(2)
            inputArgs.push('-ss', seekTime, '-t', '0.5', '-i', requestedFile)
            filterParts.push(`[${i-1}:v]`)
        }

        const filterComplex = `${filterParts.join('')}concat=n=${numFrames}:v=1:a=0,fps=10,scale=320:-1:force_original_aspect_ratio=increase,crop=320:180,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`

        try {
            await runFfmpeg([
                ...inputArgs,
                '-filter_complex', filterComplex,
                '-y', requestedPreview
            ])
            console.log(`Video preview generated successfully: ${requestedPreview}`)
        } catch (ffmpegError: any) {
            console.error(`Error generating video preview: ${ffmpegError.message}`)
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to generate video preview',
            })
        }

        const previewStats = await stat(requestedPreview)
        setHeader(event, 'Content-Type', 'image/gif')
        setHeader(event, 'Content-Length', previewStats.size)
        setHeader(event, 'Content-Disposition', 'inline')
        return createReadStream(requestedPreview)
    } catch (error: any) {
        console.error('Error processing preview:', error.message)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'File not found or processing error',
        })
    }
})
