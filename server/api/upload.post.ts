import { createWriteStream, createReadStream } from 'fs'
import { mkdir } from 'fs/promises'
import { defineEventHandler, createError } from 'h3'
import { IncomingForm, Fields, Files } from 'formidable'
import path, { join, resolve } from 'path'
import { isPathWithin, isTrashPath, clearUserCache } from '~/server/utils/fileUtils'
import { checkDiskHeadroom, checkUserQuota } from '~/server/utils/storageQuota'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const userStoragePath = path.join(config.storagePath, event.context.user.name)
    const maxFileSize = config.maxFileSize || 500 * 1024 * 1024 // Default to 500MB

    try {
        const form = new IncomingForm({
            maxFileSize,
            multiples: true,
            keepExtensions: true,
        })

        const { fields, files } = await new Promise<{ fields: Fields; files: Files }>((resolve, reject) => {
            form.parse(event.node.req, (err: Error | null, fields: Fields, files: Files) => {
                if (err) {
                    console.error('Formidable parsing error:', err)
                    return reject(err)
                }
                resolve({ fields, files })
            })
        })

        const folderPath = Array.isArray(fields.path) ? fields.path[0] : fields.path || ''
        const uploadedFiles = Array.isArray(files.files) ? files.files : files.files ? [files.files] : []

        if (uploadedFiles.length === 0) {
            console.error('Files field missing or empty')
            throw createError({
                statusCode: 400,
                statusMessage: 'At least one file is required',
            })
        }

        const decodedPath = decodeURIComponent(folderPath)
        const resolvedDir = resolve(join(userStoragePath, decodedPath))

        // Security check
        if (!isPathWithin(userStoragePath, resolvedDir) || isTrashPath(userStoragePath, resolvedDir)) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Access denied: Path outside user directory',
            })
        }

        // Calculate total incoming size
        const totalUploadSize = uploadedFiles.reduce((acc, f) => acc + (f.size || 0), 0)

        // 1. Host volume disk headroom check (prevent disk exhaustion DOS)
        const headroom = await checkDiskHeadroom(userStoragePath, totalUploadSize)
        if (!headroom.hasSpace) {
            console.error(`[STORAGE] Upload rejected: Insufficient disk headroom. Free: ${headroom.available}, Incoming: ${totalUploadSize}`)
            throw createError({
                statusCode: 507,
                statusMessage: 'Host storage volume is nearly full. Upload rejected to prevent disk exhaustion.',
            })
        }

        // 2. Per-user quota check
        const quotaCheck = await checkUserQuota(event.context.user.name, totalUploadSize)
        if (!quotaCheck.allowed) {
            console.error(`[STORAGE] Upload rejected: Quota exceeded for ${event.context.user.name}`)
            throw createError({
                statusCode: 413,
                statusMessage: quotaCheck.error || 'User storage quota exceeded',
            })
        }

        await mkdir(resolvedDir, { recursive: true })

        for (const fileData of uploadedFiles) {
            const decodedFilename = decodeURIComponent(fileData.originalFilename || 'unnamed_file')
            
            // Security: Prevent uploading .cloudinfo or hidden files
            if (decodedFilename.endsWith('.cloudinfo') || decodedFilename.startsWith('.')) {
                console.warn(`[SECURITY] Blocked upload attempt of sensitive file: ${decodedFilename}`)
                continue // Skip this file
            }

            const resolvedPath = resolve(join(resolvedDir, decodedFilename))
            if (!isPathWithin(resolvedDir, resolvedPath) || isTrashPath(userStoragePath, resolvedPath)) {
                console.warn(`[SECURITY] Blocked directory traversal upload: ${decodedFilename}`)
                continue
            }

            console.log(`Saving file to: ${resolvedPath}`)
            const writeStream = createWriteStream(resolvedPath)
            await new Promise((resolve: any, reject) => {
                const readStream = createReadStream(fileData.filepath)
                readStream.pipe(writeStream)
                writeStream.on('finish', resolve)
                writeStream.on('error', reject)
                readStream.on('error', reject)
            })

            const relativePath = path.relative(userStoragePath, resolvedPath).replace(/\\/g, '/')
            
            // Initial cache update for the uploaded file
            await updateFileInCache(event.context.user.name, relativePath, { tags: [] })

            await logActivity(event.context.user.name, 'UPLOAD', relativePath, undefined, event)
        }

        clearUserCache(event.context.user.name, [resolvedDir])

        return { message: 'Files uploaded successfully' }
    } catch (error: any) {
        console.error('Error uploading file:', error)
        throw createError({
            statusCode: error.statusCode || (error.code === 'ERR_FORM_TOO_LARGE' ? 413 : 500),
            statusMessage: error.statusMessage || error.message || `File too large. Maximum allowed size is ${maxFileSize / 1024 / 1024} MB`,
        })
    }
})