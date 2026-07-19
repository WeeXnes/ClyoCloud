import { defineEventHandler, createError, getQuery } from 'h3'
import { createRequire } from 'module'
import jwt from 'jsonwebtoken'
import { registerDevice } from '../utils/deviceRegistry'

const require = createRequire(import.meta.url)
const QRCode = require('qrcode')

export default defineEventHandler(async (event) => {
    // Check if the user is authenticated in the middleware
    if (!event.context.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized: User context missing' })
    }

    const username = event.context.user.name
    const config = useRuntimeConfig()

    const query = getQuery(event)
    const origin = (query.origin as string) || `http://${event.node.req.headers.host}`

    // Generate a unique device ID and register it in the device store
    const deviceId = await registerDevice(username)

    // Sign a new device-bound JWT (separate from the user's browser session)
    const deviceToken = jwt.sign(
        { user: { name: username }, deviceId },
        config.jwtSecret,
        { expiresIn: '30d' }
    )

    const payload = {
        serverUrl: origin,
        username,
        token: deviceToken,
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

