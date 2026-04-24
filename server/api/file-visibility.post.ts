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
        const { fullPath, isPublic } = body

        if (fullPath === undefined || isPublic === undefined) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Missing required fields: fullPath, isPublic',
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

        // Check if file exists
        await fs.access(filePath)
        const cloudInfoPath = `${filePath}.cloudinfo`
        let meta: FileMeta = { tags: [] }

        // Read existing .cloudinfo file
        try {
            await fs.access(cloudInfoPath)
            const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8')
            meta = JSON.parse(cloudInfoContent) as FileMeta
        } catch {
            // Create new .cloudinfo if it doesn't exist
            meta = { tags: [] }
        }

        // Update visibility
        meta.isPublic = !!isPublic

        // Write updated .cloudinfo file
        await fs.writeFile(cloudInfoPath, JSON.stringify(meta, null, 2), 'utf-8')

        return { success: true, isPublic: meta.isPublic }
    } catch (error: any) {
        console.error('Error updating file visibility:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not update file visibility',
        })
    }
})
