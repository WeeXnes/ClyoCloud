import { defineEventHandler, createError } from 'h3'
import { getActiveRecordings } from '~/server/utils/tvRecorder'

export default defineEventHandler(async (event) => {
    const user = event.context.user
    if (!user || !user.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    try {
        return { entries: getActiveRecordings(user.name) }
    } catch (error: any) {
        throw createError({ statusCode: 500, statusMessage: error.message })
    }
})
