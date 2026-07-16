import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import si from 'systeminformation'
import { getDirSize } from '~/server/utils/fileUtils'

// Static CPU info cache
let cachedCpuInfo: any = null
async function getCpuInfo() {
    if (!cachedCpuInfo) {
        cachedCpuInfo = await si.cpu()
    }
    return cachedCpuInfo
}

// Memory cache
let cachedMemory: any = null
let lastMemoryFetch = 0
const MEM_CACHE_TTL = 5000 // 5 seconds
async function getMemory() {
    const now = Date.now()
    if (!cachedMemory || now - lastMemoryFetch > MEM_CACHE_TTL) {
        cachedMemory = await si.mem()
        lastMemoryFetch = now
    }
    return cachedMemory
}

// Load cache
let cachedLoad: any = null
let lastLoadFetch = 0
const LOAD_CACHE_TTL = 5000 // 5 seconds
async function getLoad() {
    const now = Date.now()
    if (!cachedLoad || now - lastLoadFetch > LOAD_CACHE_TTL) {
        cachedLoad = await si.currentLoad()
        lastLoadFetch = now
    }
    return cachedLoad
}

// FS size cache
let cachedFsStats: any = null
let lastFsStatsFetch = 0
const FS_CACHE_TTL = 30000 // 30 seconds
async function getFsStats() {
    const now = Date.now()
    if (!cachedFsStats || now - lastFsStatsFetch > FS_CACHE_TTL) {
        cachedFsStats = await si.fsSize()
        lastFsStatsFetch = now
    }
    return cachedFsStats
}

// Warm up caches asynchronously on boot
getCpuInfo().catch((err) => console.error('Failed to warm CPU cache:', err))
getMemory().catch(() => {})
getLoad().catch(() => {})
getFsStats().catch(() => {})

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    try {
        const config = useRuntimeConfig()
        const userStoragePath = path.join(config.storagePath, event.context.user.name)
        
        let dynamicStats = 0
        try {
            await fs.access(userStoragePath)
            dynamicStats = await getDirSize(userStoragePath)
        } catch {
            // Directory doesn't exist, size is 0
        }

        // Parallelize system calls using the cached/warmed methods
        const [memory, cpuInfo, load, fsStats] = await Promise.all([
            getMemory(),
            getCpuInfo(),
            getLoad(),
            getFsStats()
        ])

        // Filter out virtual and system file systems
        const relevantDrives = fsStats.filter(f => 
            f.size > 0 && 
            !f.mount.startsWith('/sys') && 
            !f.mount.startsWith('/proc') && 
            !f.mount.startsWith('/dev') && 
            !f.mount.startsWith('/run') &&
            !['tmpfs', 'devtmpfs', 'overlay', 'squashfs', 'efivarfs'].includes(f.type)
        )

        // Find the correct partition for storagePath
        const storageDisk = relevantDrives.find(f => config.storagePath.startsWith(f.mount)) || relevantDrives[0] || fsStats[0]

        return {
            used: dynamicStats,
            total: storageDisk?.size,
            free: storageDisk?.available,
            drives: relevantDrives.map(f => ({
                mount: f.mount,
                label: f.fs,
                total: f.size,
                used: f.used,
                available: f.available,
                use: f.use
            })),
            ram: {
                total: memory.total,
                used: memory.active, // Active memory is a better representation of "used"
                free: memory.available
            },
            cpu: {
                model: `${cpuInfo.manufacturer} ${cpuInfo.brand}`,
                cores: cpuInfo.cores,
                load: load.currentLoad // This is already a 0-100 percentage
            },
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
