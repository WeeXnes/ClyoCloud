import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { clearUserCache } from './fileUtils'
import { isHiddenRelPath, normalizeCachePath, rebuildTagCache, reconcilePath, reconcileUser } from './tagCache'

/*
 * Keeps the caches right when files change outside ClyoCloud (SMB, a file manager, rsync,
 * scripts, a hand-edited .cloudinfo):
 *   - a recursive watch on the storage root updates sizes, tags, wallpapers and favourites
 *     for exactly the paths that changed, a moment after they change;
 *   - a periodic full rescan is the safety net for what a watch can miss (network mounts,
 *     the inotify limit, event overflow). It runs more often when watching is not possible.
 * ClyoCloud's own changes update the caches directly; their events here are harmless repeats.
 */

const DEBOUNCE_MS = 1500
const MAX_PATHS_PER_BATCH = 500 // more than this in one burst: rescan the user instead
const RESCAN_MINUTES_WATCHING = 60
const RESCAN_MINUTES_NOT_WATCHING = 10

interface PendingBatch {
    paths: Set<string>
    overflow: boolean
    timer: ReturnType<typeof setTimeout> | null
}

interface WatcherState {
    watcher: fs.FSWatcher | null
    rescanTimer: ReturnType<typeof setInterval> | null
    pending: Map<string, PendingBatch>
    processing: Map<string, Promise<void>>
}

// One instance per process, also across dev-server reloads
const STATE_KEY = Symbol.for('clyocloud.storageWatcher')
const g = globalThis as any
const state: WatcherState = g[STATE_KEY] ?? (g[STATE_KEY] = {
    watcher: null,
    rescanTimer: null,
    pending: new Map(),
    processing: new Map(),
})

function storageRoot() {
    return path.resolve(useRuntimeConfig().storagePath)
}

export function isWatchingStorage() {
    return state.watcher !== null
}

/** Temporary files of atomic writes (`x.cloudinfo.<pid>.<hex>.tmp`, `.wallpapers.json.<pid>.<hex>.tmp`). */
function isTempWrite(rel: string) {
    return /\.\d+\.[0-9a-f]+\.tmp$/.test(rel)
}

function onEvent(_type: string, filename: string | Buffer | null) {
    if (!filename) {
        // The kernel did not say what changed (e.g. event overflow): rescan everyone
        scheduleFullRescan()
        return
    }
    const rel = normalizeCachePath(filename.toString())
    if (!rel) return
    const [username, ...rest] = rel.split('/')
    if (!username || username.startsWith('.')) return
    queue(username, rest.join('/'))
}

function queue(username: string, rel: string) {
    let batch = state.pending.get(username)
    if (!batch) {
        batch = { paths: new Set(), overflow: false, timer: null }
        state.pending.set(username, batch)
    }
    if (batch.paths.size >= MAX_PATHS_PER_BATCH) batch.overflow = true
    else batch.paths.add(rel)

    if (batch.timer) clearTimeout(batch.timer)
    batch.timer = setTimeout(() => flush(username), DEBOUNCE_MS)
}

function flush(username: string) {
    const batch = state.pending.get(username)
    if (!batch) return
    state.pending.delete(username)

    // One batch at a time per user, in order
    const previous = state.processing.get(username) ?? Promise.resolve()
    const run = previous.then(() => processBatch(username, batch)).catch((err) => {
        console.error(`[WATCH] Updating caches for ${username} failed:`, err)
    }).finally(() => {
        if (state.processing.get(username) === run) state.processing.delete(username)
    })
    state.processing.set(username, run)
}

