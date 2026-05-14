import { defineEventHandler, getRouterParam, createError, sendProxy } from 'h3'
import { getTvheadendConfig } from '~/server/utils/tvheadend'

export default defineEventHandler(async (event) => {
    const user = event.context.user
    if (!user || !user.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    const channelId = getRouterParam(event, 'channelId')
    if (!channelId) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Channel ID is required',
        })
    }

    const config = await getTvheadendConfig(user.name)
    if (!config) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Tvheadend not configured',
        })
    }

    const { host, port, user: tvUser, pass: tvPass } = config
    
    // Request MKV stream from Tvheadend (better browser support than MPEG-TS)
    const targetUrl = `http://${host}:${port}/stream/channelid/${channelId}?profile=mkv`
    const auth = Buffer.from(`${tvUser}:${tvPass}`).toString('base64')
    
    console.log(`[Tvheadend] Proxying stream for channel ${channelId} (MKV)`)

    return sendProxy(event, targetUrl, {
        sendStream: true,
        fetchOptions: {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        },
        onResponse(e, response) {
            // Force a browser-friendly MIME type if Tvheadend doesn't provide one
            // Modern browsers support MKV better than the default MPEG-TS
            setHeader(e, 'Content-Type', 'video/x-matroska')
            setHeader(e, 'Accept-Ranges', 'none') // Streams don't usually support range requests
        }
    })
})
