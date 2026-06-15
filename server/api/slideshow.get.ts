import { defineEventHandler, getQuery, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { SlideshowItem, FileMeta } from '~/types/File'

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.mkv'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

async function scanMediaForSlideshow(directoryPath: string, userStoragePath: string): Promise<SlideshowItem[]> {
    const items: SlideshowItem[] = [];

    async function scanDir(currentPath: string): Promise<void> {
        try {
            if (!currentPath.startsWith(userStoragePath)) return;

            const entries = await fs.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                const ext = path.extname(entry.name).toLowerCase();

                if (entry.isDirectory()) {
                    await scanDir(fullPath);
                } else if (entry.isFile()) {
                    const relativePath = path.relative(userStoragePath, fullPath).replace(/\\/g, '/');
                    
                    if (VIDEO_EXTENSIONS.includes(ext)) {
                        const stats = await fs.stat(fullPath);
                        const cloudInfoPath = path.join(currentPath, `${entry.name}.cloudinfo`);
                        let meta: FileMeta = { tags: [] };
                        try {
                            const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8');
                            meta = JSON.parse(cloudInfoContent) as FileMeta;
                        } catch {}

                        items.push({
                            type: 'video',
                            name: entry.name,
                            fullPath: relativePath,
                            meta: meta || { tags: [] },
                            lastModified: stats.mtime.getTime(),
                        });
                    } else if (IMAGE_EXTENSIONS.includes(ext)) {
                        const stats = await fs.stat(fullPath);
                        const cloudInfoPath = path.join(currentPath, `${entry.name}.cloudinfo`);
                        let meta: FileMeta = { tags: [] };
                        try {
                            const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8');
                            meta = JSON.parse(cloudInfoContent) as FileMeta;
                        } catch {}

                        items.push({
                            type: 'image',
                            name: entry.name,
                            fullPath: relativePath,
                            meta: meta || { tags: [] },
                            lastModified: stats.mtime.getTime(),
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Error scanning ${currentPath}:`, error);
        }
    }

    await scanDir(directoryPath);
    return items;
}

export default defineEventHandler(async (event): Promise<SlideshowItem[]> => {
    try {
        if (!event.context.user || !event.context.user.name) {
            throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
        }

        const username = event.context.user.name;
        const query = getQuery(event);
        const pathsStr = query.paths ? query.paths.toString() : '';
        const paths = pathsStr.split(',').filter(p => p.trim() !== '');

        if (paths.length === 0) {
            return [];
        }

        const config = useRuntimeConfig();
        const userStoragePath = path.join(config.storagePath, username);
        let allItems: SlideshowItem[] = [];

        for (const subPath of paths) {
            const safeSubPath = path.normalize(subPath).replace(/^(\.\.(\/|\\|$))+/, '');
            const fullPath = path.join(userStoragePath, safeSubPath);

            if (!fullPath.startsWith(userStoragePath)) {
                continue; // Skip invalid paths
            }

            const items = await scanMediaForSlideshow(fullPath, userStoragePath);
            allItems = allItems.concat(items);
        }

        if (query.shuffle === 'true') {
            allItems.sort(() => Math.random() - 0.5);
        }

        return allItems;
    } catch (error: any) {
        console.error('Error generating slideshow:', error);
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not generate slideshow',
        });
    }
});
