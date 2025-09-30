import { defineEventHandler, getQuery, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { Video, FileMeta, Tag } from '~/types/File'

/**
 * Generates a random 20-character string
 * @returns A 20-character random string
 */
function generateRandomString(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 20; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

/**
 * Recursively scans a directory for MP4 files and returns a HashMap of UUID to Video objects
 * @param directoryPath - The root directory to scan
 * @param userStoragePath - The user's root directory to restrict access
 * @returns Promise<Map<string, Video>> - HashMap with UUID keys and Video objects
 */
async function scanMp4Files(directoryPath: string, userStoragePath: string): Promise<Map<string, Video>> {
    const fileMap = new Map<string, Video>();

    async function scanDir(currentPath: string): Promise<void> {
        try {
            // Ensure path is within user's directory
            if (!currentPath.startsWith(userStoragePath)) {
                console.error(`Access denied: Resolved path ${currentPath} is outside user directory ${userStoragePath}`);
                return;
            }

            const entries = await fs.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);

                if (entry.isDirectory()) {
                    // Recursively scan subdirectories
                    await scanDir(fullPath);
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp4')) {
                    // Process MP4 files
                    const stats = await fs.stat(fullPath);
                    const cloudInfoFileName = `${entry.name}.cloudinfo`;
                    const cloudInfoPath = path.join(currentPath, cloudInfoFileName);
                    let meta: FileMeta;

                    try {
                        await fs.access(cloudInfoPath);
                        const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8');
                        meta = JSON.parse(cloudInfoContent) as FileMeta;
                        // Validate meta structure
                        if (!meta.tags || !Array.isArray(meta.tags)) {
                            meta = { tags: [] };
                        }
                    } catch {
                        meta = { tags: [] };
                        await fs.writeFile(cloudInfoPath, JSON.stringify(meta, null, 2), 'utf-8');
                    }

                    const file: Video = {
                        name: entry.name,
                        size: stats.size,
                        lastModified: stats.mtime.getTime(),
                        meta,
                        fullPath
                    };
                    fileMap.set(generateRandomString(), file);
                }
            }
        } catch (error) {
            console.error(`Error scanning ${currentPath}:`, error);
        }
    }

    await scanDir(directoryPath);
    return fileMap;
}

export default defineEventHandler(async (event): Promise<Video[]> => {
    try {
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
        const videoMap = await scanMp4Files(fullPath, userStoragePath);

        // Convert Map to array and sort
        const videos = Array.from(videoMap.values()).sort((a, b) => {
            return a.name.localeCompare(b.name);
        });

        return videos;
    } catch (error) {
        console.error('Error reading videos:', error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not list videos',
        });
    }
});