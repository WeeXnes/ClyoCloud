import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { File, FileMeta } from '~/types/File'

export default defineEventHandler(async (event): Promise<File[]> => {
    try {
        if (!event.context.user) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized',
            })
        }

        const config = useRuntimeConfig()
        const userStoragePath = path.join(config.storagePath, event.context.user.name)

        const favoriteFiles: File[] = []

        async function scanDir(currentPath: string, relativePath: string) {
            const entries = await fs.readdir(currentPath, { withFileTypes: true })
            
            // Map entries to their metadata and check for favorites
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name.endsWith('.cloudinfo')) continue

                const fullPath = path.join(currentPath, entry.name)
                const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
                
                if (entry.isDirectory()) {
                    // Check if the directory itself is a favorite
                    await checkFavorite(fullPath, relPath, true)
                    // Recurse into directory
                    await scanDir(fullPath, relPath)
                } else if (entry.isFile()) {
                    await checkFavorite(fullPath, relPath, false)
                }
            }
        }

        async function checkFavorite(fullPath: string, relPath: string, isFolder: boolean) {
            const dirName = path.dirname(fullPath)
            const baseName = path.basename(fullPath)
            const cloudInfoFileName = `${baseName.substring(0, 100)}.cloudinfo`
            const cloudInfoPath = path.join(dirName, cloudInfoFileName)

            try {
                const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8')
                const meta = JSON.parse(cloudInfoContent) as FileMeta

                if (meta.isFavourite) {
                    const stats = await fs.stat(fullPath)
                    let size = stats.size
                    
                    if (isFolder) {
                        size = await getDirSize(fullPath)
                    }

                    favoriteFiles.push({
                        name: relPath, // Use relative path as name in Favorites view
                        size,
                        type: path.extname(baseName),
                        lastModified: stats.mtime.getTime(),
                        isFolder,
                        meta,
                    })
                }
            } catch (err) {
                // No cloudinfo or invalid JSON, skip
            }
        }

        const sizeCache = new Map<string, number>()
        async function getDirSize(dirPath: string): Promise<number> {
            if (sizeCache.has(dirPath)) return sizeCache.get(dirPath)!
            
            let totalSize = 0
            try {
                const files = await fs.readdir(dirPath, { withFileTypes: true })
                for (const file of files) {
                    const filePath = path.join(dirPath, file.name)
                    if (file.isDirectory()) {
                        totalSize += await getDirSize(filePath)
                    } else if (file.isFile()) {
                        const stats = await fs.stat(filePath)
                        totalSize += stats.size
                    }
                }
                sizeCache.set(dirPath, totalSize)
            } catch (err) {}
            return totalSize
        }

        await scanDir(userStoragePath, '')

        favoriteFiles.sort((a, b) => {
            if (a.isFolder !== b.isFolder) {
                return a.isFolder ? -1 : 1
            }
            return a.name.localeCompare(b.name)
        })

        return favoriteFiles
    } catch (error) {
        console.error('Error fetching favorites:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not fetch favorites',
        })
    }
})
