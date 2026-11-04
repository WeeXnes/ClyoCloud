import { defineEventHandler, readBody, createError } from 'h3'
import { startWallpaperV2Job } from '../../utils/comfyui'

export default defineEventHandler(async (event) => {
    const user = event.context.user
    if (!user || !user.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const body = await readBody(event)
    const { filePath, modelName, scenePreset, promptOverride, negativeOverride } = body || {}

    if (!filePath || typeof filePath !== 'string') {
        throw createError({ statusCode: 400, statusMessage: 'File path is required' })
    }
    for (const value of [modelName, scenePreset, promptOverride, negativeOverride]) {
        if (value !== undefined && value !== null && typeof value !== 'string') {
            throw createError({ statusCode: 400, statusMessage: 'Invalid pipeline options' })
        }
    }

    try {
        const job = await startWallpaperV2Job(user.name, filePath, {
            modelName: modelName ?? undefined,
            scenePreset: scenePreset ?? undefined,
            promptOverride: promptOverride ?? undefined,
            negativeOverride: negativeOverride ?? undefined
        })
        return { success: true, job }
    } catch (err: any) {
        console.error('[API /api/pipeline/wallpaper-v2] Error:', err)
        throw createError({
            statusCode: 400,
            statusMessage: err?.message || 'Failed to start Wallpaper V2 pipeline',
        })
    }
})
