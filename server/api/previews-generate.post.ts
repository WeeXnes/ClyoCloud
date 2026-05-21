import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import mime from 'mime-types'
import { runFfmpeg, runFfprobe } from '~/server/utils/ffmpeg'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const user = event.context.user

    if (!user || !user.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    const userStoragePath = path.join(config.storagePath, user.name)
    const userPreviewPath = path.join(config.previewPath, user.name)

    // Helper function to recursively find all video files
    async function findVideos(dir: string): Promise<string[]> {
        let results: string[] = []
        const list = await fs.readdir(dir, { withFileTypes: true })
        for (const file of list) {
            const res = path.resolve(dir, file.name)
            if (file.isDirectory()) {
                results = results.concat(await findVideos(res))
            } else {
                const contentType = mime.lookup(res)
                const supportedVideoTypes = ['video/mp4', 'application/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
                if (contentType && supportedVideoTypes.includes(contentType)) {
                    results.push(res)
                }
            }
        }
        return results
    }

    try {
        const videos = await findVideos(userStoragePath)
        let generatedCount = 0
        let skippedCount = 0
        let errorCount = 0

        // We process them sequentially to avoid overwhelming the server with ffmpeg instances
        // In a real production app, this would be a background job with a queue
        for (const videoFile of videos) {
            const relativePath = path.relative(userStoragePath, videoFile)
            const previewFile = path.join(userPreviewPath, relativePath + '.gif')

            try {
                await fs.access(previewFile)
                skippedCount++
                continue // Already exists
            } catch (e) {
                // Doesn't exist, need to generate
            }

            try {
                await fs.mkdir(path.dirname(previewFile), { recursive: true })

                const stdout = await runFfprobe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoFile])
                const duration = parseFloat(stdout)
                
                if (isNaN(duration)) {
                    errorCount++
                    continue
                }

                const numFrames = 8
                const inputArgs: string[] = []
                const filterParts: string[] = []
                
                for (let i = 1; i <= numFrames; i++) {
                    const seekTime = (duration * (i * 0.1)).toFixed(2)
                    inputArgs.push('-ss', seekTime, '-t', '0.5', '-i', videoFile)
                    filterParts.push(`[${i-1}:v]`)
                }

                const filterComplex = `${filterParts.join('')}concat=n=${numFrames}:v=1:a=0,fps=10[v];[v]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,scale=320:180:force_original_aspect_ratio=increase,crop=320:180,boxblur=15:1[bg];[v]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,scale=-1:180[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`

                await runFfmpeg([
                    ...inputArgs,
                    '-filter_complex', filterComplex,
                    '-y', previewFile
                ])
                generatedCount++
            } catch (err) {
                console.error(`Error generating preview for ${videoFile}:`, err)
                errorCount++
            }
        }

        return {
            total: videos.length,
            generated: generatedCount,
            skipped: skippedCount,
            errors: errorCount
        }
    } catch (error: any) {
        console.error('Bulk preview generation error:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error during bulk generation',
        })
    }
})
