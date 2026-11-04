import { defineEventHandler, createError } from 'h3'
import { getUserStorageMap } from '~/server/utils/storageStats'

/**
 * Size breakdown of the user's storage. Never blocks on a cold scan for long: it answers with
 * the last known map (or an empty one) plus `pending: true` while the scan runs in the background.
 */
export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    try {
        const result = await getUserStorageMap(event.context.user.name, 1000)
        const map = result.value ?? { name: 'root', size: 0 }
        return { ...map, pending: result.pending, ready: result.value !== undefined }
    } catch (error) {
        console.error('Error generating storage map:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not generate storage map',
        })
    }
})
