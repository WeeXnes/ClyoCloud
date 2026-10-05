import { defineEventHandler, createError } from 'h3'
import { listTrash } from '~/server/utils/trash'

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    try {
        const items = await listTrash(event.context.user.name)
        return { items }
    } catch (error: any) {
        console.error('Error listing trash:', error)
        throw createError({
            statusCode: 500,
            statusMessage: error.message || 'Could not load trash',
        })
    }
})
