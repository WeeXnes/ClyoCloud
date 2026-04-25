import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import os from 'node:os'

async function getDirSize(dirPath: string): Promise<number> {
    const files = await fs.readdir(dirPath, { withFileTypes: true })
    const paths = files.map(async file => {
        const filePath = path.join(dirPath, file.name)
        if (file.isDirectory()) return await getDirSize(filePath)
        if (file.isFile()) {
            const { size } = await fs.stat(filePath)
            return size
        }
        return 0
    })
    return (await Promise.all(paths)).reduce((acc, size) => acc + size, 0)
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
        const userStoragePath = path.join(config.storagePath, event.context.user.name)
        
        // Ensure user directory exists
        await fs.mkdir(userStoragePath, { recursive: true })
        
        const usedSize = await getDirSize(userStoragePath)
        
        // Get total disk space where storagePath resides
        const stats = await fs.statfs(config.storagePath)
        const totalSize = stats.blocks * stats.bsize
        const freeSize = stats.bfree * stats.bsize

        // Get RAM stats
        const totalRam = os.totalmem()
        const freeRam = os.freemem()
        const usedRam = totalRam - freeRam

        return {
            used: usedSize,
            total: totalSize,
            free: freeSize,
            ram: {
                total: totalRam,
                used: usedRam,
                free: freeRam
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
