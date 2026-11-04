import fs from 'fs/promises'
import path from 'path'
import type { File, FileMeta } from '~/types/File'
import { bumpMetaVersion, getMetaVersion } from './metaVersion'
import { wallpapersIndex } from './wallpapers'
import { favoritesIndex } from './favorites'
import type { PathIndexEntry } from './pathIndex'

/*
 * Everything here is derived from the `.cloudinfo` sidecars, which are the source of truth:
 *   - the in-memory tag cache (Map<Username, Map<TagName, File[]>>)
 *   - the per-user `.wallpapers.json` and `.favorites.json` lists
 * ClyoCloud's own handlers update them directly. Changes made outside ClyoCloud are picked
 * up by the storage watcher (reconcilePath) and the periodic / on-demand full rescan (reconcileUser).
 */

const tagCache = new Map<string, Map<string, File[]>>();
let rebuildPromise: Promise<void> | null = null;
const userReconciles = new Map<string, Promise<void>>();

/**
 * Normalizes a user-relative path the way the cache stores it: forward slashes,
 * no leading "./" or "/", no trailing "/". Clients send all of these variants.
 */
export function normalizeCachePath(relativePath: string): string {
    const normalized = path.posix.normalize(String(relativePath).replace(/\\/g, '/')).replace(/^(\.\/)+/, '').replace(/^\/+|\/+$/g, '');
    return normalized === '.' ? '' : normalized;
}

function isSameOrInside(p: string, root: string) {
    return root === '' || p === root || p.startsWith(root + '/');
}

/** True for paths ClyoCloud keeps out of the user's files: the trash, index files, other dotfiles. */
export function isHiddenRelPath(relativePath: string): boolean {
    return normalizeCachePath(relativePath).split('/').some(part => part.startsWith('.'));
}

function userRoot(username: string) {
    return path.join(useRuntimeConfig().storagePath, username);
}

function userMapFor(username: string) {
    let userMap = tagCache.get(username);
    if (!userMap) {
        userMap = new Map<string, File[]>();
        tagCache.set(username, userMap);
    }
    return userMap;
}

/** Reads a sidecar, including the legacy name for very long file names. null when there is none or it is unreadable. */
export async function readMeta(fullPath: string): Promise<FileMeta | null> {
    const candidates = [`${fullPath}.cloudinfo`];
    const base = path.basename(fullPath);
    if (base.length > 100) candidates.push(path.join(path.dirname(fullPath), `${base.substring(0, 100)}.cloudinfo`));
    for (const candidate of candidates) {
        try {
            const meta = JSON.parse(await fs.readFile(candidate, 'utf-8'));
            if (meta && typeof meta === 'object') {
                return { ...meta, tags: Array.isArray(meta.tags) ? meta.tags : [] } as FileMeta;
            }
        } catch {}
    }
    return null;
}

interface ScanResult {
    tags: Map<string, File[]>;
    wallpapers: PathIndexEntry[];
    favorites: PathIndexEntry[];
}

function newScanResult(): ScanResult {
    return { tags: new Map(), wallpapers: [], favorites: [] };
}

function addToResult(result: ScanResult, item: File) {
    const { meta } = item;
    if (meta.isWallpaper) result.wallpapers.push({ path: item.name, isFolder: item.isFolder });
    if (meta.isFavourite) result.favorites.push({ path: item.name, isFolder: item.isFolder });
    for (const tag of meta.tags || []) {
        if (!tag?.name) continue;
        const tagName = String(tag.name).toLowerCase();
        if (!result.tags.has(tagName)) result.tags.set(tagName, []);
        result.tags.get(tagName)!.push(item);
    }
}

/** Reads one path's sidecar into the result. Returns whether the path is a directory (null when it is gone). */
async function processPath(fullPath: string, relativePath: string, result: ScanResult): Promise<boolean | null> {
    let stats;
    try {
        stats = await fs.stat(fullPath);
    } catch {
        return null;
    }
    const isFolder = stats.isDirectory();
    const meta = await readMeta(fullPath);
    if (meta) {
        addToResult(result, {
            name: relativePath,
            size: isFolder ? 0 : stats.size,
            type: isFolder ? '' : path.extname(fullPath),
            lastModified: stats.mtime.getTime(),
            isFolder,
            meta,
        });
    }
    return isFolder;
}

