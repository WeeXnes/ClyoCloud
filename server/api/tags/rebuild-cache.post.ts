import { defineEventHandler, createError } from 'h3'
import { rebuildTagCache } from '~/server/utils/tagCache'

export default defineEventHandler(async (event) => {
    try {
        if (!event.context.user || !event.context.user.name) {
            throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
        }

        // Only allow admins or all users? For now, any authenticated user can trigger a rebuild
        // since it's a global cache, but maybe it should be restricted.
        // Assuming any user can refresh for now.
        
        await rebuildTagCache();

        return { success: true, message: 'Tag cache rebuild started' };
    } catch (error: any) {
        console.error('Error triggering tag cache rebuild:', error);
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not rebuild tag cache',
        });
    }
});
