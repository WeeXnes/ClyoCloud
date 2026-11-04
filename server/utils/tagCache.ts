import fs from 'fs/promises'
import path from 'path'
import type { File, FileMeta } from '~/types/File'

// Cache structure: Map<Username, Map<TagName, File[]>>
const tagCache = new Map<string, Map<string, File[]>>();
let rebuildPromise: Promise<void> | null = null;
// Bumped on every single-file update, so a rebuild can tell it raced with one
const userUpdateCounters = new Map<string, number>();

/**
 * Normalizes a user-relative path the way the cache stores it: forward slashes,
 * no leading "./" or "/", no trailing "/". Clients send all of these variants.
 */
export function normalizeCachePath(relativePath: string): string {
    const normalized = path.posix.normalize(relativePath.replace(/\\/g, '/')).replace(/^(\.\/)+/, '').replace(/^\/+|\/+$/g, '');
    return normalized === '.' ? '' : normalized;
}

function markUpdated(username: string) {
    userUpdateCounters.set(username, (userUpdateCounters.get(username) ?? 0) + 1);
}

/**
 * Recursively scans all user storage and builds the tag cache.
 * Concurrent callers wait for the rebuild already running.
 */
export function rebuildTagCache(): Promise<void> {
    if (!rebuildPromise) {
        rebuildPromise = runRebuild().finally(() => {
            rebuildPromise = null;
        });
    }
    return rebuildPromise;
}

async function runRebuild() {
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
            try {
                const stats = await fs.stat(userStoragePath);
                if (!stats.isDirectory()) continue;
            } catch {
                continue;
            }

            // An update that lands mid-scan may be missing from the scan, so scan again (a few times at most)
            for (let attempt = 0; attempt < 3; attempt++) {
                const before = userUpdateCounters.get(username) ?? 0;
                const userMap = new Map<string, File[]>();
                await scanDir(userStoragePath, userStoragePath, userMap);
                tagCache.set(username, userMap);
                if ((userUpdateCounters.get(username) ?? 0) === before) break;
            }
        }

        console.info(`Tag cache rebuilt in ${Date.now() - startTime}ms`);
    } catch (error) {
        console.error('Error rebuilding tag cache:', error);
    }
}

async function scanDir(currentPath: string, userStoragePath: string, userMap: Map<string, File[]>) {
    try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            
            if (entry.isDirectory()) {
                // .trash and other hidden folders are not part of the user's files
                if (entry.name.startsWith('.')) continue;
                // Check folder meta
                const cloudInfoPath = `${fullPath}.cloudinfo`;
                await processMeta(fullPath, cloudInfoPath, userStoragePath, userMap, true);
                await scanDir(fullPath, userStoragePath, userMap);
            } else if (entry.isFile()) {
                if (entry.name.endsWith('.cloudinfo') || entry.name.startsWith('.')) continue;

                const cloudInfoPath = `${fullPath}.cloudinfo`;
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
export async function updateFileInCache(username: string, rawRelativePath: string, meta: FileMeta) {
    markUpdated(username);
    const relativePath = normalizeCachePath(rawRelativePath);
    let userMap = tagCache.get(username);
    if (!userMap) {
        // A user created after startup has no map yet; their storage started empty
        userMap = new Map<string, File[]>();
        tagCache.set(username, userMap);
    }

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
    markUpdated(username);
    const userMap = tagCache.get(username);
    if (!userMap) return;

    const normalizedPath = normalizeCachePath(relativePath);
    if (!normalizedPath) return;

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
    markUpdated(username);
    const userMap = tagCache.get(username);
    if (!userMap) return;

    const oldNorm = normalizeCachePath(oldRelativePath);
    const newNorm = normalizeCachePath(newRelativePath);
    if (!oldNorm) return;

    for (const [tagName, files] of userMap.entries()) {
        userMap.set(tagName, files.map(f => {
            const fName = f.name.replace(/\\/g, '/');
            if (fName === oldNorm) {
                return { ...f, name: newNorm };
            }
            if (fName.startsWith(oldNorm + '/')) {
                return { ...f, name: newNorm + fName.slice(oldNorm.length) };
            }
            return f;
        }));
    }
}

/**
 * Re-reads the tags of a file or folder tree that appeared on disk (for example a trash restore).
 */
export async function addTreeToCache(username: string, relativePath: string) {
    const normalizedPath = normalizeCachePath(relativePath);
    if (!normalizedPath) return;
    removeFileFromCache(username, normalizedPath);

    let userMap = tagCache.get(username);
    if (!userMap) {
        userMap = new Map<string, File[]>();
        tagCache.set(username, userMap);
    }

    const config = useRuntimeConfig();
    const userStoragePath = path.join(config.storagePath, username);
    const fullPath = path.join(userStoragePath, normalizedPath);
    try {
        const stats = await fs.stat(fullPath);
        await processMeta(fullPath, `${fullPath}.cloudinfo`, userStoragePath, userMap, stats.isDirectory());
        if (stats.isDirectory()) {
            await scanDir(fullPath, userStoragePath, userMap);
        }
    } catch (error) {
        console.error(`Error re-indexing tags for ${normalizedPath}:`, error);
    }
}

/** Test helper */
export function resetTagCacheForTests() {
    tagCache.clear();
    userUpdateCounters.clear();
}
