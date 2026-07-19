import { defineEventHandler, createError } from 'h3'
import { getDevices } from '../utils/deviceRegistry'

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const devices = await getDevices(event.context.user.name)
    return { devices }
})
