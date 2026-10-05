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
        const { id } = body || {}

        if (!id) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Trash item ID is required',
            })
        }

        const result = await restoreFromTrash(event.context.user.name, id)
        clearUserCache(event.context.user.name)

        await logActivity(event.context.user.name, 'RESTORE', result.restoredPath, 'Restored file from trash', event)

        return { success: true, restoredPath: result.restoredPath }
    } catch (error: any) {
        console.error('Error restoring from trash:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not restore file from trash',
        })
    }
})
