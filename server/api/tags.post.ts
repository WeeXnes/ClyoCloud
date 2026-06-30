import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import { logActivity } from '../utils/activityLogger'

export default defineEventHandler(async (event) => {
    const user = event.context.user
    if (!user || !user.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    const body = await readBody(event)
    const { tags } = body
    const config = useRuntimeConfig()

    if (!Array.isArray(tags)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Tags must be an array',
        })
    }

    try {
        const tagsDir = path.dirname(config.tagsFilePath);
        const userTagsPath = path.join(tagsDir, `tags_${user.name}.json`);
        
        await fs.mkdir(tagsDir, { recursive: true });

        await fs.writeFile(userTagsPath, JSON.stringify({ tags }, null, 2), 'utf-8')

        await logActivity(user.name, 'TAG_UPDATE', 'Settings', `Updated predefined tag library (${tags.length} tags)`, event)

        return { message: 'Tags updated successfully' }
    } catch (error) {
        console.error('Save tags error:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error',
        })
    }
})