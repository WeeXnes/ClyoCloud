import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import crypto from 'crypto'
import { isPathWithin } from './fileUtils'

export interface TrashItem {
    id: string
    name: string
    originalPath: string
    trashedAt: number
    size: number
    isDirectory: boolean
    storedName: string
    hasCloudInfo: boolean
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * A stored name must be a single path segment, so it can only ever point directly inside .trash.
 */
export function isSafeTrashName(name: unknown): name is string {
    return typeof name === 'string'
        && name.length > 0
        && name !== '.'
        && name !== '..'
        && !name.includes('\0')
        && !/[\\/]/.test(name)
}

/**
 * Get and ensure user .trash directory
 */
export async function getTrashDir(username: string): Promise<string> {
    const config = useRuntimeConfig()
    const userStoragePath = path.join(config.storagePath, username)
    const trashDir = path.join(userStoragePath, '.trash')
    
    if (!fsSync.existsSync(trashDir)) {
        await fs.mkdir(trashDir, { recursive: true })
    }
    return trashDir
}

/**
 * Read trash metadata receipts
 */
export async function loadTrashMetadata(username: string): Promise<TrashItem[]> {
    const trashDir = await getTrashDir(username)
    const metaFile = path.join(trashDir, 'metadata.json')
    try {
        const raw = await fs.readFile(metaFile, 'utf-8')
        const items = JSON.parse(raw)
        if (!Array.isArray(items)) return []
        // Never trust receipts read from disk: every trash operation builds paths from storedName
        return items.filter((item) => isSafeTrashName(item?.storedName)) as TrashItem[]
    } catch {
        return []
    }
}

/**
 * Save trash metadata receipts
 */
export async function saveTrashMetadata(username: string, items: TrashItem[]): Promise<void> {
    const trashDir = await getTrashDir(username)
    const metaFile = path.join(trashDir, 'metadata.json')
    await fs.writeFile(metaFile, JSON.stringify(items, null, 2), 'utf-8')
}

/**
 * Auto-purge items in trash older than 30 days
 */
export async function purgeOldTrash(username: string, maxAgeMs = THIRTY_DAYS_MS): Promise<number> {
    const trashDir = await getTrashDir(username)
    const items = await loadTrashMetadata(username)
    const now = Date.now()

    const remaining: TrashItem[] = []
    let purgedCount = 0

    for (const item of items) {
        if (now - item.trashedAt > maxAgeMs) {
            purgedCount++
            const itemPath = path.join(trashDir, item.storedName)
            const cloudInfoPath = path.join(trashDir, `${item.storedName}.cloudinfo`)

            try {
                if (item.isDirectory) {
                    await fs.rm(itemPath, { recursive: true, force: true })
                } else {
                    await fs.unlink(itemPath)
                }
            } catch (err) {
                console.error(`[TRASH] Error purging expired item ${itemPath}:`, err)
            }

            try {
                if (item.hasCloudInfo) {
                    await fs.unlink(cloudInfoPath)
                }
            } catch {}
        } else {
            remaining.push(item)
        }
    }

    if (purgedCount > 0) {
        await saveTrashMetadata(username, remaining)
        console.log(`[TRASH] Auto-purged ${purgedCount} expired trash items for user ${username}`)
    }

    return purgedCount
}

/**
 * Move a file or folder into .trash with receipt
 */
export async function moveToTrash(username: string, relativePath: string): Promise<TrashItem> {
    const config = useRuntimeConfig()
    const userStoragePath = path.resolve(config.storagePath, username)
    const fullPath = path.resolve(userStoragePath, relativePath)

    if (!isPathWithin(userStoragePath, fullPath) || fullPath === userStoragePath) {
        throw new Error('Invalid path for trash operation')
    }

    const stats = await fs.stat(fullPath)
    const isDirectory = stats.isDirectory()
    const size = stats.size
    const baseName = path.basename(fullPath)

    const trashDir = await getTrashDir(username)
    const id = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const storedName = `${id}_${baseName}`
    const trashDestination = path.join(trashDir, storedName)

    // Move file/directory to trash
    await fs.rename(fullPath, trashDestination)

    // Check and move accompanying .cloudinfo
    let hasCloudInfo = false
    const cloudInfoPath = `${fullPath}.cloudinfo`
    const trashCloudInfoPath = path.join(trashDir, `${storedName}.cloudinfo`)
    try {
        if (fsSync.existsSync(cloudInfoPath)) {
            await fs.rename(cloudInfoPath, trashCloudInfoPath)
            hasCloudInfo = true
        }
    } catch (e) {
        console.warn(`[TRASH] Could not move .cloudinfo for ${relativePath}:`, e)
    }

    const trashItem: TrashItem = {
        id,
        name: baseName,
        originalPath: relativePath.replace(/\\/g, '/'),
        trashedAt: Date.now(),
        size,
        isDirectory,
        storedName,
        hasCloudInfo
    }

    const items = await loadTrashMetadata(username)
    items.unshift(trashItem)
    await saveTrashMetadata(username, items)

    // Run background purge of items > 30 days
    purgeOldTrash(username).catch(() => {})

    return trashItem
}

/**
 * Restore an item from trash back to user's storage
 */
export async function restoreFromTrash(username: string, id: string): Promise<{ success: boolean; restoredPath: string }> {
    const config = useRuntimeConfig()
    const userStoragePath = path.resolve(config.storagePath, username)
    const trashDir = await getTrashDir(username)
    const items = await loadTrashMetadata(username)

    const itemIndex = items.findIndex(item => item.id === id)
    if (itemIndex === -1) {
        throw new Error('Item not found in trash')
    }

    const item = items[itemIndex]
    const storedPath = path.join(trashDir, item.storedName)

    if (!fsSync.existsSync(storedPath)) {
        // Stored file is missing, clean receipt
        items.splice(itemIndex, 1)
        await saveTrashMetadata(username, items)
        throw new Error('Trashed file is no longer on disk')
    }

    let targetPath = path.resolve(userStoragePath, item.originalPath)
    if (!isPathWithin(userStoragePath, targetPath)) {
        targetPath = path.resolve(userStoragePath, item.name)
    }

    // Ensure target parent directory exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true })

    // If destination already exists, append timestamp to prevent overwrite
    if (fsSync.existsSync(targetPath)) {
        const ext = path.extname(item.name)
        const nameWithoutExt = path.basename(item.name, ext)
        const uniqueName = `${nameWithoutExt}_restored_${Date.now()}${ext}`
        targetPath = path.join(path.dirname(targetPath), uniqueName)
    }

    // Move file back
    await fs.rename(storedPath, targetPath)

    // Restore .cloudinfo if present
    if (item.hasCloudInfo) {
        const storedCloudInfo = path.join(trashDir, `${item.storedName}.cloudinfo`)
        const targetCloudInfo = `${targetPath}.cloudinfo`
        try {
            if (fsSync.existsSync(storedCloudInfo)) {
                await fs.rename(storedCloudInfo, targetCloudInfo)
            }
        } catch {}
    }

    // Remove from metadata
    items.splice(itemIndex, 1)
    await saveTrashMetadata(username, items)

    const finalRelative = path.relative(userStoragePath, targetPath).replace(/\\/g, '/')
    return { success: true, restoredPath: finalRelative }
}

/**
 * Permanently delete a single item from trash
 */
export async function permanentlyDeleteFromTrash(username: string, id: string): Promise<void> {
    const trashDir = await getTrashDir(username)
    const items = await loadTrashMetadata(username)

    const itemIndex = items.findIndex(item => item.id === id)
    if (itemIndex === -1) return

    const item = items[itemIndex]
    const storedPath = path.join(trashDir, item.storedName)
    const storedCloudInfo = path.join(trashDir, `${item.storedName}.cloudinfo`)

    try {
        if (item.isDirectory) {
            await fs.rm(storedPath, { recursive: true, force: true })
        } else {
            await fs.unlink(storedPath)
        }
    } catch {}

    try {
        if (item.hasCloudInfo) {
            await fs.unlink(storedCloudInfo)
        }
    } catch {}

    items.splice(itemIndex, 1)
    await saveTrashMetadata(username, items)
}

/**
 * Empty entire trash for user
 */
export async function emptyTrash(username: string): Promise<number> {
    const trashDir = await getTrashDir(username)
    const items = await loadTrashMetadata(username)
    const count = items.length

    for (const item of items) {
        const storedPath = path.join(trashDir, item.storedName)
        const storedCloudInfo = path.join(trashDir, `${item.storedName}.cloudinfo`)
        try {
            if (item.isDirectory) {
                await fs.rm(storedPath, { recursive: true, force: true })
            } else {
                await fs.unlink(storedPath)
            }
        } catch {}
        try {
            await fs.unlink(storedCloudInfo)
        } catch {}
    }

    await saveTrashMetadata(username, [])
    return count
}

/**
 * List all items in trash
 */
export async function listTrash(username: string): Promise<TrashItem[]> {
    await purgeOldTrash(username)
    return await loadTrashMetadata(username)
}
