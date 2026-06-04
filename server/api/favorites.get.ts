import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { File, FileMeta } from '~/types/File'
import { getFavoritesIndex, saveFavoritesIndex, type FavoriteEntry } from '~/server/utils/favorites'
import { getDirSize } from '~/server/utils/fileUtils'

export default defineEventHandler(async (event): Promise<File[]> => {
    try {
        if (!event.context.user) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized',
            })
        }

        const username = event.context.user.name
        const config = useRuntimeConfig()
        const userStoragePath = path.join(config.storagePath, username)

        let favorites = await getFavoritesIndex(username)
        const isInitialScan = favorites.length === 0

        if (isInitialScan) {
            // First time or empty index, perform a full scan once
            favorites = await performFullScan(userStoragePath)
            if (favorites.length > 0) {
                await saveFavoritesIndex(username, favorites)
            }
        }

        const favoriteFiles: File[] = []

        // Process favorites from index
        await Promise.all(favorites.map(async (entry) => {
            const fullPath = path.join(userStoragePath, entry.path)
            const baseName = path.basename(fullPath)
            const dirName = path.dirname(fullPath)
            const cloudInfoFileName = `${baseName.substring(0, 100)}.cloudinfo`
            const cloudInfoPath = path.join(dirName, cloudInfoFileName)

            try {
                const [stats, cloudInfoContent] = await Promise.all([
                    fs.stat(fullPath),
                    fs.readFile(cloudInfoPath, 'utf-8')
                ])
                
                const meta = JSON.parse(cloudInfoContent) as FileMeta
                
                // Final check to ensure it's still a favorite and exists
                if (meta.isFavourite) {
                    let size = stats.size
                    if (entry.isFolder) {
                        size = await getDirSize(fullPath)
                    }

                    favoriteFiles.push({
                        name: entry.path,
                        size,
                        type: path.extname(baseName),
                        lastModified: stats.mtime.getTime(),
                        isFolder: entry.isFolder,
                        meta,
                    })
                }
            } catch (err) {
                // File or meta might have been deleted, ignore
            }
        }))

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

async function performFullScan(userStoragePath: string): Promise<FavoriteEntry[]> {
    const favorites: FavoriteEntry[] = []

    async function scan(currentPath: string, relativePath: string) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true })
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name.endsWith('.cloudinfo')) continue

            const fullPath = path.join(currentPath, entry.name)
            const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
            const cloudInfoPath = `${fullPath}.cloudinfo`

            try {
                const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8')
                const meta = JSON.parse(cloudInfoContent)
                if (meta.isFavourite) {
                    favorites.push({ path: relPath, isFolder: entry.isDirectory() })
                }
            } catch {}

            if (entry.isDirectory()) {
                await scan(fullPath, relPath)
            }
        }
    }

    await scan(userStoragePath, '')
    return favorites
}
