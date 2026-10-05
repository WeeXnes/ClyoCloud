import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { File, FileMeta } from '~/types/File'
import { isPathWithin, getDirSize } from '~/server/utils/fileUtils'

export default defineEventHandler(async (event): Promise<File[]> => {
    try {
        if (!event.context.user || !event.context.user.name) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized',
            })
        }

        const username = event.context.user.name
        const config = useRuntimeConfig()
        const userStoragePath = path.resolve(path.join(config.storagePath, username))

        const photoWidgetFiles: File[] = []

        async function scan(currentPath: string, relativePath: string) {
            let entries
            try {
                entries = await fs.readdir(currentPath, { withFileTypes: true })
            } catch {
                return
            }

            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name.endsWith('.cloudinfo')) continue

                const fullPath = path.join(currentPath, entry.name)
                const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name
                const cloudInfoPath = `${fullPath}.cloudinfo`

                try {
                    const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8')
                    const meta = JSON.parse(cloudInfoContent) as FileMeta
                    if (meta.isPhotoWidget) {
                        const stats = await fs.stat(fullPath)
                        let size = stats.size
                        if (entry.isDirectory()) {
                            size = await getDirSize(fullPath)
                        }

                        photoWidgetFiles.push({
                            name: relPath,
                            size,
                            type: path.extname(entry.name),
                            lastModified: stats.mtime.getTime(),
                            isFolder: entry.isDirectory(),
                            meta,
                        })
                    }
                } catch {
                    // No meta or unreadable, continue
                }

                if (entry.isDirectory()) {
                    await scan(fullPath, relPath)
                }
            }
        }

        await scan(userStoragePath, '')

        photoWidgetFiles.sort((a, b) => {
            if (a.isFolder !== b.isFolder) {
                return a.isFolder ? -1 : 1
            }
            return a.name.localeCompare(b.name)
        })

        return photoWidgetFiles
    } catch (error: any) {
        if (error.statusCode) throw error
        console.error('Error fetching photo-widgets:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not fetch photo widgets',
        })
    }
})