async function scanDir(currentPath: string, relativeDir: string, result: ScanResult) {
    let entries;
    try {
        entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch (error: any) {
        if (error?.code !== 'ENOENT') console.error(`Error scanning directory ${currentPath}:`, error);
        return;
    }

    for (const entry of entries) {
        // .trash, index files and other hidden entries are not part of the user's files
        if (entry.name.startsWith('.') || entry.name.endsWith('.cloudinfo')) continue;
        if (!entry.isDirectory() && !entry.isFile()) continue;
        const fullPath = path.join(currentPath, entry.name);
        const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
        const isFolder = await processPath(fullPath, relativePath, result);
        if (isFolder) await scanDir(fullPath, relativePath, result);
    }
}

/** Scans `root` (user-relative, '' = everything). With deep = false only the path itself is read. */
async function scanTree(username: string, root: string, deep = true): Promise<ScanResult> {
    const result = newScanResult();
    const base = userRoot(username);
    if (root === '') {
        await scanDir(base, '', result);
        return result;
    }
    const isFolder = await processPath(path.join(base, root), root, result);
    if (isFolder && deep) await scanDir(path.join(base, root), root, result);
    return result;
}

/** Swaps every tag entry at or below `root` for the scanned ones. */
function replaceTagSubtree(username: string, root: string, scanned: Map<string, File[]>) {
    if (root === '') {
        tagCache.set(username, scanned);
        return;
    }
    const userMap = userMapFor(username);
    for (const [tagName, files] of userMap.entries()) {
        const kept = files.filter(f => !isSameOrInside(f.name, root));
        if (kept.length > 0) userMap.set(tagName, kept);
        else userMap.delete(tagName);
    }
    for (const [tagName, files] of scanned) {
        userMap.set(tagName, [...(userMap.get(tagName) || []), ...files]);
    }
}

/** Swaps one path's tag entries (not those below it) for the scanned ones. */
function replaceTagExact(username: string, target: string, scanned: Map<string, File[]>) {
    const userMap = userMapFor(username);
    for (const [tagName, files] of userMap.entries()) {
        const kept = files.filter(f => f.name !== target);
        if (kept.length > 0) userMap.set(tagName, kept);
        else userMap.delete(tagName);
    }
    for (const [tagName, files] of scanned) {
        userMap.set(tagName, [...(userMap.get(tagName) || []), ...files.filter(f => f.name === target)]);
    }
}

async function applyIndexes(username: string, root: string, result: ScanResult, deep: boolean) {
    if (deep || root === '') {
        await wallpapersIndex.replaceSubtree(username, root, result.wallpapers);
        await favoritesIndex.replaceSubtree(username, root, result.favorites);
        return;
    }
    // Only the path itself was read: set its own membership, leave entries inside it alone
    const wallpaper = result.wallpapers.find(e => e.path === root);
    const favorite = result.favorites.find(e => e.path === root);
    if (wallpaper) await wallpapersIndex.add(username, root, wallpaper.isFolder);
    else await wallpapersIndex.removeExact(username, root);
    if (favorite) await favoritesIndex.add(username, root, favorite.isFolder);
    else await favoritesIndex.removeExact(username, root);
}

/**
 * Rescans a user's whole storage and makes the tag cache, wallpapers and favourites match the
 * `.cloudinfo` files exactly: entries for missing files go, files marked outside ClyoCloud appear.
 * Concurrent calls for the same user share one scan.
 */
export function reconcileUser(username: string): Promise<void> {
    const running = userReconciles.get(username);
    if (running) return running;

    const run = (async () => {
        try {
            const stats = await fs.stat(userRoot(username));
            if (!stats.isDirectory()) return;
        } catch {
            return;
        }

        // An edit that lands mid-scan may be missing from the scan: scan again (a few times at most)
        let result = newScanResult();
        for (let attempt = 0; attempt < 3; attempt++) {
            const before = getMetaVersion(username);
            result = await scanTree(username, '');
            if (getMetaVersion(username) === before) break;
        }
        replaceTagSubtree(username, '', result.tags);
        await applyIndexes(username, '', result, true);
    })().catch((error) => {
        console.error(`Error rescanning metadata for ${username}:`, error);
    }).finally(() => {
        if (userReconciles.get(username) === run) userReconciles.delete(username);
    });
    userReconciles.set(username, run);
    return run;
}

/**
 * Brings one path in line with the disk after it changed outside ClyoCloud.
 * Gone: drop it and everything below it. Present: re-read it, and with deep = true everything below it.
 */
export async function reconcilePath(username: string, relativePath: string, deep = true) {
    const target = normalizeCachePath(relativePath);
    if (!target || isHiddenRelPath(target)) return;

    const result = await scanTree(username, target, deep);
    let exists = true;
    try {
        await fs.stat(path.join(userRoot(username), target));
    } catch {
        exists = false;
    }

    bumpMetaVersion(username);
    if (!exists) {
        replaceTagSubtree(username, target, new Map());
        await wallpapersIndex.remove(username, target);
        await favoritesIndex.remove(username, target);
        return;
    }
    if (deep) replaceTagSubtree(username, target, result.tags);
    else replaceTagExact(username, target, result.tags);
    await applyIndexes(username, target, result, deep);
}

/** Rescans every user. Concurrent callers wait for the run already going. */
export function rebuildTagCache(): Promise<void> {
    if (!rebuildPromise) {
        rebuildPromise = runRebuild().finally(() => {
            rebuildPromise = null;
        });
    }
    return rebuildPromise;
}

async function runRebuild() {
    console.info('Rescanning file metadata (tags, favourites, wallpapers)...');
    const startTime = Date.now();
    try {
        const storagePath = useRuntimeConfig().storagePath;
        await fs.mkdir(storagePath, { recursive: true });
        const entries = await fs.readdir(storagePath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                await reconcileUser(entry.name);
            }
        }
        console.info(`Metadata rescan finished in ${Date.now() - startTime}ms`);
    } catch (error) {
        console.error('Error rescanning file metadata:', error);
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
    bumpMetaVersion(username);
    const relativePath = normalizeCachePath(rawRelativePath);
    if (!relativePath) return;
    const fullPath = path.join(userRoot(username), relativePath);
    const scanned = newScanResult();
    if (meta.tags && meta.tags.length > 0) {
        try {
            const stats = await fs.stat(fullPath);
            addToResult(scanned, {
                name: relativePath,
                size: stats.isDirectory() ? 0 : stats.size,
                type: stats.isDirectory() ? '' : path.extname(fullPath),
                lastModified: stats.mtime.getTime(),
                isFolder: stats.isDirectory(),
                meta,
            });
        } catch (err) {
            console.error(`Error updating cache for ${relativePath}:`, err);
        }
    }
    // Only the tag part of the scan is used here; the wallpaper/favourite lists are updated by the caller
    replaceTagExact(username, relativePath, scanned.tags);
}

/**
 * Removes a file or folder (and its children if folder) from the cache
 */
export function removeFileFromCache(username: string, relativePath: string) {
    bumpMetaVersion(username);
    const normalizedPath = normalizeCachePath(relativePath);
    if (!normalizedPath || !tagCache.has(username)) return;
    replaceTagSubtree(username, normalizedPath, new Map());
}

/**
 * Updates cache when a file/folder is renamed or moved
 */
export function moveFileInCache(username: string, oldRelativePath: string, newRelativePath: string) {
    bumpMetaVersion(username);
    const userMap = tagCache.get(username);
    if (!userMap) return;

    const oldNorm = normalizeCachePath(oldRelativePath);
    const newNorm = normalizeCachePath(newRelativePath);
    if (!oldNorm || !newNorm) return;

    for (const [tagName, files] of userMap.entries()) {
        userMap.set(tagName, files.map(f => {
            if (f.name === oldNorm) return { ...f, name: newNorm };
            if (f.name.startsWith(oldNorm + '/')) return { ...f, name: newNorm + f.name.slice(oldNorm.length) };
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
    bumpMetaVersion(username);
    const result = await scanTree(username, normalizedPath, true);
    replaceTagSubtree(username, normalizedPath, result.tags);
}

/** Test helper */
export function resetTagCacheForTests() {
    tagCache.clear();
    userReconciles.clear();
    rebuildPromise = null;
}
