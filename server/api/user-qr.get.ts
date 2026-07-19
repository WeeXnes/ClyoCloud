import { defineEventHandler, getCookie, createError, getQuery } from 'h3'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const QRCode = require('qrcode')

export default defineEventHandler(async (event) => {
    // Check if the user is authenticated in the middleware
    if (!event.context.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized: User context missing' })
    }

    const token = getCookie(event, 'token')
    if (!token) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized: No token cookie found' })
    }

    const query = getQuery(event)
    const origin = (query.origin as string) || `http://${event.node.req.headers.host}`

    const payload = {
        serverUrl: origin,
        username: event.context.user.name,
        token: token
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
