import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { FileMeta } from '~/types/File'

export default defineEventHandler(async (event) => {
    try {
        if (!event.context.user || !event.context.user.name) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized',
            })
        }

        const config = useRuntimeConfig()
        const userStoragePath = path.resolve(path.join(config.storagePath, event.context.user.name))
        const body = await readBody(event)
        const { fullPath, description, tags, isPublic } = body

        if (!fullPath) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Missing fullPath',
            })
        }

        const filePath = path.resolve(path.join(userStoragePath, fullPath))
        if (!filePath.startsWith(userStoragePath)) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Access denied',
            })
        }

        await fs.access(filePath)
        const cloudInfoPath = `${filePath}.cloudinfo`
        let meta: FileMeta = { tags: [] }

        try {
            const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8')
            meta = JSON.parse(cloudInfoContent) as FileMeta
        } catch {
            // New meta
        }

        if (description !== undefined) meta.description = description
        if (tags !== undefined) meta.tags = tags
        if (isPublic !== undefined) meta.isPublic = isPublic

        await fs.writeFile(cloudInfoPath, JSON.stringify(meta, null, 2), 'utf-8')

        return { success: true, meta }
    } catch (error: any) {
        console.error('Error updating meta:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not update metadata',
        })
    }
})
