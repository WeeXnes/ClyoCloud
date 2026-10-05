import { defineEventHandler, getQuery, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { File, FileMeta } from '~/types/File'

import { isPathWithin } from '~/server/utils/fileUtils'

export default defineEventHandler(async (event): Promise<File[]> => {
    try {
        const config = useRuntimeConfig()
        const userStoragePath = path.join(config.storagePath, event.context.user.name)
        const query = getQuery(event)
        const subPath = query.path ? query.path.toString() : ''

        const safeSubPath = path.normalize(subPath).replace(/^(\.\.(\/|\\|$))+/, '')
        const fullPath = path.join(userStoragePath, safeSubPath)

        // Ensure path is within user's directory
        if (!isPathWithin(userStoragePath, fullPath)) {
            console.error(`Access denied: Resolved path ${fullPath} is outside user directory ${userStoragePath}`)
            throw createError({
                statusCode: 403,
                statusMessage: 'Access denied: Path outside user directory',
            })
        }

        const fileNames = await fs.readdir(fullPath)
        const filteredFileNames = fileNames.filter((name) => !name.endsWith('.cloudinfo') && !name.startsWith('.'))

        const files = await Promise.all(
            filteredFileNames.map(async (name) => {
                const filePath = path.join(fullPath, name)
                const stats = await fs.stat(filePath)
                const extension = path.extname(name)
                const isFolder = stats.isDirectory()

                // Folder size calculation is extremely expensive and removed for performance
                let size = stats.size

                const cloudInfoPath = `${filePath}.cloudinfo`
                let meta: FileMeta = { tags: [] }

                try {
                    const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8')
                    meta = JSON.parse(cloudInfoContent) as FileMeta
                } catch {
                    // Fallback to legacy truncated cloudinfo if present
                    if (name.length > 100) {
                        try {
                            const legacyPath = path.join(fullPath, `${name.substring(0, 100)}.cloudinfo`)
                            const cloudInfoContent = await fs.readFile(legacyPath, 'utf-8')
                            meta = JSON.parse(cloudInfoContent) as FileMeta
                        } catch {}
                    }
                }

                return {
                    name,
                    size,
                    type: extension,
                    lastModified: stats.mtime.getTime(),
                    isFolder,
                    meta,
                }
            })
        )

        files.sort((a, b) => {
            if (a.isFolder !== b.isFolder) {
                return a.isFolder ? -1 : 1
            }
            return a.name.localeCompare(b.name)
        })

        return files
    } catch (error) {
        console.error('Error reading files:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not list files',
        })
    }
})