async function processBatch(username: string, batch: PendingBatch) {
    const userRoot = path.join(storageRoot(), username)

    if (batch.overflow || batch.paths.has('')) {
        clearUserCache(username)
        await reconcileUser(username)
        return
    }

    // Sizes: every change counts, the trash included (it counts toward the quota)
    clearUserCache(username, [...batch.paths].map(p => path.join(userRoot, p)))

    // Metadata: a changed sidecar re-reads its file; anything else appeared, vanished or was renamed
    const deep = new Set<string>()
    const shallow = new Set<string>()
    for (const p of batch.paths) {
        if (isHiddenRelPath(p) || isTempWrite(p)) continue
        if (p.endsWith('.cloudinfo')) shallow.add(p.slice(0, -'.cloudinfo'.length))
        else deep.add(p)
    }
    // A path inside another rescanned path is covered by it
    const deepList = [...deep].sort()
    const roots = deepList.filter((p, i) => !deepList.slice(0, i).some(r => p.startsWith(r + '/')))
    const isCovered = (p: string) => roots.some(r => p === r || p.startsWith(r + '/'))

    for (const p of roots) await reconcilePath(username, p, true)
    for (const p of shallow) {
        if (!isCovered(p)) await reconcilePath(username, p, false)
    }
}

let fullRescanTimer: ReturnType<typeof setTimeout> | null = null
function scheduleFullRescan() {
    if (fullRescanTimer) return
    fullRescanTimer = setTimeout(async () => {
        fullRescanTimer = null
        await rescanAllUsers()
    }, DEBOUNCE_MS)
}

/** Full rescan of every user: metadata from the sidecars, sizes recomputed on next use. */
export async function rescanAllUsers() {
    try {
        const entries = await fsp.readdir(storageRoot(), { withFileTypes: true })
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) clearUserCache(entry.name)
        }
    } catch {}
    await rebuildTagCache()
}

function startRescanTimer() {
    if (state.rescanTimer) clearInterval(state.rescanTimer)
    const configured = Number(process.env.CLYO_RESCAN_MINUTES)
    const minutes = Number.isFinite(configured) && configured > 0
        ? configured
        : (isWatchingStorage() ? RESCAN_MINUTES_WATCHING : RESCAN_MINUTES_NOT_WATCHING)
    state.rescanTimer = setInterval(() => { rescanAllUsers() }, minutes * 60 * 1000)
    state.rescanTimer.unref?.()
}

/**
 * Starts watching the storage folder and the periodic rescan. Safe to call more than once.
 * Set CLYO_WATCH_STORAGE=false to rely on the periodic rescan only.
 */
export function startStorageWatcher() {
    stopStorageWatcher()

    if (process.env.CLYO_WATCH_STORAGE !== 'false') {
        try {
            const watcher = fs.watch(storageRoot(), { recursive: true }, onEvent)
            watcher.on('error', (err: any) => {
                console.warn(`[WATCH] Watching ${storageRoot()} stopped (${err?.code || err}); changes made outside ClyoCloud are picked up by the periodic rescan instead.`)
                try { watcher.close() } catch {}
                if (state.watcher === watcher) state.watcher = null
                startRescanTimer()
                scheduleFullRescan()
            })
            watcher.unref?.()
            state.watcher = watcher
            console.info(`[WATCH] Watching ${storageRoot()} for changes made outside ClyoCloud`)
        } catch (err: any) {
            console.warn(`[WATCH] Cannot watch ${storageRoot()} (${err?.code || err}); relying on the periodic rescan.`)
            if (err?.code === 'ENOSPC') {
                console.warn('[WATCH] The inotify watch limit is too low for this storage. Raise fs.inotify.max_user_watches to enable live updates.')
            }
        }
    }

    startRescanTimer()
}

export function stopStorageWatcher() {
    if (state.watcher) {
        try { state.watcher.close() } catch {}
        state.watcher = null
    }
    if (state.rescanTimer) {
        clearInterval(state.rescanTimer)
        state.rescanTimer = null
    }
    for (const batch of state.pending.values()) {
        if (batch.timer) clearTimeout(batch.timer)
    }
    state.pending.clear()
}

/** Test helper: wait until every queued batch has been processed. */
export async function flushStorageWatcherForTests() {
    for (const username of [...state.pending.keys()]) flush(username)
    await Promise.all([...state.processing.values()])
}

/** Test helper: feed an event as the watcher would. */
export function simulateStorageEventForTests(filename: string) {
    onEvent('rename', filename)
}
