import { defineEventHandler, getQuery, createError } from 'h3'
import path from 'path'
import { scanFilesByTag } from '~/server/utils/fileUtils'
import type { File } from '~/types/File'

export default defineEventHandler(async (event): Promise<File[]> => {
    try {
        if (!event.context.user || !event.context.user.name) {
            throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
        }

        const username = event.context.user.name;
        const query = getQuery(event);
        const tag = query.tag ? query.tag.toString() : '';

        if (!tag) {
            throw createError({ statusCode: 400, statusMessage: 'Tag parameter is required' });
        }

        const config = useRuntimeConfig();
        const userStoragePath = path.join(config.storagePath, username);

        const files = await scanFilesByTag(userStoragePath, userStoragePath, tag);

        return files;
    } catch (error: any) {
        console.error('Error fetching files by tag:', error);
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not fetch files by tag',
        });
    }
});
