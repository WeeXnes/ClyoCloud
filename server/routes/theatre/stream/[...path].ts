import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { spawn } from 'child_process'
import { defineEventHandler, getRouterParam, setHeader, createError, getQuery } from 'h3'
import mime from 'mime-types'
import path, { join, resolve } from 'path'
import { isPathWithin } from '~/server/utils/fileUtils'
import { runFfprobe } from '~/server/utils/ffmpeg'

async function getVideoCodec(filePath: string): Promise<string> {
    try {
        const stdout = await runFfprobe([
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=codec_name',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            filePath
        ])
        return stdout.trim().toLowerCase()
    } catch (err) {
        console.error('[Theatre Stream] Failed to probe video codec:', err)
        return ''
    }
}

export default defineEventHandler(async (event) => {
    // Check authentication
    if (!event.context.user || !event.context.user.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const config = useRuntimeConfig()
    const filePath = getRouterParam(event, 'path')

    if (!filePath) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Stream path is required',
        })
    }

    const decodedPath = decodeURIComponent(filePath)
    const segments = decodedPath.split('/')
    if (segments.length < 2) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid stream path format',
        })
    }

    const type = segments[0] // 'movie' or 'show'
    const relativePath = segments.slice(1).join('/')

    if (type !== 'movie' && type !== 'show') {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid media type for streaming',
        })
    }

    const rootDir = type === 'movie' ? config.moviesPath : config.showsPath
    const resolvedPath = resolve(join(rootDir, relativePath))

    // Security check: restrict path to inside root directory
    if (!isPathWithin(rootDir, resolvedPath)) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Access denied: Path is outside media directory',
        })
    }

    try {
        const fileStats = await stat(resolvedPath)
        if (!fileStats.isFile()) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Media file not found',
            })
        }

        const query = getQuery(event)
        const compatibilityMode = query.compatibility === 'true'

        // 1. Compatibility Stream Mode (FFmpeg Remuxing + Audio Transcoding / Video Transcoding if needed)
        if (compatibilityMode) {
            console.log(`[Theatre Stream] Starting compatibility stream for: ${resolvedPath}`)

            // Probe video codec
            const videoCodec = await getVideoCodec(resolvedPath)
            const isVideoCompatible = ['h264', 'vp9', 'av1', 'vp8'].includes(videoCodec)

            console.log(`[Theatre Stream] Video codec is "${videoCodec}". Direct copy compatible: ${isVideoCompatible}`)

            // Set headers for chunked streaming MP4 video
            setHeader(event, 'Content-Type', 'video/mp4')
            setHeader(event, 'Cache-Control', 'no-cache, no-store, must-revalidate')
            setHeader(event, 'Pragma', 'no-cache')
            setHeader(event, 'Expires', '0')
            setHeader(event, 'Connection', 'keep-alive')

            const ffmpegArgs = [
                '-i', resolvedPath,
            ]

            // Video codec selection
            if (isVideoCompatible) {
                ffmpegArgs.push('-c:v', 'copy') // Copy video stream (fast, low CPU)
            } else {
                ffmpegArgs.push(
                    '-c:v', 'libx264',      // Transcode video to H.264 (universal support)
                    '-preset', 'ultrafast', // Ultrafast preset for real-time low-latency transcoding
                    '-tune', 'zerolatency', // Optimize for low-latency streaming
                    '-crf', '23'            // Quality/size balance
                )
            }

            // Audio codec selection
            ffmpegArgs.push(
                '-c:a', 'aac',              // Transcode audio to AAC (universal support)
                '-b:a', '192k',             // Standard audio bitrate
                '-ac', '2',                 // Stereo downmix
                '-f', 'mp4',                // Output format MP4
                '-movflags', 'frag_keyframe+empty_moov+omit_tfhd_offset+faststart', // Fragmented MP4 for live streaming
                'pipe:1'
            )

            // Spawn FFmpeg
            const ffmpegProcess = spawn('ffmpeg', ffmpegArgs)

            // If the connection is closed by the browser, kill the FFmpeg process immediately
            event.node.res.on('close', () => {
                console.log(`[Theatre Stream] Client disconnected. Killing FFmpeg process for: ${resolvedPath}`)
                ffmpegProcess.kill('SIGKILL')
            })

            // Pipe FFmpeg output stream directly to the response
            return ffmpegProcess.stdout
        }

        // 2. Direct Stream Mode (Standard Range Requests)
        const contentType = mime.lookup(resolvedPath) || 'application/octet-stream'

        setHeader(event, 'Content-Type', contentType)
        setHeader(event, 'Accept-Ranges', 'bytes')
        setHeader(event, 'Content-Disposition', 'inline')

        const range = event.node.req.headers.range
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-')
            const start = parseInt(parts[0], 10)
            const end = parts[1] ? parseInt(parts[1], 10) : fileStats.size - 1
            const chunkSize = end - start + 1

            if (start >= fileStats.size || end >= fileStats.size) {
                throw createError({
                    statusCode: 416,
                    statusMessage: 'Range not satisfiable',
                })
            }

            setHeader(event, 'Content-Range', `bytes ${start}-${end}/${fileStats.size}`)
            setHeader(event, 'Content-Length', chunkSize)
            event.node.res.statusCode = 206 // Partial Content

            return createReadStream(resolvedPath, { start, end })
        } else {
            setHeader(event, 'Content-Length', fileStats.size)
            return createReadStream(resolvedPath)
        }

    } catch (error: any) {
        console.error('[Theatre Stream] Error streaming media file:', error)
        if (error.statusCode) {
            throw error
        }
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to stream media file',
        })
    }
})
