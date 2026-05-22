import { defineEventHandler, getQuery, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { File, FileMeta } from '~/types/File'

export default defineEventHandler(async (event): Promise<File[]> => {
    try {
        const config = useRuntimeConfig()
        const userStoragePath = path.join(config.storagePath, event.context.user.name)
        const query = getQuery(event)
        const subPath = query.path ? query.path.toString() : ''

        const safeSubPath = path.normalize(subPath).replace(/^(\.\.(\/|\\|$))+/, '')
        const fullPath = path.join(userStoragePath, safeSubPath)

        // Ensure path is within user's directory
        if (!fullPath.startsWith(userStoragePath)) {
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

                const cloudInfoFileName = `${name.substring(0, 100)}.cloudinfo`
                const cloudInfoPath = path.join(fullPath, cloudInfoFileName)

                let meta: FileMeta = { tags: [] }

                try {
                    const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8')
                    meta = JSON.parse(cloudInfoContent) as FileMeta
                } catch {
                    // Skip automatic creation of .cloudinfo files to reduce I/O
                    // It will be created when meta is actually set (e.g. by tagging)
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