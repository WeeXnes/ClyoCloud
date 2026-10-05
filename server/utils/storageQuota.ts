import fs from 'fs/promises'
import path from 'path'
import { getDirSize } from './fileUtils'

// Minimum reserve headroom on the host storage disk (default: 200 MB)
export const DEFAULT_MIN_HEADROOM = 200 * 1024 * 1024

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * Check if the host disk filesystem has enough available space (preserving safety headroom)
 */
export async function checkDiskHeadroom(
    targetPath: string,
    incomingBytes = 0,
    minHeadroom = DEFAULT_MIN_HEADROOM
): Promise<{ hasSpace: boolean; available: number; freeAfter: number }> {
    try {
        const stats = await fs.statfs(targetPath)
        const available = stats.bavail * stats.bsize
        const freeAfter = available - incomingBytes
        const hasSpace = freeAfter >= minHeadroom

        return {
            hasSpace,
            available,
            freeAfter
        }
    } catch (err) {
        console.warn('[STORAGE] statfs check failed, proceeding cautiously:', err)
        return {
            hasSpace: true,
            available: Number.MAX_SAFE_INTEGER,
            freeAfter: Number.MAX_SAFE_INTEGER
        }
    }
}

/**
 * Check if an operation would exceed the per-user storage quota
 */
export async function checkUserQuota(
    username: string,
    incomingBytes = 0
): Promise<{
    allowed: boolean
    quota: number | null
    used: number
    availableInQuota: number | null
    error?: string
}> {
    const config = useRuntimeConfig()
    const userStoragePath = path.join(config.storagePath, username)

    let quota: number | null = null
    try {
        const usersData = await fs.readFile(config.usersFilePath, 'utf-8')
        const users = JSON.parse(usersData)
        const user = users.find((u: any) => u.name === username)
        if (user && typeof user.storageQuota === 'number' && user.storageQuota > 0) {
            quota = user.storageQuota
        }
    } catch (err) {
        console.error('[STORAGE] Error reading user storageQuota:', err)
    }

    let used = 0
    try {
        used = await getDirSize(userStoragePath)
    } catch {
        used = 0
    }

    if (quota !== null) {
        const availableInQuota = Math.max(0, quota - used)
        if (used + incomingBytes > quota) {
            return {
                allowed: false,
                quota,
                used,
                availableInQuota,
                error: `User storage quota exceeded. Quota: ${formatBytes(quota)}, Current usage: ${formatBytes(used)}, Requested: ${formatBytes(incomingBytes)}`
            }
        }
        return {
            allowed: true,
            quota,
            used,
            availableInQuota
        }
    }

    return {
        allowed: true,
        quota: null,
        used,
        availableInQuota: null
    }
}
