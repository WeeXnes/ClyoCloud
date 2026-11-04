import { defineEventHandler, readBody, createError } from 'h3'
import { restoreFromTrash } from '~/server/utils/trash'
import { logActivity } from '~/server/utils/activityLogger'
import fs from 'fs/promises'
import path from 'path'
import { clearUserCache } from '~/server/utils/fileUtils'
import { addTreeToCache } from '~/server/utils/tagCache'
import { addToFavorites } from '~/server/utils/favorites'
import { addToWallpapers } from '~/server/utils/wallpapers'
import type { FileMeta } from '~/types/File'

/**
 * Deleting removed the item (and anything inside it) from the favorites and wallpapers
 * indexes, but its .cloudinfo flags came back with it. Put the index entries back.
 */
async function reindexRestored(username: string, relativePath: string) {
    const config = useRuntimeConfig()
    const userStoragePath = path.join(config.storagePath, username)

    async function visit(relPath: string, isFolder: boolean) {
        const fullPath = path.join(userStoragePath, relPath)
        try {
            const meta = JSON.parse(await fs.readFile(`${fullPath}.cloudinfo`, 'utf-8')) as FileMeta
            if (meta.isFavourite) await addToFavorites(username, relPath, isFolder)
            if (meta.isWallpaper) await addToWallpapers(username, relPath, isFolder)
        } catch {
            // No metadata
        }
        if (!isFolder) return
        let entries
        try {
            entries = await fs.readdir(fullPath, { withFileTypes: true })
        } catch {
            return
        }
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name.endsWith('.cloudinfo')) continue
            if (entry.isDirectory() || entry.isFile()) {
                await visit(`${relPath}/${entry.name}`, entry.isDirectory())
            }
        }
    }

    try {
        const stats = await fs.stat(path.join(userStoragePath, relativePath))
        await visit(relativePath, stats.isDirectory())
    } catch {
        // Gone again
    }
}

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    try {
        const body = await readBody(event)
        const { id, ids } = body || {}

        const targetIds = ids && Array.isArray(ids) ? ids : (id ? [id] : [])
        if (targetIds.length === 0) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Trash item ID(s) required',
            })
        }

        const restoredPaths: string[] = []
        for (const targetId of targetIds) {
            try {
                const result = await restoreFromTrash(event.context.user.name, targetId)
                restoredPaths.push(result.restoredPath)
            } catch (err: any) {
                console.warn(`[TRASH] Failed to restore item ${targetId}:`, err)
            }
        }

        clearUserCache(event.context.user.name)
        for (const restoredPath of restoredPaths) {
            await addTreeToCache(event.context.user.name, restoredPath)
            await reindexRestored(event.context.user.name, restoredPath)
        }
        await logActivity(event.context.user.name, 'RESTORE', 'Trash', `Restored ${restoredPaths.length} item(s) from trash`, event)

        return { success: true, restoredPaths, count: restoredPaths.length }
    } catch (error: any) {
        console.error('Error restoring from trash:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not restore file from trash',
        })
    }
})
