import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import mime from 'mime-types'
import { runFfmpeg, runFfprobe } from '~/server/utils/ffmpeg'
import { getThumbnailTaskStatus, updateThumbnailTaskStatus, resetThumbnailTaskStatus } from '~/server/utils/previewTask'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const user = event.context.user

    if (!user || !user.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    const status = getThumbnailTaskStatus(user.name)
    if (status.isProcessing) {
        throw createError({
            statusCode: 409,
            statusMessage: 'A thumbnail generation task is already in progress.',
        })
    }

    const userStoragePath = path.join(config.storagePath, user.name)
    const userThumbnailPath = path.join(config.thumbnailPath, user.name)

    // Helper function to recursively find all image and video files
    async function findImages(dir: string): Promise<string[]> {
        let results: string[] = []
        try {
            const list = await fs.readdir(dir, { withFileTypes: true })
            for (const file of list) {
                const res = path.resolve(dir, file.name)
                if (file.name.endsWith('.cloudinfo')) continue;
                if (file.isDirectory()) {
                    results = results.concat(await findImages(res))
                } else {
                    const contentType = mime.lookup(res)
                    const supportedImageTypes = ['image/png', 'image/jpeg', 'image/gif']
                    const supportedVideoTypes = ['video/mp4', 'application/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
                    const supportedTypes = [...supportedImageTypes, ...supportedVideoTypes]
                    if (contentType && supportedTypes.includes(contentType)) {
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
            const CPU_CORES = os.cpus().length
            const maxConcurrency = Math.min(Math.max(CPU_CORES * 2, 4), 32)
            const CONCURRENCY = Math.min(userData?.maxConcurrentPreviews || 3, maxConcurrency)

            const images = await findImages(userStoragePath)
            updateThumbnailTaskStatus(user!.name, {
                isProcessing: true,
                total: images.length,
                processed: 0,
                generated: 0,
                skipped: 0,
                errors: 0,
                startTime: Date.now()
            })

            const queue = [...images]
            
            async function worker() {
                while (queue.length > 0) {
                    const imageFile = queue.shift()
                    if (!imageFile) break

                    const relativePath = path.relative(userStoragePath, imageFile)
                    const thumbnailFile = path.join(userThumbnailPath, relativePath + '.jpg')

                    try {
                        await fs.access(thumbnailFile)
                        updateThumbnailTaskStatus(user!.name, {
                            processed: getThumbnailTaskStatus(user!.name).processed + 1,
                            skipped: getThumbnailTaskStatus(user!.name).skipped + 1
                        })
                        continue
                    } catch (e) {}

                    try {
                        await fs.mkdir(path.dirname(thumbnailFile), { recursive: true })

                        const contentType = mime.lookup(imageFile) || ''
                        const supportedImageTypes = ['image/png', 'image/jpeg', 'image/gif']
                        const isImage = supportedImageTypes.includes(contentType)

                        if (isImage) {
                            // First check if it needs resize (same logic as thumbnail route)
                            let needsResize = true
                            try {
                                const stdout = await runFfprobe(['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', imageFile])
                                const data = JSON.parse(stdout)
                                const { width, height } = data.streams[0] || {}
                                if (width && height && width <= 320 && height <= 180) {
                                    needsResize = false
                                }
                            } catch (ffprobeError) {
                                // Dimension check failed, proceed with resize
                            }

                            if (!needsResize) {
                                await runFfmpeg([
                                    '-i', imageFile,
                                    '-y', thumbnailFile
                                ])
                            } else {
                                await runFfmpeg([
                                    '-i', imageFile,
                                    '-filter_complex', '[0:v]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,scale=320:180:force_original_aspect_ratio=increase,crop=320:180,boxblur=15:1[bg];[0:v]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,scale=-1:180[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2',
                                    '-y', thumbnailFile
                                ])
                            }
                        } else {
                            // Video thumbnail generation (grab frame at 10% or 50% fallback)
                            let duration
                            try {
                                const stdout = await runFfprobe(['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', imageFile])
                                duration = parseFloat(stdout)
                            } catch (ffprobeError) {}

                            if (!duration || isNaN(duration)) {
                                duration = 10
                            }

                            const seekTime = (duration * 0.1).toString()
                            try {
                                await runFfmpeg([
                                    '-ss', seekTime,
                                    '-i', imageFile,
                                    '-vframes', '1',
                                    '-filter_complex', '[0:v]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,scale=320:180:force_original_aspect_ratio=increase,crop=320:180,boxblur=15:1[bg];[0:v]setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,scale=-1:180[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2',
                                    '-frames:v', '1',
                                    '-q:v', '2',
                                    '-y', thumbnailFile
                                ])
                            } catch (ffmpegError) {
                                const secondSeekTime = (duration * 0.5).toString()
                                await runFfmpeg([
                                    '-ss', secondSeekTime,
                                    '-i', imageFile,
                                    '-vf', 'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709,scale=320:180',
                                    '-frames:v', '1',
                                    '-pix_fmt', 'yuvj420p',
                                    '-y', thumbnailFile
                                ])
                            }
                        }
                        
                        updateThumbnailTaskStatus(user!.name, {
                            processed: getThumbnailTaskStatus(user!.name).processed + 1,
                            generated: getThumbnailTaskStatus(user!.name).generated + 1
                        })
                    } catch (err) {
                        console.error(`Error generating thumbnail for ${imageFile}:`, err)
                        updateThumbnailTaskStatus(user!.name, {
                            processed: getThumbnailTaskStatus(user!.name).processed + 1,
                            errors: getThumbnailTaskStatus(user!.name).errors + 1
                        })
                    }
                }
            }

            // Start multiple workers in parallel
            await Promise.all(Array.from({ length: CONCURRENCY }).map(() => worker()))
        } catch (error: any) {
            console.error('Bulk thumbnail generation error:', error)
        } finally {
            updateThumbnailTaskStatus(user!.name, { isProcessing: false })
        }
    }

    startGeneration()

    return {
        status: 'started',
        message: 'Bulk thumbnail generation task has been started in the background.'
    }
})
