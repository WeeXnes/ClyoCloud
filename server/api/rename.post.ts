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

        // Prevent overwriting files/directories
        try {
            const oldStat = await fs.stat(oldFullPath)
            try {
                const newStat = await fs.stat(newFullPath)
                if (oldStat.ino !== newStat.ino || oldStat.dev !== newStat.dev) {
                    throw createError({
                        statusCode: 409,
                        statusMessage: `Destination already exists: ${newName}`,
                    })
                }
            } catch (err: any) {
                if (err.statusCode === 409) throw err
                // destination doesn't exist, proceed
            }
        } catch (err: any) {
            if (err.statusCode === 409) throw err
            // source doesn't exist? let fs.rename handle it or throw
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
