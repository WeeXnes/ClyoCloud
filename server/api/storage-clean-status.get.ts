import { defineEventHandler, createError } from 'h3'
import { getCleanupTaskStatus } from '~/server/utils/cleanupTask'

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    return getCleanupTaskStatus(event.context.user.name)
})
