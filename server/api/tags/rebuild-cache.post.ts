import { defineEventHandler, createError } from 'h3'
import { reconcileUser } from '~/server/utils/tagCache'
import { clearUserCache } from '~/server/utils/fileUtils'
import { rescanAllUsers } from '~/server/utils/storageWatcher'

/**
 * Rescans storage and rebuilds every cache derived from it: tags, wallpapers, favourites and sizes.
 * Users rescan their own storage; an admin rescans everyone.
 */
export default defineEventHandler(async (event) => {
    const user = event.context.user
    if (!user?.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    try {
        if (user.isAdmin) {
            await rescanAllUsers()
        } else {
            clearUserCache(user.name)
            await reconcileUser(user.name)
        }
        return { success: true, message: 'Caches rebuilt' }
    } catch (error: any) {
        console.error('Error rebuilding caches:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not rebuild caches',
        })
    }
})
