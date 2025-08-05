import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { defineEventHandler, getRouterParam, setHeader, createError } from 'h3'
import mime from 'mime-types'
import path, { join, resolve } from 'path'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const userStoragePath = path.join(config.storagePath, event.context.user.name)
    const filePath = getRouterParam(event, 'path')

    if (!filePath) {
        throw createError({
            statusCode: 400,
            statusMessage: 'File path is required',
        })
    }

    const decodedPath = decodeURIComponent(filePath)
    console.log(`Requested file path: ${decodedPath}`)

    const resolvedPath = resolve(join(userStoragePath, decodedPath))

    if (!resolvedPath.startsWith(resolve(userStoragePath))) {
        console.error(`Access denied: Resolved path ${resolvedPath} is outside user directory ${userStoragePath}`)
        throw createError({
            statusCode: 403,
            statusMessage: 'Access denied: Path outside user directory',
        })
    }

    try {
        const stats = await stat(resolvedPath)
        if (!stats.isFile()) {
            console.error(`Not a file: ${resolvedPath}`)
            throw createError({
                statusCode: 404,
                statusMessage: 'File not found',
            })
        }

        const contentType = mime.lookup(resolvedPath) || 'application/octet-stream'
        console.log(`Serving file: ${resolvedPath}, MIME type: ${contentType}`)

        setHeader(event, 'Content-Type', contentType)
        setHeader(event, 'Content-Length', stats.size)
        setHeader(event, 'Accept-Ranges', 'bytes')

        const inlineTypes = ['image/png', 'image/jpeg', 'image/gif', 'video/mp4', 'video/webm']
        if (inlineTypes.includes(contentType)) {
            setHeader(event, 'Content-Disposition', 'inline')
        } else {
            const encodedFileName = encodeURIComponent(path.basename(resolvedPath))
            setHeader(event, 'Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`)
        }

        return createReadStream(resolvedPath)
    } catch (error: any) {
        console.error('Error serving file:', error)
        throw createError({
            statusCode: 404,
            statusMessage: 'File not found',
        })
    }
})