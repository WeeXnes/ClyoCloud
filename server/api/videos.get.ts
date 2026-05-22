import { defineEventHandler, getQuery, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { Video, FileMeta } from '~/types/File'

// Simple in-memory cache for video scans
const videoCache = new Map<string, { videos: Video[]; timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 seconds cache

/**
 * Recursively scans a directory for MP4 files and returns an array of Video objects with relative paths
 * @param directoryPath - The root directory to scan
 * @param userStoragePath - The user's root directory to restrict access and compute relative paths
 * @returns Promise<Video[]> - Array of Video objects
 */
async function scanMp4Files(directoryPath: string, userStoragePath: string): Promise<Video[]> {
    const videos: Video[] = [];

    async function scanDir(currentPath: string): Promise<void> {
        try {
            // Ensure path is within user's directory
            if (!currentPath.startsWith(userStoragePath)) {
                console.error(`Access denied: Resolved path ${currentPath} is outside user directory ${userStoragePath}`);
                return;
            }

            const entries = await fs.readdir(currentPath, { withFileTypes: true });

            await Promise.all(entries.map(async (entry) => {
                const fullPath = path.join(currentPath, entry.name);

                if (entry.isDirectory()) {
                    // Recursively scan subdirectories
                    await scanDir(fullPath);
                } else if (entry.isFile() && (entry.name.toLowerCase().endsWith('.mp4') || entry.name.toLowerCase().endsWith('.webm') || entry.name.toLowerCase().endsWith('.mov') || entry.name.toLowerCase().endsWith('.mkv'))) {
                    // Process supported video files
                    const stats = await fs.stat(fullPath);
                    const cloudInfoFileName = `${entry.name}.cloudinfo`;
                    const cloudInfoPath = path.join(currentPath, cloudInfoFileName);
                    let meta: FileMeta = { tags: [] };

                    try {
                        const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8');
                        meta = JSON.parse(cloudInfoContent) as FileMeta
                        if (!meta.tags || !Array.isArray(meta.tags)) {
                            meta.tags = [];
                        }
                    } catch {
                        // Skip creating/writing cloudinfo during scan for speed
                    }

                    // Compute relative path
                    const relativePath = path.relative(userStoragePath, fullPath).replace(/\\/g, '/');

                    const file: Video = {
                        name: entry.name,
                        size: stats.size,
                        lastModified: stats.mtime.getTime(),
                        meta,
                        fullPath: relativePath || entry.name, // Fallback to name if relative path is empty
                    };
                    videos.push(file);
                }
            }));
        } catch (error) {
            console.error(`Error scanning ${currentPath}:`, error);
        }
    }

    await scanDir(directoryPath);
    return videos;
}

export default defineEventHandler(async (event): Promise<Video[]> => {
    try {
        // Check if user is authenticated
        if (!event.context.user || !event.context.user.name) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized: User not authenticated',
            });
        }

        const username = event.context.user.name;
        const cached = videoCache.get(username);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
            return cached.videos;
        }

        const config = useRuntimeConfig();
        const userStoragePath = path.join(config.storagePath, username);
        const query = getQuery(event);
        const subPath = query.path ? query.path.toString() : '';

        const safeSubPath = path.normalize(subPath).replace(/^(\.\.(\/|\\|$))+/, '');
        const fullPath = path.join(userStoragePath, safeSubPath);

        // Ensure path is within user's directory
        if (!fullPath.startsWith(userStoragePath)) {
            console.error(`Access denied: Resolved path ${fullPath} is outside user directory ${userStoragePath}`);
            throw createError({
                statusCode: 403,
                statusMessage: 'Access denied: Path outside user directory',
            });
        }

        // Scan for MP4 files
        let videos = await scanMp4Files(fullPath, userStoragePath);

        // Sort videos by name
        videos = videos.sort((a, b) => a.name.localeCompare(b.name));

        // Update cache
        videoCache.set(username, { videos, timestamp: Date.now() });

        // Apply server-side search if provided
        const search = query.search ? query.search.toString().toLowerCase() : '';
        if (search) {
            videos = videos.filter(v => 
                v.name.toLowerCase().includes(search) || 
                v.meta.tags.some(t => t.name.toLowerCase().includes(search))
            );
        }

        // Apply shuffle if requested
        if (query.shuffle === 'true') {
            videos = [...videos].sort(() => Math.random() - 0.5);
        }

        // Apply pagination
        const page = parseInt(query.page?.toString() || '0');
        const limit = parseInt(query.limit?.toString() || '0');

        if (page > 0 && limit > 0) {
            const start = (page - 1) * limit;
            return {
                items: videos.slice(start, start + limit),
                total: videos.length
            } as any;
        }

        return videos;
    } catch (error: any) {
        console.error('Error reading videos:', error);
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not list videos',
        });
    }
});