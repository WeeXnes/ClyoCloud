import { defineEventHandler, createError } from 'h3'
import { getDuplicateTaskStatus } from '~/server/utils/duplicateTask'

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    return getDuplicateTaskStatus(event.context.user.name)
})
