import fs from 'fs/promises'
import path from 'path'
import type { File, FileMeta } from '~/types/File'

// Cache structure: Map<Username, Map<TagName, File[]>>
const tagCache = new Map<string, Map<string, File[]>>();
let isInitializing = false;

/**
 * Recursively scans all user storage and builds the tag cache
 */
export async function rebuildTagCache() {
    if (isInitializing) return;
    isInitializing = true;
    console.info('Rebuilding tag cache...');
    const startTime = Date.now();

    try {
        const config = useRuntimeConfig();
        const storagePath = config.storagePath;
        
        // Ensure storage directory exists
        await fs.mkdir(storagePath, { recursive: true });
        
        const users = await fs.readdir(storagePath);

        for (const username of users) {
            const userStoragePath = path.join(storagePath, username);
            const stats = await fs.stat(userStoragePath);
            if (!stats.isDirectory()) continue;

            const userMap = new Map<string, File[]>();
            await scanDir(userStoragePath, userStoragePath, userMap);
            tagCache.set(username, userMap);
        }

        console.info(`Tag cache rebuilt in ${Date.now() - startTime}ms`);
    } catch (error) {
        console.error('Error rebuilding tag cache:', error);
    } finally {
        isInitializing = false;
    }
}

async function scanDir(currentPath: string, userStoragePath: string, userMap: Map<string, File[]>) {
    try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            
            if (entry.isDirectory()) {
                // Check folder meta
                const cloudInfoPath = `${fullPath}.cloudinfo`;
                await processMeta(fullPath, cloudInfoPath, userStoragePath, userMap, true);
                await scanDir(fullPath, userStoragePath, userMap);
            } else if (entry.isFile()) {
                if (entry.name.endsWith('.cloudinfo') || entry.name.startsWith('.')) continue;

                const cloudInfoFileName = `${entry.name.substring(0, 100)}.cloudinfo`;
                const cloudInfoPath = path.join(currentPath, cloudInfoFileName);
                await processMeta(fullPath, cloudInfoPath, userStoragePath, userMap, false);
            }
        }
    } catch (error) {
        console.error(`Error scanning directory ${currentPath}:`, error);
    }
}

async function processMeta(fullPath: string, cloudInfoPath: string, userStoragePath: string, userMap: Map<string, File[]>, isFolder: boolean) {
    try {
        const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8');
        const meta = JSON.parse(cloudInfoContent) as FileMeta;

        if (meta.tags && meta.tags.length > 0) {
            const stats = await fs.stat(fullPath);
            const relativePath = path.relative(userStoragePath, fullPath).replace(/\\/g, '/');
            const fileItem: File = {
                name: relativePath,
                size: isFolder ? 0 : stats.size,
                type: isFolder ? '' : path.extname(fullPath),
                lastModified: stats.mtime.getTime(),
                isFolder,
                meta,
            };

            for (const tag of meta.tags) {
                const tagName = tag.name.toLowerCase();
                if (!userMap.has(tagName)) {
                    userMap.set(tagName, []);
                }
                userMap.get(tagName)!.push(fileItem);
            }
        }
    } catch (error) {
        // No tags or no cloudinfo, skip
    }
}

/**
 * Gets files for a specific user and tag from cache
 */
export function getFilesByTagFromCache(username: string, tagName: string): File[] {
    const userMap = tagCache.get(username);
    if (!userMap) return [];
    return userMap.get(tagName.toLowerCase()) || [];
}

/**
 * Updates a single file's entry in the cache
 */
export async function updateFileInCache(username: string, relativePath: string, meta: FileMeta) {
    const userMap = tagCache.get(username);
    if (!userMap) return;

    // Remove file from all tag lists it was in
    for (const [tagName, files] of userMap.entries()) {
        userMap.set(tagName, files.filter(f => f.name !== relativePath));
    }

    // Add back if it has tags
    if (meta.tags && meta.tags.length > 0) {
        const config = useRuntimeConfig();
        const fullPath = path.join(config.storagePath, username, relativePath);
        try {
            const stats = await fs.stat(fullPath);
            const fileItem: File = {
                name: relativePath,
                size: stats.isDirectory() ? 0 : stats.size,
                type: stats.isDirectory() ? '' : path.extname(fullPath),
                lastModified: stats.mtime.getTime(),
                isFolder: stats.isDirectory(),
                meta,
            };

            for (const tag of meta.tags) {
                const tagName = tag.name.toLowerCase();
                if (!userMap.has(tagName)) userMap.set(tagName, []);
                userMap.get(tagName)!.push(fileItem);
            }
        } catch (err) {
            console.error(`Error updating cache for ${relativePath}:`, err);
        }
    }
}

/**
 * Removes a file or folder (and its children if folder) from the cache
 */
export function removeFileFromCache(username: string, relativePath: string) {
    const userMap = tagCache.get(username);
    if (!userMap) return;

    const normalizedPath = relativePath.replace(/\\/g, '/');

    for (const [tagName, files] of userMap.entries()) {
        userMap.set(tagName, files.filter(f => {
            const fName = f.name.replace(/\\/g, '/');
            return fName !== normalizedPath && !fName.startsWith(normalizedPath + '/');
        }));
    }
}

/**
 * Updates cache when a file/folder is renamed or moved
 */
export function moveFileInCache(username: string, oldRelativePath: string, newRelativePath: string) {
    const userMap = tagCache.get(username);
    if (!userMap) return;

    const oldNorm = oldRelativePath.replace(/\\/g, '/');
    const newNorm = newRelativePath.replace(/\\/g, '/');

    for (const [tagName, files] of userMap.entries()) {
        userMap.set(tagName, files.map(f => {
            const fName = f.name.replace(/\\/g, '/');
            if (fName === oldNorm) {
                return { ...f, name: newNorm };
            }
            if (fName.startsWith(oldNorm + '/')) {
                return { ...f, name: fName.replace(oldNorm, newNorm) };
            }
            return f;
        }));
    }
}
