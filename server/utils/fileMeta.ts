import fs from 'fs/promises'
import path from 'path'
import type { FileMeta } from '~/types/File'
import { withFileLock, writeFileAtomic } from './jsonStore'
import { normalizeCachePath, readMeta, updateFileInCache } from './tagCache'
import { wallpapersIndex } from './wallpapers'
import { favoritesIndex } from './favorites'
import { clearMediaCache } from './mediaCache'

/**
 * The single way to change a file's `.cloudinfo` sidecar.
 *
 * The read-modify-write runs under a per-file lock and is saved atomically, so two quick
 * changes (say a tag edit and a wallpaper toggle) can't overwrite each other and a crash
 * never leaves a half-written file. Afterwards the tag cache and the wallpaper/favourite
 * lists are set from the saved flags, so they always agree with the sidecar.
 *
 * `mutate` gets the current meta (or an empty one) and changes it in place.
 */
export async function updateFileMeta(
    username: string,
    relativePath: string,
    mutate: (meta: FileMeta) => void | Promise<void>,
): Promise<FileMeta> {
    const rel = normalizeCachePath(relativePath)
    const userStoragePath = path.join(useRuntimeConfig().storagePath, username)
    const fullPath = path.join(userStoragePath, rel)
    const stats = await fs.stat(fullPath)
    const isFolder = stats.isDirectory()
    const cloudInfoPath = `${fullPath}.cloudinfo`

    const meta = await withFileLock(cloudInfoPath, async () => {
        const current: FileMeta = (await readMeta(fullPath)) ?? { tags: [] }
        await mutate(current)
        // Sidecars stay readable by the storage owner's other tools (SMB, file managers)
        await writeFileAtomic(cloudInfoPath, JSON.stringify(current, null, 2), 0o644)
        return current
    })

    await syncDerivedMeta(username, rel, meta, isFolder)
    return meta
}

/** Sets the tag cache and the wallpaper/favourite membership of one path from its meta. */
export async function syncDerivedMeta(username: string, relativePath: string, meta: FileMeta, isFolder: boolean) {
    const rel = normalizeCachePath(relativePath)
    await updateFileInCache(username, rel, meta)
    // Exact add/remove: un-marking a folder keeps the marked files inside it
    if (meta.isWallpaper) await wallpapersIndex.add(username, rel, isFolder)
    else await wallpapersIndex.removeExact(username, rel)
    if (meta.isFavourite) await favoritesIndex.add(username, rel, isFolder)
    else await favoritesIndex.removeExact(username, rel)
    clearMediaCache(username)
}
