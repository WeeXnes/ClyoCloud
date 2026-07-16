import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import mime from 'mime-types'
import { runFfmpeg, runFfprobe } from '~/server/utils/ffmpeg'
import { getPreviewTaskStatus, updatePreviewTaskStatus, resetPreviewTaskStatus } from '~/server/utils/previewTask'

// Compute CPU cores and max concurrency limit once at startup (caching the resource check)
const CPU_CORES = os.cpus().length
const MAX_CONCURRENCY = Math.min(Math.max(CPU_CORES * 2, 4), 32)

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const user = event.context.user

    if (!user || !user.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    const status = getPreviewTaskStatus(user.name)
    if (status.isProcessing) {
        throw createError({
            statusCode: 409,
            statusMessage: 'A preview generation task is already in progress.',
        })
    }

    const userStoragePath = path.join(config.storagePath, user.name)
    const userPreviewPath = path.join(config.previewPath, user.name)

    // Helper function to recursively find all video files
    async function findVideos(dir: string): Promise<string[]> {
        let results: string[] = []
        try {
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
        } catch (e) {}
        return results
    }

    // Start background process
    async function startGeneration() {
        try {
            // Load user settings for concurrency
            const usersData = await fs.readFile(config.usersFilePath, 'utf-8')
            const users: any[] = JSON.parse(usersData)
            const userData = users.find((u) => u.name === user!.name)
            const CONCURRENCY = Math.min(userData?.maxConcurrentPreviews || 3, MAX_CONCURRENCY)

            const videos = await findVideos(userStoragePath)
            updatePreviewTaskStatus(user!.name, {
                isProcessing: true,
                total: videos.length,
                processed: 0,
                generated: 0,
                skipped: 0,
                errors: 0,
                startTime: Date.now()
            })

            const queue = [...videos]
            
            async function worker() {
                while (queue.length > 0) {
                    const videoFile = queue.shift()
                    if (!videoFile) break

                    const relativePath = path.relative(userStoragePath, videoFile)
                    const previewFile = path.join(userPreviewPath, relativePath + '.gif')

                    try {
                        await fs.access(previewFile)
                        updatePreviewTaskStatus(user!.name, {
                            processed: getPreviewTaskStatus(user!.name).processed + 1,
                            skipped: getPreviewTaskStatus(user!.name).skipped + 1
                        })
                        continue
                    } catch (e) {}

                    try {
                        await fs.mkdir(path.dirname(previewFile), { recursive: true })

                        const stdout = await runFfprobe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoFile])
                        const duration = parseFloat(stdout)
                        
                        if (isNaN(duration)) {
                            updatePreviewTaskStatus(user!.name, {
                                processed: getPreviewTaskStatus(user!.name).processed + 1,
                                errors: getPreviewTaskStatus(user!.name).errors + 1
                            })
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

                        const filterComplex = `${filterParts.join('')}concat=n=${numFrames}:v=1:a=0,fps=10,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,split[v1][v2];[v1]scale=320:180:force_original_aspect_ratio=increase,crop=320:180,boxblur=15:1[bg];[v2]scale=-1:180[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`

                        await runFfmpeg([
                            ...inputArgs,
                            '-filter_complex', filterComplex,
                            '-y', previewFile
                        ])
                        
                        updatePreviewTaskStatus(user!.name, {
                            processed: getPreviewTaskStatus(user!.name).processed + 1,
                            generated: getPreviewTaskStatus(user!.name).generated + 1
                        })
                    } catch (err) {
                        console.error(`Error generating preview for ${videoFile}:`, err)
                        updatePreviewTaskStatus(user!.name, {
                            processed: getPreviewTaskStatus(user!.name).processed + 1,
                            errors: getPreviewTaskStatus(user!.name).errors + 1
                        })
                    }
                }
            }

            // Start multiple workers in parallel
            await Promise.all(Array.from({ length: CONCURRENCY }).map(() => worker()))
        } catch (error: any) {
            console.error('Bulk preview generation error:', error)
        } finally {
            updatePreviewTaskStatus(user!.name, { isProcessing: false })
        }
    }

    // Return immediately after starting the task
    startGeneration()

    return {
        status: 'started',
        message: 'Bulk preview generation task has been started in the background.'
    }
})
