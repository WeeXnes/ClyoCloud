import { defineEventHandler, getQuery, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { Video, FileMeta, ShortMedia, SlideshowMedia } from '~/types/File'
import { isPathWithin } from '~/server/utils/fileUtils'
import { mediaCache, mediaCacheKey, setMediaCache } from '~/server/utils/mediaCache'

// Changes made through ClyoCloud and by the storage watcher clear the cache, so it can live long
const CACHE_TTL = 10 * 60 * 1000;
// How long a request waits for a rescan before answering with the last known list
const MAX_WAIT_FOR_RESCAN_MS = 4000;

// Last completed scan per user and folder. Unlike mediaCache it survives invalidation, so a
// request can be answered at once while a fresh scan runs, instead of waiting for a full walk.
const lastScan = new Map<string, ShortMedia[]>();
const scansInFlight = new Map<string, Promise<ShortMedia[]>>();

function scanShared(cacheKey: string, fullPath: string, userStoragePath: string): Promise<ShortMedia[]> {
    const running = scansInFlight.get(cacheKey);
    if (running) return running;
    const scan = scanMedia(fullPath, userStoragePath)
        .then((items) => {
            setMediaCache(cacheKey, items);
            lastScan.delete(cacheKey);
            if (lastScan.size >= 200) lastScan.delete(lastScan.keys().next().value as string);
            lastScan.set(cacheKey, items);
            return items;
        })
        .finally(() => scansInFlight.delete(cacheKey));
    scansInFlight.set(cacheKey, scan);
    return scan;
}

/** Fresh cache, else a rescan that finishes quickly, else the last known list, else wait for the first scan. */
async function getMedia(cacheKey: string, fullPath: string, userStoragePath: string): Promise<ShortMedia[]> {
    const cached = mediaCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.items;

    const scan = scanShared(cacheKey, fullPath, userStoragePath);
    const previous = lastScan.get(cacheKey);
    if (!previous) return scan;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), MAX_WAIT_FOR_RESCAN_MS); });
    const result = await Promise.race([scan, timeout]);
    clearTimeout(timer);
    return result ?? previous;
}

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
            if (!isPathWithin(userStoragePath, currentPath) && currentPath !== userStoragePath) return;

            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            const imagesInThisDir: string[] = [];

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                const ext = path.extname(entry.name).toLowerCase();

                if (entry.isDirectory()) {
                    // Skip .trash and other hidden folders: their contents are not part of the library
                    if (entry.name.startsWith('.')) continue;
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
            }

            // If this directory has 4+ images, it's a slideshow candidate
            if (imagesInThisDir.length >= 4) {
                const relativeDirPath = path.relative(userStoragePath, currentPath).replace(/\\/g, '/');
                const dirName = path.basename(currentPath) || 'Root';

                // Get folder meta if exists
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
                    allImages: imagesInThisDir,
                    meta: meta || { tags: [] },
                    lastModified: Date.now(),
                });
            }
        } catch (error) {
            console.error(`Error scanning ${currentPath}:`, error);
        }
    }

    await scanDir(directoryPath);
    console.log(`Scan complete: Found ${items.filter(i => i.type === 'video').length} videos and ${items.filter(i => i.type === 'slideshow').length} slideshows.`);
    return items;
}

