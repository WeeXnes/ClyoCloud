import { defineEventHandler, createError } from 'h3'
import { getDevicesForUser } from '../utils/devices'

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    try {
        const username = event.context.user.name
        const devices = await getDevicesForUser(username)
        return devices
    } catch (err) {
        console.error('Error listing devices:', err)
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to list devices',
        })
    }
})
