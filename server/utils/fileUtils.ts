import fs from 'fs/promises'
import path from 'path'

import { clearMediaCache } from './mediaCache'

const SIZE_CACHE_TTL = 30 * 60 * 1000 // 30 minutes cache for dir sizes
const SIZE_CACHE_MAX_ENTRIES = 20000
// Disk work for size scans is capped so a big scan never starves other requests of the libuv threadpool
const SIZE_SCAN_CONCURRENCY = 8

const sizeCache = new Map<string, { size: number; timestamp: number }>()
const sizeInflight = new Map<string, Promise<number>>()
// Bumped on every invalidation; a scan only caches its result if no invalidation hit its user meanwhile
const userEpochs = new Map<string, number>()

/**
 * Runs at most `max` tasks at once; the rest wait in FIFO order.
 */
export function createLimiter(max: number) {
    let active = 0
    const queue: Array<() => void> = []
    return async function limit<T>(task: () => Promise<T>): Promise<T> {
        if (active >= max) {
            await new Promise<void>(resolve => queue.push(resolve))
        } else {
            active++
        }
        try {
            return await task()
        } finally {
            const next = queue.shift()
            if (next) next() // hand the slot over directly
            else active--
        }
    }
}

const limitFs = createLimiter(SIZE_SCAN_CONCURRENCY)

function storageRoot(): string | null {
    try {
        const root = useRuntimeConfig().storagePath
        return root ? path.resolve(root) : null
    } catch {
        return null
    }
}

/** The user directory a path belongs to, used to scope invalidation epochs. */
function epochKeyFor(resolvedPath: string): string {
    const root = storageRoot()
    if (!root) return ''
    const relative = path.relative(root, resolvedPath)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return ''
    return path.join(root, relative.split(path.sep)[0])
}

function bumpEpoch(key: string) {
    userEpochs.set(key, (userEpochs.get(key) ?? 0) + 1)
}

/**
 * Changes every time this user's files are invalidated. Lets other caches tell
 * whether a value they computed earlier may be out of date.
 */
export function getUserCacheEpoch(username: string): number {
    const root = storageRoot()
    const key = root ? path.join(root, username) : ''
    return (userEpochs.get(key) ?? 0) + (key ? userEpochs.get('') ?? 0 : 0)
}

function setSizeCache(key: string, size: number) {
    sizeCache.delete(key) // re-insert so Map order stays oldest-first
    if (sizeCache.size >= SIZE_CACHE_MAX_ENTRIES) {
        const now = Date.now()
        for (const [k, v] of sizeCache) {
            if (now - v.timestamp >= SIZE_CACHE_TTL) sizeCache.delete(k)
        }
        while (sizeCache.size >= SIZE_CACHE_MAX_ENTRIES) {
            sizeCache.delete(sizeCache.keys().next().value as string)
        }
    }
    sizeCache.set(key, { size, timestamp: Date.now() })
}

async function computeDirSize(key: string): Promise<number> {
    const epochKey = epochKeyFor(key)
    const startEpoch = userEpochs.get(epochKey) ?? 0

    let entries
    try {
        entries = await limitFs(() => fs.readdir(key, { withFileTypes: true }))
    } catch {
        return 0
    }

    const sizes = await Promise.all(entries.map(async (entry) => {
        const entryPath = path.join(key, entry.name)
        if (entry.isDirectory()) {
            return getDirSize(entryPath)
        }
        if (entry.isFile()) {
            try {
                return (await limitFs(() => fs.stat(entryPath))).size
            } catch {
                return 0 // removed while scanning
            }
        }
        return 0
    }))
    const total = sizes.reduce((a, b) => a + b, 0)

    if ((userEpochs.get(epochKey) ?? 0) === startEpoch) {
        setSizeCache(key, total)
    }
    return total
}

/**
 * Total size of a directory tree. Results are cached per directory, concurrent
 * calls for the same directory share one scan, and disk access is rate-limited.
 */
export function getDirSize(dirPath: string): Promise<number> {
    const key = path.resolve(dirPath)
    const cached = sizeCache.get(key)
    if (cached && Date.now() - cached.timestamp < SIZE_CACHE_TTL) {
        return Promise.resolve(cached.size)
    }

    const inflight = sizeInflight.get(key)
    if (inflight) return inflight

    const scan = computeDirSize(key).finally(() => {
        if (sizeInflight.get(key) === scan) sizeInflight.delete(key)
    })
    sizeInflight.set(key, scan)
    return scan
}

function dropSizeEntries(predicate: (key: string) => boolean) {
    for (const key of sizeCache.keys()) {
        if (predicate(key)) sizeCache.delete(key)
    }
    // New callers must not join a scan that started before the change
    for (const key of sizeInflight.keys()) {
        if (predicate(key)) sizeInflight.delete(key)
    }
}

/**
 * Force clear the directory size cache for a path (useful when files are added/deleted):
 * the path itself, everything below it, and every parent directory.
 */
export function clearSizeCache(dirPath: string) {
    const target = path.resolve(dirPath)
    const ancestors = new Set<string>()
    for (let p = target; ; p = path.dirname(p)) {
        ancestors.add(p)
        if (path.dirname(p) === p) break
    }
    dropSizeEntries(key => ancestors.has(key) || key.startsWith(target + path.sep))
    bumpEpoch(epochKeyFor(target))
}

/**
 * Invalidate a user's cached sizes, storage summaries and media scans.
 * Call it after anything changes in the user's storage. Pass the absolute paths that
 * changed to keep the rest of the size cache (only those paths, what is inside them and
 * their parent folders get rescanned); without them the user's whole cache is dropped.
 */
export function clearUserCache(username: string, changedPaths?: string[]) {
    const root = storageRoot()
    if (root) {
        const userStoragePath = path.join(root, username)
        const scoped = changedPaths?.map(p => path.resolve(p)).filter(p => isPathWithin(userStoragePath, p))
        if (scoped && scoped.length > 0) {
            for (const changed of scoped) clearSizeCache(changed)
        } else {
            dropSizeEntries(key => key === userStoragePath || key.startsWith(userStoragePath + path.sep))
        }
        bumpEpoch(userStoragePath)
    } else {
        // Fallback if useRuntimeConfig is not available
        dropSizeEntries(key => key.split(path.sep).includes(username))
        bumpEpoch('')
    }

    clearMediaCache(username)
}

/** Test helper: forget every cached size. */
export function resetSizeCacheForTests() {
    sizeCache.clear()
    sizeInflight.clear()
    userEpochs.clear()
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

/**
 * True if the path is the user's .trash directory or anything inside it.
 * The trash is only managed through server/utils/trash.ts, never by the general file APIs.
 */
export function isTrashPath(userStoragePath: string, targetPath: string): boolean {
    const relative = path.relative(path.resolve(userStoragePath), path.resolve(targetPath))
    return relative.split(/[\\/]/)[0] === '.trash'
}

/**
 * Validates a user-configured download sub-folder.
 * It must stay inside the user's storage and outside the trash.
 */
export function isValidDownloadPath(userStoragePath: string, downloadPath: unknown): boolean {
    if (typeof downloadPath !== 'string') return false
    const resolved = path.resolve(path.join(userStoragePath, downloadPath))
    return isPathWithin(userStoragePath, resolved) && !isTrashPath(userStoragePath, resolved)
}

