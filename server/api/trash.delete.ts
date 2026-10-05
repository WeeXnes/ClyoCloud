import { defineEventHandler, readBody, createError } from 'h3'
import { emptyTrash, permanentlyDeleteFromTrash } from '~/server/utils/trash'
import { logActivity } from '~/server/utils/activityLogger'

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    try {
        const body = await readBody(event).catch(() => ({}))
        const { id, ids, emptyAll } = body || {}

        if (emptyAll === true) {
            const count = await emptyTrash(event.context.user.name)
            await logActivity(event.context.user.name, 'EMPTY_TRASH', 'Trash', `Purged ${count} items permanently`, event)
            return { success: true, count }
        }

        const targetIds = ids && Array.isArray(ids) ? ids : (id ? [id] : [])
        if (targetIds.length === 0) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Trash item ID(s) or emptyAll flag is required',
            })
        }

        for (const targetId of targetIds) {
            await permanentlyDeleteFromTrash(event.context.user.name, targetId)
        }
        await logActivity(event.context.user.name, 'PERMANENT_DELETE', 'Trash', `Deleted ${targetIds.length} item(s) permanently`, event)

        return { success: true, count: targetIds.length }
    } catch (error: any) {
        console.error('Error deleting from trash:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not delete item from trash',
        })
    }
})
