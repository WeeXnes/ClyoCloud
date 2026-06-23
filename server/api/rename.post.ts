import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import { renameInFavorites } from '~/server/utils/favorites'

import { isPathWithin } from '~/server/utils/fileUtils'

export default defineEventHandler(async (event) => {
    try {
        if (!event.context.user || !event.context.user.name) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized',
            })
        }

        const config = useRuntimeConfig()
        const userStoragePath = path.resolve(path.join(config.storagePath, event.context.user.name))
        const body = await readBody(event)
        const { oldPath, newName } = body

        if (!oldPath || !newName) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Missing oldPath or newName',
            })
        }

        const oldFullPath = path.resolve(path.join(userStoragePath, oldPath))
        const directory = path.dirname(oldFullPath)
        const newFullPath = path.resolve(path.join(directory, newName))

        // Security check
        if (!isPathWithin(userStoragePath, oldFullPath) || !isPathWithin(userStoragePath, newFullPath)) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Access denied',
            })
        }

        // Rename the file/folder
        await fs.rename(oldFullPath, newFullPath)

        const relativeOldPath = path.relative(userStoragePath, oldFullPath)
        const relativeNewPath = path.relative(userStoragePath, newFullPath)
        await logActivity(event.context.user.name, 'RENAME', relativeOldPath, `Renamed to ${relativeNewPath}`, event, {
            from: relativeOldPath,
            to: relativeNewPath
        })

        // Also rename the .cloudinfo file if it exists
        const oldCloudInfo = `${oldFullPath}.cloudinfo`
        const newCloudInfo = `${newFullPath}.cloudinfo`
        
        try {
            await fs.access(oldCloudInfo)
            await fs.rename(oldCloudInfo, newCloudInfo)
        } catch {
            // No cloudinfo to rename
        }

        // Update tag cache
        moveFileInCache(event.context.user.name, oldPath, relativeNewPath.replace(/\\/g, '/'))

        // Update favorites index if needed
        await renameInFavorites(event.context.user.name, oldPath, path.relative(userStoragePath, newFullPath).replace(/\\/g, '/'))

        return { success: true }
    } catch (error: any) {
        console.error('Error renaming file:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not rename file',
        })
    }
})
