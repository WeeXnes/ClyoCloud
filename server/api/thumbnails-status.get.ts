import { defineEventHandler, createError } from 'h3'
import { getThumbnailTaskStatus } from '~/server/utils/previewTask'

export default defineEventHandler(async (event) => {
    const user = event.context.user

    if (!user || !user.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    return getThumbnailTaskStatus(user.name)
})
