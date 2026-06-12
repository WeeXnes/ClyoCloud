import { defineEventHandler, getQuery, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { Video, FileMeta, ShortMedia, SlideshowMedia } from '~/types/File'

// Simple in-memory cache for media scans
const mediaCache = new Map<string, { items: ShortMedia[]; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds cache

const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.mkv'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/**
 * Recursively scans a directory for videos and image-folders (slideshows)
 * @param directoryPath - The root directory to scan
 * @param userStoragePath - The user's root directory to restrict access and compute relative paths
 * @returns Promise<ShortMedia[]> - Array of Video and SlideshowMedia objects
 */
async function scanMedia(directoryPath: string, userStoragePath: string): Promise<ShortMedia[]> {
    const items: ShortMedia[] = [];

    async function scanDir(currentPath: string): Promise<void> {
        try {
            if (!currentPath.startsWith(userStoragePath)) return;

            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            const imagesInThisDir: string[] = [];

            await Promise.all(entries.map(async (entry) => {
                const fullPath = path.join(currentPath, entry.name);
                const ext = path.extname(entry.name).toLowerCase();

                if (entry.isDirectory()) {
                    await scanDir(fullPath);
                } else if (entry.isFile()) {
                    if (VIDEO_EXTENSIONS.includes(ext)) {
                        const stats = await fs.stat(fullPath);
                        const cloudInfoPath = path.join(currentPath, `${entry.name}.cloudinfo`);
                        let meta: FileMeta = { tags: [] };

                        try {
                            const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8');
                            meta = JSON.parse(cloudInfoContent) as FileMeta;
                        } catch {}

                        const relativePath = path.relative(userStoragePath, fullPath).replace(/\\/g, '/');
                        items.push({
                            type: 'video',
                            name: entry.name,
                            size: stats.size,
                            lastModified: stats.mtime.getTime(),
                            meta: meta || { tags: [] },
                            fullPath: relativePath || entry.name,
                        });
                    } else if (IMAGE_EXTENSIONS.includes(ext)) {
                        imagesInThisDir.push(path.relative(userStoragePath, fullPath).replace(/\\/g, '/'));
                    }
                }
            }));

            // If this directory has 4+ images, it's a slideshow candidate
            if (imagesInThisDir.length >= 4) {
                const relativeDirPath = path.relative(userStoragePath, currentPath).replace(/\\/g, '/');
                const dirName = path.basename(currentPath) || 'Root';

                // Get folder meta if exists (consistent with file-meta.post.ts)
                const cloudInfoPath = `${currentPath}.cloudinfo`;
                let meta: FileMeta = { tags: [] };
                try {
                    const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8');
                    meta = JSON.parse(cloudInfoContent) as FileMeta;
                } catch {}

                // Pick 4-10 random images
                const count = Math.min(imagesInThisDir.length, Math.floor(Math.random() * 7) + 4);
                const shuffledImages = [...imagesInThisDir].sort(() => Math.random() - 0.5);

                items.push({
                    type: 'slideshow',
                    name: `Slideshow: ${dirName}`,
                    fullPath: relativeDirPath || '.',
                    images: shuffledImages.slice(0, count),
                    meta: meta || { tags: [] },
                    lastModified: Date.now(), // Slideshows are virtual objects
                });
            }
        } catch (error) {
            console.error(`Error scanning ${currentPath}:`, error);
        }
    }

    await scanDir(directoryPath);
    return items;
}

export default defineEventHandler(async (event): Promise<ShortMedia[]> => {
    try {
        if (!event.context.user || !event.context.user.name) {
            throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
        }

        const username = event.context.user.name;
        let items: ShortMedia[] = [];
        const cached = mediaCache.get(username);

        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            items = cached.items;
        } else {
            const config = useRuntimeConfig();
            const userStoragePath = path.join(config.storagePath, username);
            const query = getQuery(event);
            const subPath = query.path ? query.path.toString() : '';

            const safeSubPath = path.normalize(subPath).replace(/^(\.\.(\/|\\|$))+/, '');
            const fullPath = path.join(userStoragePath, safeSubPath);

            if (!fullPath.startsWith(userStoragePath)) {
                throw createError({ statusCode: 403, statusMessage: 'Access denied' });
            }

            items = await scanMedia(fullPath, userStoragePath);
            mediaCache.set(username, { items, timestamp: Date.now() });
        }

        const query = getQuery(event);
        const search = query.search ? query.search.toString().toLowerCase() : '';
        if (search) {
            items = items.filter(v => 
                v.name.toLowerCase().includes(search) || 
                v.meta.tags.some(t => t.name.toLowerCase().includes(search))
            );
        }

        if (query.shuffle === 'true') {
            const videos = items.filter(i => i.type === 'video');
            const slideshows = items.filter(i => i.type === 'slideshow');

            // Limit slideshows to 20% of the feed or max 20 items
            const slideshowLimit = Math.min(20, Math.floor(videos.length * 0.25));
            const selectedSlideshows = slideshows.sort(() => Math.random() - 0.5).slice(0, slideshowLimit);

            items = [...videos, ...selectedSlideshows].sort(() => Math.random() - 0.5);
        }

        const page = parseInt(query.page?.toString() || '0');
        const limit = parseInt(query.limit?.toString() || '0');

        if (page > 0 && limit > 0) {
            const start = (page - 1) * limit;
            return {
                items: items.slice(start, start + limit),
                total: items.length
            } as any;
        }

        return items;
    } catch (error: any) {
        console.error('Error reading media:', error);
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not list media',
        });
    }
});