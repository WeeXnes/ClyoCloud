import { defineEventHandler, getQuery, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { FileMeta } from '~/types/File'
import { isFilePublic } from '~/server/utils/publicCheck'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const query = getQuery(event)
    const username = query.username?.toString()
    const filePath = query.path?.toString()

    if (!username || !filePath) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Username and path are required',
        })
    }

    const decodedPath = decodeURIComponent(filePath)
    const publicAccess = await isFilePublic(config.storagePath, username, decodedPath)
    
    if (!publicAccess) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized: File is not public',
        })
    }

    const userStoragePath = path.join(config.storagePath, username)
    const fullPath = path.join(userStoragePath, decodedPath)

    try {
        const stats = await fs.stat(fullPath)
        const cloudInfoPath = `${fullPath}.cloudinfo`
        let meta: FileMeta = { tags: [] }

        try {
            const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8')
            meta = JSON.parse(cloudInfoContent) as FileMeta
        } catch {
            // No meta found
        }

        return {
            name: path.basename(fullPath),
            size: stats.size,
            lastModified: stats.mtime.getTime(),
            type: path.extname(fullPath),
            meta,
            username // Useful for frontend to construct links
        }
    } catch (error) {
        throw createError({
            statusCode: 404,
            statusMessage: 'File not found',
        })
    }
})
