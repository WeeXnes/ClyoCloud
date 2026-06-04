import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { defineEventHandler, getRouterParam, setHeader, createError } from 'h3'
import mime from 'mime-types'
import path, { join, resolve } from 'path'
import { isFilePublic } from '~/server/utils/publicCheck'

import { logActivity } from '~/server/utils/activityLogger'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const username = getRouterParam(event, 'username')
    const filePath = getRouterParam(event, 'path')

    if (!username || !filePath) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Username and file path are required',
        })
    }

    const decodedPath = decodeURIComponent(filePath)
    const userStoragePath = path.join(config.storagePath, username)
    const resolvedPath = resolve(join(userStoragePath, decodedPath))

    if (!resolvedPath.startsWith(resolve(userStoragePath))) {
        throw createError({
            statusCode: 403,
            statusMessage: 'Access denied',
        })
    }

    // Check if file is public
    const publicAccess = await isFilePublic(config.storagePath, username, decodedPath)
    if (!publicAccess) {
        throw createError({
            statusCode: 404,
            statusMessage: 'File not found or not public',
        })
    }

    try {
        const stats = await stat(resolvedPath)
        if (!stats.isFile()) {
            throw createError({
                statusCode: 404,
                statusMessage: 'File not found',
            })
        }

        const contentType = mime.lookup(resolvedPath) || 'application/octet-stream'
        const videoTypes = ['video/mp4', 'video/webm', 'application/mp4']
        if (!videoTypes.includes(contentType)) {
            throw createError({
                statusCode: 415,
                statusMessage: 'Unsupported media type',
            })
        }

        // Log public streaming access
        await logActivity(username, 'PUBLIC_STREAM', decodedPath, `Public streaming access to ${decodedPath}`, event)

        setHeader(event, 'Content-Type', contentType)
        setHeader(event, 'Accept-Ranges', 'bytes')
        setHeader(event, 'Content-Disposition', 'inline')

        const range = event.node.req.headers.range
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-')
            const start = parseInt(parts[0], 10)
            const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1
            const chunkSize = end - start + 1

            if (start >= stats.size || end >= stats.size) {
                throw createError({
                    statusCode: 416,
                    statusMessage: 'Range not satisfiable',
                })
            }

            setHeader(event, 'Content-Range', `bytes ${start}-${end}/${stats.size}`)
            setHeader(event, 'Content-Length', chunkSize)
            event.node.res.statusCode = 206 // Partial Content

            return createReadStream(resolvedPath, { start, end })
        } else {
            setHeader(event, 'Content-Length', stats.size)
            return createReadStream(resolvedPath)
        }
    } catch (error: any) {
        console.error('Error streaming public file:', error)
        throw createError({
            statusCode: error.statusCode || 404,
            statusMessage: error.statusMessage || 'File not found',
        })
    }
})
