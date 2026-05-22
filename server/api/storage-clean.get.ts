import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { File, FileMeta } from '~/types/File'

const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024 // 500 MB
const OLD_FILE_THRESHOLD = 180 * 24 * 60 * 60 * 1000 // 180 days (approx 6 months)

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    const config = useRuntimeConfig()
    const userStoragePath = path.join(config.storagePath, event.context.user.name)
    const largeFiles: any[] = []
    const oldFiles: any[] = []

    async function scanDir(currentPath: string) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true })
        
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name)
            
            if (entry.isDirectory()) {
                await scanDir(fullPath)
            } else if (entry.isFile() && !entry.name.endsWith('.cloudinfo')) {
                const stats = await fs.stat(fullPath)
                const relativePath = path.relative(userStoragePath, fullPath).replace(/\\/g, '/')
                
                const fileInfo = {
                    name: entry.name,
                    fullPath: relativePath,
                    size: stats.size,
                    lastModified: stats.mtime.getTime(),
                }

                if (stats.size > LARGE_FILE_THRESHOLD) {
                    largeFiles.push(fileInfo)
                }

                if (Date.now() - stats.mtime.getTime() > OLD_FILE_THRESHOLD) {
                    oldFiles.push(fileInfo)
                }
            }
        }
    }

    try {
        await scanDir(userStoragePath)

        // Sort by size (largest first) and age (oldest first)
        return {
            largeFiles: largeFiles.sort((a, b) => b.size - a.size).slice(0, 50),
            oldFiles: oldFiles.sort((a, b) => a.lastModified - b.lastModified).slice(0, 50)
        }
    } catch (error) {
        console.error('Storage cleanup scan error:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not perform storage cleanup scan',
        })
    }
})
