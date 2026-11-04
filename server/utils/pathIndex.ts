import fs from 'fs/promises'
import path from 'path'
import { withFileLock, writeFileAtomic } from './jsonStore'

export interface PathIndexEntry {
    path: string;
    isFolder: boolean;
}

/** Same form the indexes store: forward slashes, no leading or trailing slash. */
export function normalizeIndexPath(p: string): string {
    const normalized = path.posix.normalize(String(p).replace(/\\/g, '/')).replace(/^(\.\/)+/, '').replace(/^\/+|\/+$/g, '')
    return normalized === '.' ? '' : normalized
}

function isSameOrInside(entryPath: string, target: string) {
    return entryPath === target || entryPath.startsWith(target + '/')
}

/**
 * A per-user JSON list of paths (favorites, wallpapers) kept in the user's storage root.
 * Every change is a locked read-modify-write with an atomic save, so concurrent requests can't drop entries.
 */
export function createPathIndex(fileName: string, label: string) {
    function indexFile(username: string) {
        const config = useRuntimeConfig()
        return path.join(config.storagePath, username, fileName)
    }

    /** Returns null when the index file doesn't exist yet (as opposed to an empty index). */
    async function read(username: string): Promise<PathIndexEntry[] | null> {
        try {
            const parsed = JSON.parse(await fs.readFile(indexFile(username), 'utf-8'))
            return Array.isArray(parsed) ? parsed : []
        } catch (err: any) {
            return err?.code === 'ENOENT' ? null : []
        }
    }

    async function get(username: string): Promise<PathIndexEntry[]> {
        return (await read(username)) ?? []
    }

    async function save(username: string, entries: PathIndexEntry[]) {
        const file = indexFile(username)
        try {
            await withFileLock(file, () => writeFileAtomic(file, JSON.stringify(entries, null, 2)))
        } catch (err) {
            console.error(`Error saving ${label} index:`, err)
        }
    }

    async function update(username: string, change: (entries: PathIndexEntry[]) => PathIndexEntry[] | null) {
        const file = indexFile(username)
        try {
            await withFileLock(file, async () => {
                const next = change(await get(username))
                if (next) await writeFileAtomic(file, JSON.stringify(next, null, 2))
            })
        } catch (err) {
            console.error(`Error saving ${label} index:`, err)
        }
    }

    async function add(username: string, filePath: string, isFolder: boolean) {
        const target = normalizeIndexPath(filePath)
        await update(username, entries => entries.some(e => normalizeIndexPath(e.path) === target)
            ? null
            : [...entries, { path: target, isFolder }])
    }

    /** Removes the path and, for a folder, everything indexed inside it. */
    async function remove(username: string, filePath: string) {
        const target = normalizeIndexPath(filePath)
        if (!target) return
        await update(username, entries => {
            const kept = entries.filter(e => !isSameOrInside(normalizeIndexPath(e.path), target))
            return kept.length !== entries.length ? kept : null
        })
    }

    async function rename(username: string, oldPath: string, newPath: string) {
        const from = normalizeIndexPath(oldPath)
        const to = normalizeIndexPath(newPath)
        if (!from) return
        await update(username, entries => {
            let changed = false
            const next = entries.map(e => {
                const p = normalizeIndexPath(e.path)
                if (!isSameOrInside(p, from)) return e
                changed = true
                return { ...e, path: to + p.slice(from.length) }
            })
            return changed ? next : null
        })
    }

    async function move(username: string, oldPaths: string[], destination: string) {
        const sources = oldPaths.map(normalizeIndexPath).filter(Boolean)
        const dest = normalizeIndexPath(destination)
        await update(username, entries => {
            let changed = false
            const next = entries.map(e => {
                const p = normalizeIndexPath(e.path)
                const match = sources.find(s => isSameOrInside(p, s))
                if (!match) return e
                changed = true
                const fileName = match.split('/').pop()!
                const newBase = dest ? `${dest}/${fileName}` : fileName
                return { ...e, path: newBase + p.slice(match.length) }
            })
            return changed ? next : null
        })
    }

    return { read, get, save, add, remove, rename, move }
}
