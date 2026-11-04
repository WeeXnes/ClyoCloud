import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import { isPathWithin, isTrashPath } from '~/server/utils/fileUtils'
import { updateFileMeta } from '~/server/utils/fileMeta'
import { logActivity } from '~/server/utils/activityLogger'

export default defineEventHandler(async (event) => {
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
        const body = await readBody(event)
        const { fullPath, description, tags, isPublic, isFavourite, previewImage, isWallpaper, isPhotoWidget } = body

        if (!fullPath || typeof fullPath !== 'string') {
            throw createError({
                statusCode: 400,
                statusMessage: 'Missing fullPath',
            })
        }

        const filePath = path.resolve(path.join(userStoragePath, fullPath))
        if (!isPathWithin(userStoragePath, filePath) || isTrashPath(userStoragePath, filePath) || filePath === userStoragePath) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Access denied',
            })
        }

        try {
            await fs.access(filePath)
        } catch {
            throw createError({
                statusCode: 404,
                statusMessage: 'File not found',
            })
        }

        const relativePath = path.relative(userStoragePath, filePath)
        const meta = await updateFileMeta(username, relativePath, (meta) => {
            if (description !== undefined) meta.description = description
            if (previewImage !== undefined) meta.previewImage = previewImage
            if (tags !== undefined) meta.tags = Array.isArray(tags) ? tags : []
            if (isPublic !== undefined) meta.isPublic = isPublic
            if (isFavourite !== undefined) meta.isFavourite = isFavourite
            if (isWallpaper !== undefined) {
                meta.isWallpaper = isWallpaper
                // The "Wallpaper" badge goes with the flag, unless this same request sets the tags itself
                if (!isWallpaper && tags === undefined) {
                    meta.tags = (meta.tags || []).filter(t => String(t?.name).toLowerCase() !== 'wallpaper')
                }
            }
            if (isPhotoWidget !== undefined) meta.isPhotoWidget = isPhotoWidget
        })

        if (previewImage !== undefined) {
            await logActivity(username, 'FOLDER_ICON', fullPath, previewImage ? `Set preview image to ${previewImage}` : 'Reset preview image', event)
        }
        if (tags !== undefined) await logActivity(username, 'TAG', fullPath, 'Updated tags', event)
        if (isPublic !== undefined) {
            await logActivity(username, 'SHARE', fullPath, isPublic ? 'Enabled public access' : 'Disabled public access', event)
        }
        if (isFavourite !== undefined) {
            await logActivity(username, 'FAVORITE', fullPath, isFavourite ? 'Added to favorites' : 'Removed from favorites', event)
        }
        if (isWallpaper !== undefined) {
            await logActivity(username, 'WALLPAPER', fullPath, isWallpaper ? 'Added to wallpapers' : 'Removed from wallpapers', event)
        }
        if (isPhotoWidget !== undefined) {
            await logActivity(username, 'PHOTO_WIDGET', fullPath, isPhotoWidget ? 'Added to photo widgets' : 'Removed from photo widgets', event)
        }

        return { success: true, meta }
    } catch (error: any) {
        console.error('Error updating meta:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not update metadata',
        })
    }
})
