import fs from 'fs/promises'
import path from 'path'
import { withFileLock, writeFileAtomic } from './jsonStore'
import { bumpMetaVersion } from './metaVersion'

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
    return target === '' || entryPath === target || entryPath.startsWith(target + '/')
}

/** Drops duplicates and normalises every path, keeping the first occurrence. */
function dedupe(entries: PathIndexEntry[]): PathIndexEntry[] {
    const seen = new Set<string>()
    const out: PathIndexEntry[] = []
    for (const e of entries) {
        const p = normalizeIndexPath(e?.path ?? '')
        if (!p || seen.has(p)) continue
        seen.add(p)
        out.push({ path: p, isFolder: !!e.isFolder })
    }
    return out
}

function sameEntries(a: PathIndexEntry[], b: PathIndexEntry[]) {
    if (a.length !== b.length) return false
    const key = (e: PathIndexEntry) => `${e.path}\0${e.isFolder ? 1 : 0}`
    const set = new Set(a.map(key))
    return b.every(e => set.has(key(e)))
}

/**
 * A per-user JSON list of paths (favorites, wallpapers) kept in the user's storage root.
 * The list is derived data: the `.cloudinfo` sidecars are the source of truth, and a rescan
 * can rebuild it at any time. Every change is a locked read-modify-write with an atomic save,
 * so concurrent requests can't drop entries.
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
            return Array.isArray(parsed) ? dedupe(parsed) : []
        } catch (err: any) {
            return err?.code === 'ENOENT' ? null : []
        }
    }

    async function get(username: string): Promise<PathIndexEntry[]> {
        return (await read(username)) ?? []
    }

    async function update(username: string, change: (entries: PathIndexEntry[]) => PathIndexEntry[] | null) {
        const file = indexFile(username)
        try {
            await withFileLock(file, async () => {
                const raw = await read(username)
                const exists = raw !== null
                const current = raw ?? []
                const next = change(current)
                // Write when something changed, or to create the file so "no index yet" turns into "empty index"
                if (next && (!exists || !sameEntries(current, dedupe(next)))) {
                    await writeFileAtomic(file, JSON.stringify(dedupe(next), null, 2))
                }
            })
            bumpMetaVersion(username)
        } catch (err) {
            console.error(`Error saving ${label} index:`, err)
        }
    }

    async function save(username: string, entries: PathIndexEntry[]) {
        await update(username, () => entries)
    }

    async function add(username: string, filePath: string, isFolder: boolean) {
        const target = normalizeIndexPath(filePath)
        if (!target) return
        await update(username, entries => {
            const existing = entries.find(e => e.path === target)
            if (existing && existing.isFolder === isFolder) return null
            return [...entries.filter(e => e.path !== target), { path: target, isFolder }]
        })
    }

    /** Removes exactly this path. Entries inside a folder stay (un-marking a folder keeps its marked children). */
    async function removeExact(username: string, filePath: string) {
        const target = normalizeIndexPath(filePath)
        if (!target) return
        await update(username, entries => {
            const kept = entries.filter(e => e.path !== target)
            return kept.length !== entries.length ? kept : null
        })
    }

    /** Removes the path and, for a folder, everything indexed inside it (the path is gone from disk). */
    async function remove(username: string, filePath: string) {
        const target = normalizeIndexPath(filePath)
        if (!target) return
        await update(username, entries => {
            const kept = entries.filter(e => !isSameOrInside(e.path, target))
            return kept.length !== entries.length ? kept : null
        })
    }

    /** Removes exactly the given paths, e.g. entries a reader found to be missing on disk. */
    async function prune(username: string, filePaths: string[]) {
        const targets = new Set(filePaths.map(normalizeIndexPath).filter(Boolean))
        if (targets.size === 0) return
        await update(username, entries => {
            const kept = entries.filter(e => !targets.has(e.path))
            return kept.length !== entries.length ? kept : null
        })
    }

    /**
     * Replaces every entry at or below `root` with `entries` (all of which must lie at or below `root`).
     * `root` '' replaces the whole index. Used after scanning that part of the disk.
     */
    async function replaceSubtree(username: string, root: string, entries: PathIndexEntry[]) {
        const base = normalizeIndexPath(root)
        const scanned = dedupe(entries).filter(e => isSameOrInside(e.path, base))
        await update(username, current => [...current.filter(e => !isSameOrInside(e.path, base)), ...scanned])
    }

    async function rename(username: string, oldPath: string, newPath: string) {
        const from = normalizeIndexPath(oldPath)
        const to = normalizeIndexPath(newPath)
        if (!from || !to) return
        await update(username, entries => {
            let changed = false
            const next = entries.map(e => {
                if (!isSameOrInside(e.path, from)) return e
                changed = true
                return { ...e, path: to + e.path.slice(from.length) }
            })
            return changed ? next : null
        })
    }

    async function move(username: string, oldPaths: string[], destination: string) {
        const sources = oldPaths.map(normalizeIndexPath).filter(Boolean)
        const dest = normalizeIndexPath(destination)
        if (sources.length === 0) return
        await update(username, entries => {
            let changed = false
            const next = entries.map(e => {
                const match = sources.find(s => isSameOrInside(e.path, s))
                if (!match) return e
                changed = true
                const fileName = match.split('/').pop()!
                const newBase = dest ? `${dest}/${fileName}` : fileName
                return { ...e, path: newBase + e.path.slice(match.length) }
            })
            return changed ? next : null
        })
    }

    return { read, get, save, add, removeExact, remove, prune, replaceSubtree, rename, move }
}
