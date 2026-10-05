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
        const { id, emptyAll } = body || {}

        if (emptyAll === true) {
            const count = await emptyTrash(event.context.user.name)
            await logActivity(event.context.user.name, 'EMPTY_TRASH', 'Trash', `Purged ${count} items permanently`, event)
            return { success: true, count }
        }

        if (!id) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Trash item ID or emptyAll flag is required',
            })
        }

        await permanentlyDeleteFromTrash(event.context.user.name, id)
        await logActivity(event.context.user.name, 'PERMANENT_DELETE', id, 'Deleted permanently from trash', event)

        return { success: true }
    } catch (error: any) {
        console.error('Error deleting from trash:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not delete item from trash',
        })
    }
})
