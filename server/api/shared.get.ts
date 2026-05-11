import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { File, FileMeta } from '~/types/File'

async function findSharedFiles(dirPath: string, userStoragePath: string): Promise<File[]> {
    let shared: File[] = []
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

        if (meta && meta.isPublic) {
            const stats = await fs.stat(fullPath)
            shared.push({
                name: relativePath,
                size: stats.size,
                type: path.extname(item.name),
                lastModified: stats.mtime.getTime(),
                isFolder: stats.isDirectory(),
                meta
            })
        }

        if (item.isDirectory()) {
            const subShared = await findSharedFiles(fullPath, userStoragePath)
            shared = subShared.concat(shared)
        }
    }

    return shared
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

        const shared = await findSharedFiles(userStoragePath, userStoragePath)

        return shared
    } catch (error) {
        console.error('Error fetching shared files:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not fetch shared files',
        })
    }
})
