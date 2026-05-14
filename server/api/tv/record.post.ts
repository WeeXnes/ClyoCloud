import { defineEventHandler, createError, readBody } from 'h3'
import { startCloudRecording } from '~/server/utils/tvRecorder'

export default defineEventHandler(async (event) => {
    const user = event.context.user
    if (!user || !user.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const { channelUuid, title, eventId } = await readBody(event)
    if (!channelUuid || !title) {
        throw createError({ statusCode: 400, statusMessage: 'Channel UUID and Title are required' })
    }

    try {
        return await startCloudRecording(user.name, channelUuid, title, eventId)
    } catch (error: any) {
        throw createError({ statusCode: 500, statusMessage: error.message })
    }
})
