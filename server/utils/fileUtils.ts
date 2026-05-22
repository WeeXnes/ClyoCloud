import fs from 'fs/promises'
import path from 'path'

const sizeCache = new Map<string, { size: number; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes cache for dir sizes

export async function getDirSize(dirPath: string): Promise<number> {
    const cached = sizeCache.get(dirPath)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.size
    }

    let totalSize = 0
    try {
        const files = await fs.readdir(dirPath, { withFileTypes: true })
        const sizes = await Promise.all(files.map(async (file) => {
            const filePath = path.join(dirPath, file.name)
            if (file.isDirectory()) {
                return await getDirSize(filePath)
            } else if (file.isFile()) {
                const stats = await fs.stat(filePath)
                return stats.size
            }
            return 0
        }))
        totalSize = sizes.reduce((a, b) => a + b, 0)
        sizeCache.set(dirPath, { size: totalSize, timestamp: Date.now() })
    } catch (err) {}
    return totalSize
}

/**
 * Force clear the directory size cache for a specific path (useful when files are added/deleted)
 */
export function clearSizeCache(dirPath: string) {
    sizeCache.delete(dirPath)
    // Also clear parent caches as their sizes are now invalid
    const parentPath = path.dirname(dirPath)
    if (parentPath && parentPath !== dirPath) {
        clearSizeCache(parentPath)
    }
}
