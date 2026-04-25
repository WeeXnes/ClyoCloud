import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'

export default defineEventHandler(async (event) => {
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
        const tagsFilePath = config.tagsFilePath
        
        // Ensure the directory exists if it's the first time
        const dir = path.dirname(tagsFilePath);
        await fs.mkdir(dir, { recursive: true });

        await fs.writeFile(tagsFilePath, JSON.stringify({ tags }, null, 2), 'utf-8')

        return { message: 'Tags updated successfully' }
    } catch (error) {
        console.error('Save tags error:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error',
        })
    }
})