import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { File, FileMeta } from '~/types/File'

async function findFavorites(dirPath: string, userStoragePath: string): Promise<File[]> {
    let favorites: File[] = []
    const items = await fs.readdir(dirPath, { withFileTypes: true })

    for (const item of items) {
        if (item.name.endsWith('.cloudinfo')) continue

        const fullPath = path.join(dirPath, item.name)
        const cloudInfoPath = `${fullPath}.cloudinfo`
        const relativePath = path.relative(userStoragePath, fullPath)

        let meta: FileMeta | null = null
        try {
            const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8')
            meta = JSON.parse(cloudInfoContent)
        } catch {
            // No meta found
        }

        if (meta && meta.isFavourite) {
            const stats = await fs.stat(fullPath)
            favorites.push({
                name: relativePath, // Use relative path for favorites view
                size: stats.size,
                type: path.extname(item.name),
                lastModified: stats.mtime.getTime(),
                isFolder: stats.isDirectory(),
                meta
            })
        }

        if (item.isDirectory()) {
            const subFavorites = await findFavorites(fullPath, userStoragePath)
            favorites = favorites.concat(subFavorites)
        }
    }

    return favorites
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

        const favorites = await findFavorites(userStoragePath, userStoragePath)

        return favorites
    } catch (error) {
        console.error('Error fetching favorites:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not fetch favorites',
        })
    }
})
