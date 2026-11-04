import fs from 'fs/promises'
import path from 'path'
import { getDirSize, getUserCacheEpoch } from './fileUtils'

export interface StorageNode {
    name: string
    size: number
    children?: StorageNode[]
}

export interface SwrResult<T> {
    /** Last computed value, possibly out of date; undefined until the first computation finishes */
    value: T | undefined
    /** True when value is missing or out of date and a recomputation is running */
    pending: boolean
}

/**
 * Stale-while-revalidate store. Reads never wait for a slow computation unless asked to:
 * they get the last value right away and a refresh runs in the background.
 * A value counts as current while it is younger than the TTL and its epoch still matches,
 * so invalidating (bumping the epoch) makes the next read refresh without throwing the old value away.
 */
export class SwrStore<T> {
    private entries = new Map<string, { value: T; timestamp: number; epoch: number }>()
    private inflight = new Map<string, { epoch: number; promise: Promise<T | undefined> }>()

    constructor(private ttlMs: number, private maxEntries = 1000) {}

    private refresh(key: string, epoch: () => number, loader: () => Promise<T>): Promise<T | undefined> {
        const startEpoch = epoch()
        const running = this.inflight.get(key)
        if (running && running.epoch === startEpoch) return running.promise

        const promise = loader().then((value) => {
            this.entries.delete(key)
            if (this.entries.size >= this.maxEntries) {
                this.entries.delete(this.entries.keys().next().value as string)
            }
            // Stored with the epoch it started under: if something changed meanwhile, it is already stale
            this.entries.set(key, { value, timestamp: Date.now(), epoch: startEpoch })
            return value
        }).catch((err) => {
            console.error(`[STATS] Refresh of ${key} failed:`, err)
            return undefined
        }).finally(() => {
            if (this.inflight.get(key)?.promise === promise) this.inflight.delete(key)
        })
        this.inflight.set(key, { epoch: startEpoch, promise })
        return promise
    }

    /**
     * @param waitMs how long to wait for a refresh before answering with what is there (0 = never wait)
     */
    async get(key: string, epoch: () => number, loader: () => Promise<T>, waitMs = 0): Promise<SwrResult<T>> {
        const entry = this.entries.get(key)
        if (entry && entry.epoch === epoch() && Date.now() - entry.timestamp < this.ttlMs) {
            return { value: entry.value, pending: false }
        }

        const promise = this.refresh(key, epoch, loader)
        if (waitMs > 0) {
            let timer: ReturnType<typeof setTimeout> | undefined
            const settled = await Promise.race([
                promise.then(value => ({ done: true as const, value })),
                new Promise<{ done: false }>(resolve => { timer = setTimeout(() => resolve({ done: false }), waitMs) }),
            ])
            clearTimeout(timer)
            if (settled.done && settled.value !== undefined) {
                return { value: settled.value, pending: false }
            }
        }

        return { value: this.entries.get(key)?.value, pending: true }
    }

    clear() {
        this.entries.clear()
        this.inflight.clear()
    }
}

const SUMMARY_TTL = 30 * 60 * 1000 // 30 minutes; uploads/deletes invalidate earlier through the user epoch

const usageStore = new SwrStore<number>(SUMMARY_TTL)
const storageMapStore = new SwrStore<StorageNode>(SUMMARY_TTL)

function userStoragePath(username: string) {
    return path.join(useRuntimeConfig().storagePath, username)
}

async function exists(p: string) {
    try {
        await fs.access(p)
        return true
    } catch {
        return false
    }
}

/**
 * Bytes used by a user, trash included (it counts toward the quota).
 */
export function getUserUsage(username: string, waitMs = 0): Promise<SwrResult<number>> {
    return usageStore.get(username, () => getUserCacheEpoch(username), async () => {
        const root = userStoragePath(username)
        return (await exists(root)) ? getDirSize(root) : 0
    }, waitMs)
}

const MAP_DEPTH = 2 // levels listed below the root; deeper folders are summed as one entry

async function buildStorageMap(dirPath: string, name: string, depth: number): Promise<StorageNode> {
    const node: StorageNode = { name, size: 0 }
    let entries
    try {
        entries = await fs.readdir(dirPath, { withFileTypes: true })
    } catch (err) {
        console.error(`Error mapping ${dirPath}:`, err)
        return node
    }

    const children = (await Promise.all(entries.map(async (entry): Promise<StorageNode | null> => {
        if (entry.name.startsWith('.') || entry.name.endsWith('.cloudinfo')) return null
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
            return depth < MAP_DEPTH
                ? buildStorageMap(fullPath, entry.name, depth + 1)
                : { name: entry.name, size: await getDirSize(fullPath) } // cached, rate-limited scan
        }
        if (entry.isFile()) {
            try {
                return { name: entry.name, size: (await fs.stat(fullPath)).size }
            } catch {
                return null // removed while mapping
            }
        }
        return null
    }))).filter((child): child is StorageNode => child !== null)

    node.size = children.reduce((sum, child) => sum + child.size, 0)
    if (children.length > 0) {
        node.children = children.sort((a, b) => b.size - a.size)
    }
    return node
}

/**
 * Size breakdown of a user's storage, hidden folders (trash, indexes) excluded.
 */
export function getUserStorageMap(username: string, waitMs = 0): Promise<SwrResult<StorageNode>> {
    return storageMapStore.get(username, () => getUserCacheEpoch(username), async () => {
        const root = userStoragePath(username)
        if (!(await exists(root))) return { name: 'root', size: 0 }
        return buildStorageMap(root, 'root', 0)
    }, waitMs)
}

/** Test helper */
export function resetStorageStatsForTests() {
    usageStore.clear()
    storageMapStore.clear()
}
