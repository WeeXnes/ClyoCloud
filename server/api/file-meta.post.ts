import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { FileMeta } from '~/types/File'
import { addToFavorites, removeFromFavorites } from '~/server/utils/favorites'

import { isPathWithin } from '~/server/utils/fileUtils'

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
        const { fullPath, description, tags, isPublic, isFavourite } = body

        if (!fullPath) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Missing fullPath',
            })
        }

        const filePath = path.resolve(path.join(userStoragePath, fullPath))
        if (!isPathWithin(userStoragePath, filePath)) {
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
        if (tags !== undefined) {
            meta.tags = tags
            await logActivity(event.context.user.name, 'TAG', fullPath, `Updated tags`, event)
        }
        if (isPublic !== undefined) {
            meta.isPublic = isPublic
            await logActivity(event.context.user.name, 'SHARE', fullPath, isPublic ? 'Enabled public access' : 'Disabled public access', event)
        }
        if (isFavourite !== undefined) {
            meta.isFavourite = isFavourite
            await logActivity(event.context.user.name, 'FAVORITE', fullPath, isFavourite ? 'Added to favorites' : 'Removed from favorites', event)
            
            // Update favorites index
            if (isFavourite) {
                const stats = await fs.stat(filePath)
                await addToFavorites(event.context.user.name, fullPath, stats.isDirectory())
            } else {
                await removeFromFavorites(event.context.user.name, fullPath)
            }
        }

        await fs.writeFile(cloudInfoPath, JSON.stringify(meta, null, 2), 'utf-8')

        // Update tag cache
        await updateFileInCache(event.context.user.name, fullPath, meta)

        return { success: true, meta }
    } catch (error: any) {
        console.error('Error updating meta:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not update metadata',
        })
    }
})
