import { defineEventHandler, getQuery, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { Video, FileMeta } from '~/types/File'

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
                    let meta: FileMeta;

                    try {
                        const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8');
                        meta = JSON.parse(cloudInfoContent) as FileMeta;
                        // Validate meta structure
                        if (!meta.tags || !Array.isArray(meta.tags)) {
                            meta = { tags: [] };
                        }
                    } catch {
                        meta = { tags: [] };
                        // We don't necessarily need to write the file every time it's missing during scan
                        // to avoid excessive writes, but let's keep current behavior if it's expected.
                        // Actually, writing in parallel might be risky if many files are missing.
                        // Let's only write if we actually have something to save later or on explicit demand.
                        // For now, let's skip the write during scan to speed things up.
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

        const config = useRuntimeConfig();
        const userStoragePath = path.join(config.storagePath, event.context.user.name);
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
        const videos = await scanMp4Files(fullPath, userStoragePath);

        // Sort videos by name
        return videos.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error: any) {
        console.error('Error reading videos:', error);
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not list videos',
        });
    }
});