import { defineEventHandler, createError, readBody } from 'h3'
import { stopCloudRecording } from '~/server/utils/tvRecorder'
import { logActivity } from '../utils/activityLogger'

export default defineEventHandler(async (event) => {
    const user = event.context.user
    if (!user || !user.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const { channelUuid } = await readBody(event)
    if (!channelUuid) {
        throw createError({ statusCode: 400, statusMessage: 'Channel UUID is required' })
    }

    try {
        return stopCloudRecording(user.name, channelUuid)
    } catch (error: any) {
        throw createError({ statusCode: 500, statusMessage: error.message })
    }
})
