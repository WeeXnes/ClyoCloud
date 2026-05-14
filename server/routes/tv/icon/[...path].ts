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

    const path = getRouterParam(event, 'path')
    if (!path) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Icon path is required',
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
    
    const targetUrl = `http://${host}:${port}/${path}`
    const auth = Buffer.from(`${tvUser}:${tvPass}`).toString('base64')
    
    return sendProxy(event, targetUrl, {
        fetchOptions: {
            headers: {
                'Authorization': `Basic ${auth}`
            }
        }
    })
})
