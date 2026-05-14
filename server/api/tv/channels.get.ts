import { defineEventHandler, createError } from 'h3'
import { getTvheadendConfig, getChannels } from '~/server/utils/tvheadend'

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
        return { entries: [] } // Or throw error? Returning empty list is safer for UI
    }

    try {
        return await getChannels(config)
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            statusMessage: error.message || 'Failed to fetch channels from Tvheadend',
        })
    }
})
