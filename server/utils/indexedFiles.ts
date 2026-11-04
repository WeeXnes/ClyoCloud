import fs from 'fs/promises'
import path from 'path'
import type { File, FileMeta } from '~/types/File'
import type { createPathIndex } from './pathIndex'
import { getDirSize, isPathWithin, isTrashPath } from './fileUtils'
import { readMeta, reconcileUser } from './tagCache'

type PathIndex = ReturnType<typeof createPathIndex>

/**
 * Lists the files a per-user index (wallpapers, favourites) points to, checked against the disk.
 *
 * - No index yet, or `sync`: rescan the user's storage first, so the list matches the `.cloudinfo` files.
 * - Entries whose file is gone, outside the user's storage, or no longer carries the flag are left out
 *   and removed from the index, so stale entries never come back (also for the companion apps).
 */
export async function listIndexedFiles(
    username: string,
    index: PathIndex,
    flag: (meta: FileMeta) => boolean | undefined,
    options: { sync?: boolean } = {},
): Promise<File[]> {
    const userStoragePath = path.resolve(path.join(useRuntimeConfig().storagePath, username))

    if (options.sync || (await index.read(username)) === null) {
        await reconcileUser(username)
    }
    const entries = await index.get(username)

    const stale: string[] = []
    const found: File[] = []

    await Promise.all(entries.map(async (entry) => {
        const fullPath = path.resolve(path.join(userStoragePath, entry.path))
        if (!isPathWithin(userStoragePath, fullPath) || fullPath === userStoragePath || isTrashPath(userStoragePath, fullPath)) {
            stale.push(entry.path)
            return
        }

        let stats
        try {
            stats = await fs.stat(fullPath)
        } catch (err: any) {
            // Only a definite "not there" is stale; a transient error (EIO, EACCES) keeps the entry
            if (err?.code === 'ENOENT' || err?.code === 'ENOTDIR') stale.push(entry.path)
            return
        }

        const meta = await readMeta(fullPath)
        if (!meta || !flag(meta)) {
            stale.push(entry.path)
            return
        }

        const isFolder = stats.isDirectory()
        found.push({
            name: entry.path,
            size: isFolder ? await getDirSize(fullPath) : stats.size,
            type: isFolder ? '' : path.extname(fullPath),
            lastModified: stats.mtime.getTime(),
            isFolder,
            meta,
        })
        if (isFolder !== entry.isFolder) {
            await index.add(username, entry.path, isFolder) // fixes a wrong folder/file flag
        }
    }))

    if (stale.length > 0) await index.prune(username, stale)

    return found.sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
        return a.name.localeCompare(b.name)
    })
}
