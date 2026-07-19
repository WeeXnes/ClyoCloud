import { defineEventHandler, readBody, createError } from 'h3'
import { revokeDevice } from '../utils/deviceRegistry'

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const body = await readBody(event)
    const { deviceId } = body

    if (!deviceId || typeof deviceId !== 'string') {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request: deviceId is required',
        })
    }

    const revoked = await revokeDevice(event.context.user.name, deviceId)

    if (!revoked) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Device not found',
        })
    }

    return { success: true }
})
