import fs from 'fs/promises'
import path from 'path'

const sizeCache = new Map<string, { size: number; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes cache for dir sizes

export async function getDirSize(dirPath: string): Promise<number> {
    const cached = sizeCache.get(dirPath)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.size
    }

    let totalSize = 0
    try {
        const files = await fs.readdir(dirPath, { withFileTypes: true })
        const sizes = await Promise.all(files.map(async (file) => {
            const filePath = path.join(dirPath, file.name)
            if (file.isDirectory()) {
                return await getDirSize(filePath)
            } else if (file.isFile()) {
                const stats = await fs.stat(filePath)
                return stats.size
            }
            return 0
        }))
        totalSize = sizes.reduce((a, b) => a + b, 0)
        sizeCache.set(dirPath, { size: totalSize, timestamp: Date.now() })
    } catch (err) {}
    return totalSize
}

/**
 * Force clear the directory size cache for a specific path (useful when files are added/deleted)
 */
export function clearSizeCache(dirPath: string) {
    sizeCache.delete(dirPath)
    // Also clear parent caches as their sizes are now invalid
    const parentPath = path.dirname(dirPath)
    if (parentPath && parentPath !== dirPath) {
        clearSizeCache(parentPath)
    }
}

export const storageMapCache = new Map<string, { data: any; timestamp: number }>()

/**
 * Clear sizeCache and storageMapCache for a specific user.
 */
export function clearUserCache(username: string) {
    try {
        const config = useRuntimeConfig()
        const userStoragePath = path.resolve(path.join(config.storagePath, username))
        
        for (const key of sizeCache.keys()) {
            const resolvedKey = path.resolve(key)
            if (resolvedKey === userStoragePath || resolvedKey.startsWith(userStoragePath + path.sep)) {
                sizeCache.delete(key)
            }
        }
    } catch (e) {
        // Fallback if useRuntimeConfig is not available
        for (const key of sizeCache.keys()) {
            const parts = key.split(path.sep)
            if (parts.includes(username)) {
                sizeCache.delete(key)
            }
        }
    }
    
    // Clear storage map cache
    storageMapCache.delete(username)
}

import type { File, FileMeta } from '~/types/File'

/**
 * Recursively scans a directory for files matching a specific tag
 * @param directoryPath - The root directory to scan
 * @param userStoragePath - The user's root directory to restrict access and compute relative paths
 * @param tagName - The tag name to filter by
 * @returns Promise<File[]> - Array of File objects
 */
export async function scanFilesByTag(directoryPath: string, userStoragePath: string, tagName: string): Promise<File[]> {
    const items: File[] = [];

    async function scanDir(currentPath: string): Promise<void> {
        try {
            if (!currentPath.startsWith(userStoragePath)) return;

            const entries = await fs.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                
                if (entry.isDirectory()) {
                    // Check if the folder itself has the tag
                    const cloudInfoPath = `${fullPath}.cloudinfo`;
                    let meta: FileMeta = { tags: [] };
                    try {
                        const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8');
                        meta = JSON.parse(cloudInfoContent) as FileMeta;
                    } catch {}

                    if (meta.tags.some(t => t.name.toLowerCase() === tagName.toLowerCase())) {
                        const stats = await fs.stat(fullPath);
                        const relativePath = path.relative(userStoragePath, fullPath).replace(/\\/g, '/');
                        items.push({
                            name: relativePath,
                            size: 0, // Folders don't have a simple size
                            type: '',
                            lastModified: stats.mtime.getTime(),
                            isFolder: true,
                            meta: meta,
                        });
                    }
                    
                    await scanDir(fullPath);
                } else if (entry.isFile()) {
                    if (entry.name.endsWith('.cloudinfo') || entry.name.startsWith('.')) continue;

                    const cloudInfoPath = `${fullPath}.cloudinfo`;
                    
                    let meta: FileMeta = { tags: [] };
                    try {
                        const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8');
                        meta = JSON.parse(cloudInfoContent) as FileMeta;
                    } catch {
                        if (entry.name.length > 100) {
                            try {
                                const legacyPath = path.join(currentPath, `${entry.name.substring(0, 100)}.cloudinfo`);
                                const cloudInfoContent = await fs.readFile(legacyPath, 'utf-8');
                                meta = JSON.parse(cloudInfoContent) as FileMeta;
                            } catch {
                                continue;
                            }
                        } else {
                            continue; // No cloudinfo, no tags
                        }
                    }

                    if (meta.tags.some(t => t.name.toLowerCase() === tagName.toLowerCase())) {
                        const stats = await fs.stat(fullPath);
                        const relativePath = path.relative(userStoragePath, fullPath).replace(/\\/g, '/');
                        items.push({
                            name: relativePath,
                            size: stats.size,
                            type: path.extname(entry.name),
                            lastModified: stats.mtime.getTime(),
                            isFolder: false,
                            meta: meta,
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

/**
 * Verifies that a child path is strictly inside a parent directory.
 * Resolves both paths fully to prevent symlink/relative breakouts.
 */
export function isPathWithin(parentPath: string, childPath: string): boolean {
    const resolvedParent = path.resolve(parentPath)
    const resolvedChild = path.resolve(childPath)
    const relative = path.relative(resolvedParent, resolvedChild)
    return !relative.startsWith('..') && !path.isAbsolute(relative)
}

