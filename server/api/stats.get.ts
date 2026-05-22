import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import si from 'systeminformation'
import { getDirSize } from '~/server/utils/fileUtils'

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
        
        // Parallelize system calls
        const [dynamicStats, memory, cpuInfo, load, fsStats] = await Promise.all([
            getDirSize(userStoragePath),
            si.mem(),
            si.cpu(),
            si.currentLoad(),
            si.fsSize()
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
