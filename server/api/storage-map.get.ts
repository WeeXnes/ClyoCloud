import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import { getDirSize } from '~/server/utils/fileUtils'

interface StorageNode {
    name: string
    size: number
    children?: StorageNode[]
}

export default defineEventHandler(async (event) => {
    try {
        if (!event.context.user) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized',
            })
        }

        const config = useRuntimeConfig()
        const userStoragePath = path.join(config.storagePath, event.context.user.name)

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

        return await getStorageMap(userStoragePath, 'root')
    } catch (error) {
        console.error('Error generating storage map:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not generate storage map',
        })
    }
})
