import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const user = event.context.user

    if (!user || !user.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    const userPreviewPath = path.join(config.previewPath, user.name)

    try {
        await fs.rm(userPreviewPath, { recursive: true, force: true })
        await fs.mkdir(userPreviewPath, { recursive: true })

        return {
            success: true,
            message: 'All previews cleared'
        }
    } catch (error: any) {
        console.error('Clear previews error:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error while clearing previews',
        })
    }
})
