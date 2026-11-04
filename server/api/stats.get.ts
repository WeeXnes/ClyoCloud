import { defineEventHandler, createError } from 'h3'
import path from 'path'
import si from 'systeminformation'
import { getUserUsage } from '~/server/utils/storageStats'

/**
 * Caches a slow systeminformation probe. Once a value exists, requests get it straight away
 * and a stale one is refreshed in the background. The first call waits at most `timeoutMs`
 * (df can hang on a dead network mount), answering null if the probe is slower.
 */
function cachedProbe<T>(probe: () => Promise<T>, ttlMs: number, timeoutMs: number) {
    let value: T | null = null
    let fetchedAt = 0
    let running: Promise<T | null> | null = null

    function refresh() {
        if (!running) {
            running = probe()
                .then((result) => {
                    value = result
                    fetchedAt = Date.now()
                    return result
                })
                .catch((err) => {
                    console.error('[STATS] System probe failed:', err)
                    return value
                })
                .finally(() => {
                    running = null
                })
        }
        return running
    }

    return async function get(): Promise<T | null> {
        if (value !== null) {
            if (Date.now() - fetchedAt > ttlMs) refresh()
            return value
        }
        let timer: ReturnType<typeof setTimeout> | undefined
        const result = await Promise.race([
            refresh(),
            new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), timeoutMs) }),
        ])
        clearTimeout(timer)
        return result
    }
}

const getCpuInfo = cachedProbe(() => si.cpu(), Infinity, 3000)
const getMemory = cachedProbe(() => si.mem(), 5000, 2000)
const getLoad = cachedProbe(() => si.currentLoad(), 5000, 2000)
const getFsStats = cachedProbe(() => si.fsSize(), 30000, 3000)

// Warm up caches asynchronously on boot
getCpuInfo().catch(() => {})
getMemory().catch(() => {})
getLoad().catch(() => {})
getFsStats().catch(() => {})

const VIRTUAL_FS_TYPES = ['tmpfs', 'devtmpfs', 'overlay', 'squashfs', 'efivarfs']

function isUnder(mount: string, target: string) {
    const relative = path.relative(mount, target)
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    try {
        const config = useRuntimeConfig()
        const storagePath = path.resolve(config.storagePath)

        // Usage is a full tree scan on a cold cache: wait briefly, then answer with the last
        // known value (or none) and let the client poll while the scan finishes in the background.
        const [usage, memory, cpuInfo, load, fsStats] = await Promise.all([
            getUserUsage(event.context.user.name, 1000),
            getMemory(),
            getCpuInfo(),
            getLoad(),
            getFsStats(),
        ])

        // Filter out virtual and system file systems
        const relevantDrives = (fsStats || []).filter(f =>
            f.size > 0 &&
            !f.mount.startsWith('/sys') &&
            !f.mount.startsWith('/proc') &&
            !f.mount.startsWith('/dev') &&
            !f.mount.startsWith('/run') &&
            !VIRTUAL_FS_TYPES.includes(f.type)
        )

        // The partition holding storagePath is the most specific mount containing it
        // ("/" contains everything, so the longest match wins)
        const storageDisk = relevantDrives
            .filter(f => isUnder(f.mount, storagePath))
            .sort((a, b) => b.mount.length - a.mount.length)[0] || relevantDrives[0] || fsStats?.[0]

        return {
            used: usage.value ?? null,
            usedPending: usage.pending,
            total: storageDisk?.size ?? null,
            free: storageDisk?.available ?? null,
            drives: fsStats ? relevantDrives.map(f => ({
                mount: f.mount,
                label: f.fs,
                total: f.size,
                used: f.used,
                available: f.available,
                use: f.use
            })) : null,
            ram: memory ? {
                total: memory.total,
                used: memory.active, // Active memory is a better representation of "used"
                free: memory.available
            } : null,
            cpu: cpuInfo || load ? {
                model: cpuInfo ? `${cpuInfo.manufacturer} ${cpuInfo.brand}` : '',
                cores: cpuInfo?.cores ?? 0,
                load: load?.currentLoad ?? null // already a 0-100 percentage
            } : null,
            username: event.context.user.name
        }
    } catch (error) {
        console.error('Error fetching stats:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not fetch storage stats',
        })
    }
})
