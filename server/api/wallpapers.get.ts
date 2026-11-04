import { defineEventHandler, getQuery, createError } from 'h3'
import type { File } from '~/types/File'
import { wallpapersIndex } from '~/server/utils/wallpapers'
import { listIndexedFiles } from '~/server/utils/indexedFiles'

/**
 * The user's wallpapers, checked against the disk. `?sync=true` rescans the storage first,
 * picking up files marked or removed outside ClyoCloud.
 */
export default defineEventHandler(async (event): Promise<File[]> => {
    if (!event.context.user?.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    const query = getQuery(event)
    const sync = query.sync === 'true' || query.sync === '1'

    try {
        return await listIndexedFiles(event.context.user.name, wallpapersIndex, meta => meta.isWallpaper, { sync })
    } catch (error) {
        console.error('Error fetching wallpapers:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not fetch wallpapers',
        })
    }
})
