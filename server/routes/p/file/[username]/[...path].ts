import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { defineEventHandler, getRouterParam, setHeader, createError } from 'h3'
import mime from 'mime-types'
import path, { join, resolve } from 'path'
import { isFilePublic } from '~/server/utils/publicCheck'
import archiver from 'archiver'
import { logActivity } from '~/server/utils/activityLogger'

import { isPathWithin } from '~/server/utils/fileUtils'

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

    if (!isPathWithin(userStoragePath, resolvedPath)) {
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
        
        if (stats.isDirectory()) {
            const archive = archiver('zip', { zlib: { level: 9 } });
            const fileName = `${path.basename(resolvedPath)}.zip`;
            
            // Log public zip download
            await logActivity(username, 'PUBLIC_ZIP_DOWNLOAD', decodedPath, `Public ZIP download of ${decodedPath}`, event)

            setHeader(event, 'Content-Type', 'application/zip');
            setHeader(event, 'Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
            
            archive.pipe(event.node.res);
            archive.glob('**/*', {
                cwd: resolvedPath,
                ignore: ['**/*.cloudinfo']
            });
            await archive.finalize();
            return;
        }

        if (!stats.isFile()) {
            throw createError({
                statusCode: 404,
                statusMessage: 'File not found',
            })
        }

        const contentType = mime.lookup(resolvedPath) || 'application/octet-stream'

        // Log public access
        await logActivity(username, 'PUBLIC_ACCESS', decodedPath, `Public access to ${decodedPath}`, event)

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
        console.error('Error serving public file:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Internal Server Error',
        })
    }
})
