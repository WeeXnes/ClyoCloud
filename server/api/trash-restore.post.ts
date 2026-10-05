import { defineEventHandler, readBody, createError } from 'h3'
import { restoreFromTrash } from '~/server/utils/trash'
import { logActivity } from '~/server/utils/activityLogger'
import { clearUserCache } from '~/server/utils/fileUtils'

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