export default defineEventHandler(async (event): Promise<ShortMedia[]> => {
    try {
        if (!event.context.user || !event.context.user.name) {
            throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
        }

        const username = event.context.user.name;
        let items: ShortMedia[] = [];
        const config = useRuntimeConfig();
        const userStoragePath = path.join(config.storagePath, username);
        const pathQuery = getQuery(event).path;
        const subPath = pathQuery ? pathQuery.toString() : '';
        const safeSubPath = path.normalize(subPath).replace(/^(\.\.(\/|\\|$))+/, '');
        const fullPath = path.join(userStoragePath, safeSubPath);

        if (!isPathWithin(userStoragePath, fullPath)) {
            throw createError({ statusCode: 403, statusMessage: 'Access denied' });
        }

        // Keyed by sub-path too: a scan of one folder must not answer requests for another
        const cacheKey = mediaCacheKey(username, path.relative(userStoragePath, fullPath));
        items = await getMedia(cacheKey, fullPath, userStoragePath);

        const query = getQuery(event);
        const search = query.search ? query.search.toString().toLowerCase() : '';
        if (search) {
            items = items.filter(v => 
                v.name.toLowerCase().includes(search) || 
                v.meta.tags.some(t => t.name.toLowerCase().includes(search))
            );
        }

        const usersData = await fs.readFile(config.usersFilePath, 'utf-8');
        const users = JSON.parse(usersData);
        const userData = users.find((u: any) => u.name === username);

        if (query.shuffle === 'true') {
            // Apply path selections
            const selectedPaths = userData?.selectedShortsPaths || [];

            if (selectedPaths.length > 0) {
                items = items.filter(item => selectedPaths.some((selected: string) => 
                    item.fullPath === selected || item.fullPath.startsWith(selected + '/')
                ));
            } else {
                items = [];
            }

            const videos = items.filter(i => i.type === 'video');
            const slideshows = items.filter(i => i.type === 'slideshow') as SlideshowMedia[];
            const shuffledVideos = [...videos].sort(() => Math.random() - 0.5);
            const shuffledSlideshows = [...slideshows].sort(() => Math.random() - 0.5);
            const frequency = userData?.slideshowFrequency || 5;

            const result: ShortMedia[] = [];
            const limitVal = query.limit ? parseInt(query.limit.toString()) : 200;
            const targetLimit = limitVal > 0 ? Math.min(limitVal, 200) : 200;

            if (shuffledVideos.length > 0 || shuffledSlideshows.length > 0) {
                let videoIdx = 0;
                let slideshowIdx = 0;

                while (result.length < targetLimit) {
                    const nextIsSlideshow = (result.length + 1) % frequency === 0 || shuffledVideos.length === 0;

                    if (nextIsSlideshow && shuffledSlideshows.length > 0) {
                        if (slideshowIdx >= shuffledSlideshows.length) {
                            shuffledSlideshows.sort(() => Math.random() - 0.5);
                            slideshowIdx = 0;
                        }
                        const candidate = shuffledSlideshows[slideshowIdx];
                        slideshowIdx++;

                        const allImages = candidate.allImages || candidate.images;
                        if (allImages && allImages.length >= 4) {
                            const count = Math.min(allImages.length, Math.floor(Math.random() * 7) + 4);
                            const shuffled = [...allImages].sort(() => Math.random() - 0.5);

                            result.push({
                                type: 'slideshow',
                                name: candidate.name,
                                fullPath: candidate.fullPath,
                                images: shuffled.slice(0, count),
                                meta: candidate.meta,
                                lastModified: Date.now() + result.length
                            });
                        } else {
                            result.push(candidate);
                        }
                    } else if (shuffledVideos.length > 0) {
                        if (videoIdx >= shuffledVideos.length) {
                            shuffledVideos.sort(() => Math.random() - 0.5);
                            videoIdx = 0;
                        }
                        const video = shuffledVideos[videoIdx];
                        videoIdx++;
                        result.push(video);
                    } else {
                        break;
                    }
                }
            }

            items = result;
            console.log(`Feed generated (Frequency: ${frequency}): ${items.filter(i => i.type === 'video').length} videos, ${items.filter(i => i.type === 'slideshow').length} slideshows (Total: ${items.length})`);
        } else {
            items = items.filter(i => i.type === 'video');
            
            // Apply path exclusions for the Media tab
            const excludedPaths = userData?.excludedMediaPaths || [];
            if (excludedPaths.length > 0) {
                items = items.filter(item => !excludedPaths.some((excluded: string) => 
                    item.fullPath === excluded || item.fullPath.startsWith(excluded + '/')
                ));
            }
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