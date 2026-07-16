import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import { getDirSize, storageMapCache } from '~/server/utils/fileUtils'

interface StorageNode {
    name: string
    size: number
    children?: StorageNode[]
}

const STORAGE_MAP_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export default defineEventHandler(async (event) => {
    try {
        if (!event.context.user) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized',
            })
        }

        const username = event.context.user.name

        // Check cache first
        const cached = storageMapCache.get(username)
        if (cached && Date.now() - cached.timestamp < STORAGE_MAP_CACHE_TTL) {
            return cached.data
        }

        const config = useRuntimeConfig()
        const userStoragePath = path.join(config.storagePath, username)

        // Return early with empty root if user directory does not exist
        try {
            await fs.access(userStoragePath)
        } catch {
            const emptyRoot: StorageNode = { name: 'root', size: 0 }
            storageMapCache.set(username, { data: emptyRoot, timestamp: Date.now() })
            return emptyRoot
        }

        async function getStorageMap(dirPath: string, name: string, depth: number = 0): Promise<StorageNode> {
            const node: StorageNode = { name, size: 0 }
            
            try {
                const entries = await fs.readdir(dirPath, { withFileTypes: true })
                const children: StorageNode[] = []
                let totalSize = 0

                // Batch stats requests for better performance
                const entryStats = await Promise.all(entries.map(async (entry) => {
                    if (entry.name.startsWith('.') || entry.name.endsWith('.cloudinfo')) return null
                    const fullPath = path.join(dirPath, entry.name)
                    
                    if (entry.isDirectory()) {
                        if (depth < 2) { // Limit depth for map visualization to keep it fast
                            const childNode = await getStorageMap(fullPath, entry.name, depth + 1)
                            return { type: 'dir', name: entry.name, node: childNode }
                        } else {
                            const size = await getDirSize(fullPath)
                            return { type: 'dir', name: entry.name, size }
                        }
                    } else if (entry.isFile()) {
                        const stats = await fs.stat(fullPath)
                        return { type: 'file', name: entry.name, size: stats.size }
                    }
                    return null
                }))

                for (const stat of entryStats) {
                    if (!stat) continue
                    if (stat.type === 'dir') {
                        if (stat.node) {
                            totalSize += stat.node.size
                            children.push(stat.node)
                        } else {
                            totalSize += stat.size
                            children.push({ name: stat.name, size: stat.size })
                        }
                    } else {
                        totalSize += stat.size
                        children.push({ name: stat.name, size: stat.size })
                    }
                }

                node.size = totalSize
                if (children.length > 0) {
                    // Sort children by size descending for better visualization
                    node.children = children.sort((a, b) => b.size - a.size)
                }
            } catch (err) {
                console.error(`Error mapping ${dirPath}:`, err)
            }

            return node
        }

        const mapData = await getStorageMap(userStoragePath, 'root')
        storageMapCache.set(username, { data: mapData, timestamp: Date.now() })
        return mapData
    } catch (error) {
        console.error('Error generating storage map:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not generate storage map',
        })
    }
})
