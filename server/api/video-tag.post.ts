import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { FileMeta } from '~/types/File'

export default defineEventHandler(async (event) => {
    try {
        // Check authentication
        if (!event.context.user || !event.context.user.name) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized: User not authenticated',
            })
        }

        const config = useRuntimeConfig()
        const userStoragePath = path.join(config.storagePath, event.context.user.name)
        const body = await readBody(event)
        const { fullPath, tagName, tagColor } = body

        if (!fullPath || !tagName || !tagColor) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Missing required fields: fullPath, tagName, tagColor',
            })
        }

        // Construct full file path
        const filePath = path.join(userStoragePath, fullPath)
        if (!filePath.startsWith(userStoragePath)) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Access denied: Path outside user directory',
            })
        }

        // Check if video exists
        await fs.access(filePath)
        const cloudInfoPath = `${filePath}.cloudinfo`
        let meta: FileMeta = { tags: [] }

        // Read existing .cloudinfo file
        try {
            await fs.access(cloudInfoPath)
            const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8')
            meta = JSON.parse(cloudInfoContent) as FileMeta
            if (!meta.tags || !Array.isArray(meta.tags)) {
                meta.tags = []
            }
        } catch {
            // Create new .cloudinfo if it doesn't exist
            meta = { tags: [] }
        }

        // Add new tag
        meta.tags.push({ name: tagName, color: tagColor })

        // Write updated .cloudinfo file
        await fs.writeFile(cloudInfoPath, JSON.stringify(meta, null, 2), 'utf-8')

        return { success: true }
    } catch (error: any) {
        console.error('Error adding tag:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not add tag',
        })
    }
})