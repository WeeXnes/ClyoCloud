import { defineEventHandler, createError, readBody } from 'h3'
import { revokeDevice, getDevicesForUser } from '../utils/devices'
import { logActivity } from '../utils/activityLogger'

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    try {
        const body = await readBody(event)
        const { id } = body
        if (!id) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Bad Request: Device ID required',
            })
        }

        const username = event.context.user.name
        
        // Find device model for logging before revoking
        const devices = await getDevicesForUser(username)
        const device = devices.find(d => d.id === id)
        const deviceName = device ? device.model : 'Unknown Device'

        const success = await revokeDevice(id, username)
        if (!success) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Device not found or not owned by you',
            })
        }

        // Log device revocation
        await logActivity(username, 'DEVICE_REVOKE', deviceName, `Device revoked: ${deviceName}`, event)

        return { success: true }
    } catch (err: any) {
        if (err.statusCode) throw err
        console.error('Error revoking device:', err)
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to revoke device',
        })
    }
})
