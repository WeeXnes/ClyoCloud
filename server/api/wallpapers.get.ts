import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { File, FileMeta } from '~/types/File'
import { getWallpapersIndex, saveWallpapersIndex, type WallpaperEntry } from '~/server/utils/wallpapers'
import { getDirSize } from '~/server/utils/fileUtils'
import { isPathWithin } from '~/server/utils/fileUtils'

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

        let wallpapers = await getWallpapersIndex(username)
        const isInitialScan = wallpapers.length === 0

        if (isInitialScan) {
            // First time or empty index, perform a full scan once
            wallpapers = await performFullScan(userStoragePath)
            if (wallpapers.length > 0) {
                await saveWallpapersIndex(username, wallpapers)
            }
        }

        const wallpaperFiles: File[] = []

        // Process wallpapers from index
        await Promise.all(wallpapers.map(async (entry) => {
            const fullPath = path.join(userStoragePath, entry.path)
            if (!isPathWithin(userStoragePath, fullPath)) return

            let cloudInfoPath = `${fullPath}.cloudinfo`

            try {
                const stats = await fs.stat(fullPath)
                let cloudInfoContent = ''
                try {
                    cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8')
                } catch (readErr) {
                    if (baseName.length > 100) {
                        const legacyPath = path.join(dirName, `${baseName.substring(0, 100)}.cloudinfo`)
                        cloudInfoContent = await fs.readFile(legacyPath, 'utf-8')
                    } else {
                        throw readErr
                    }
                }
                
                const meta = JSON.parse(cloudInfoContent) as FileMeta
                
                // Final check to ensure it's still marked as wallpaper
                if (meta.isWallpaper) {
                    let size = stats.size
                    if (entry.isFolder) {
                        size = await getDirSize(fullPath)
                    }

                    wallpaperFiles.push({
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

        wallpaperFiles.sort((a, b) => {
            if (a.isFolder !== b.isFolder) {
                return a.isFolder ? -1 : 1
            }
            return a.name.localeCompare(b.name)
        })

        return wallpaperFiles
    } catch (error) {
        console.error('Error fetching wallpapers:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not fetch wallpapers',
        })
    }
})

async function performFullScan(userStoragePath: string): Promise<WallpaperEntry[]> {
    const wallpapers: WallpaperEntry[] = []

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
                if (meta.isWallpaper) {
                    wallpapers.push({ path: relPath, isFolder: entry.isDirectory() })
                }
            } catch {}

            if (entry.isDirectory()) {
                await scan(fullPath, relPath)
            }
        }
    }

    try {
        await scan(userStoragePath, '')
    } catch (err) {
        console.error('Error scanning for wallpapers:', err)
    }
    return wallpapers
}
