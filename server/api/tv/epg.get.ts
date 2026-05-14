import { defineEventHandler, createError } from 'h3'
import { getTvheadendConfig, getEpg } from '~/server/utils/tvheadend'

export default defineEventHandler(async (event) => {
    const user = event.context.user
    if (!user || !user.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    const config = await getTvheadendConfig(user.name)
    if (!config) {
        return { entries: [] }
    }

    try {
        return await getEpg(config)
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            statusMessage: error.message || 'Failed to fetch EPG from Tvheadend',
        })
    }
})
