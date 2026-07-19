import { defineEventHandler, createError, getQuery } from 'h3'
import { createRequire } from 'module'
import { v4 as uuidv4 } from 'uuid'
import jwt from 'jsonwebtoken'
import { addDevice } from '../utils/devices'
import { logActivity } from '../utils/activityLogger'

const require = createRequire(import.meta.url)
const QRCode = require('qrcode')

export default defineEventHandler(async (event) => {
    // Check if the user is authenticated in the middleware
    if (!event.context.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized: User context missing' })
    }

    const config = useRuntimeConfig()
    const username = event.context.user.name

    const query = getQuery(event)
    const origin = (query.origin as string) || `http://${event.node.req.headers.host}`

    // Generate a unique device session
    const deviceId = uuidv4()
    const deviceToken = jwt.sign(
        { 
            user: { name: username },
            deviceId: deviceId,
            isDevice: true
        }, 
        config.jwtSecret, 
        { expiresIn: '365d' } // Device tokens valid for 365 days
    )

    // Save device to registry as pending scan
    await addDevice(deviceId, username, 'Pending Connection...')

    // Log QR Code generation
    await logActivity(username, 'QR_GENERATE', 'Settings', 'Quick Login QR Code generated', event)

    const payload = {
        serverUrl: origin,
        username: username,
        token: deviceToken
    }

    try {
        const qrCodeUrl = await QRCode.toDataURL(JSON.stringify(payload))
        return {
            qrCodeUrl
        }
    } catch (err: any) {
        console.error('Error generating login QR code:', err)
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to generate QR code'
        })
    }
})
