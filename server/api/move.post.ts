import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import { moveInFavorites } from '~/server/utils/favorites'

import { isPathWithin, clearUserCache } from '~/server/utils/fileUtils'

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
        const { paths, destination } = body

        if (!paths || !Array.isArray(paths) || paths.length === 0) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Missing or invalid paths',
            })
        }

        const destinationPath = destination || ''
        const destinationFullPath = path.resolve(path.join(userStoragePath, destinationPath))

        // Security check for destination
        if (!isPathWithin(userStoragePath, destinationFullPath)) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Access denied: Destination outside user directory',
            })
        }

        // Ensure destination is a directory
        try {
            const destStats = await fs.stat(destinationFullPath)
            if (!destStats.isDirectory()) {
                throw new Error('Destination is not a directory')
            }
        } catch (e: any) {
            throw createError({
                statusCode: 400,
                statusMessage: `Invalid destination: ${e.message}`,
            })
        }

        const results = []

        for (const itemPath of paths) {
            const oldFullPath = path.resolve(path.join(userStoragePath, itemPath))
            const itemName = path.basename(oldFullPath)
            const newFullPath = path.resolve(path.join(destinationFullPath, itemName))

            // Security check for each item
            if (!isPathWithin(userStoragePath, oldFullPath) || !isPathWithin(userStoragePath, newFullPath)) {
                console.warn(`[SECURITY] Blocked move attempt: ${oldFullPath} -> ${newFullPath}`)
                continue
            }

            // Prevent moving a folder into itself or its own subfolders
            if (destinationFullPath.startsWith(oldFullPath + path.sep) || destinationFullPath === oldFullPath) {
                results.push({ path: itemPath, success: false, error: 'Cannot move a folder into itself' })
                continue
            }

            if (oldFullPath === newFullPath) {
                results.push({ path: itemPath, success: true, skipped: true })
                continue
            }

            try {
                // Prevent overwriting files/directories
                const oldStat = await fs.stat(oldFullPath)
                try {
                    const newStat = await fs.stat(newFullPath)
                    if (oldStat.ino !== newStat.ino || oldStat.dev !== newStat.dev) {
                        results.push({ path: itemPath, success: false, error: 'Destination already exists' })
                        continue
                    }
                } catch {
                    // destination doesn't exist, proceed
                }
            } catch (err: any) {
                results.push({ path: itemPath, success: false, error: 'Source file does not exist' })
                continue
            }

            try {
                // Rename the file/folder
                await fs.rename(oldFullPath, newFullPath)

                const relativeOldPath = path.relative(userStoragePath, oldFullPath)
                const relativeNewPath = path.relative(userStoragePath, newFullPath)
                await logActivity(event.context.user.name, 'MOVE', relativeOldPath, `Moved to ${relativeNewPath}`, event, { 
                    from: relativeOldPath, 
                    to: relativeNewPath 
                })

                // Also move the .cloudinfo file if it exists
                const oldCloudInfo = `${oldFullPath}.cloudinfo`
                const newCloudInfo = `${newFullPath}.cloudinfo`
                
                try {
                    await fs.access(oldCloudInfo)
                    await fs.rename(oldCloudInfo, newCloudInfo)
                } catch {
                    // No cloudinfo to move
                }
                
                // Update tag cache
                moveFileInCache(event.context.user.name, itemPath, relativeNewPath.replace(/\\/g, '/'))

                results.push({ path: itemPath, success: true })
            } catch (err: any) {
                console.error(`Error moving ${itemPath}:`, err)
                results.push({ path: itemPath, success: false, error: err.message })
            }
        }

        if (results.some(r => r.success && !r.skipped)) {
            const successfulMoves = results.filter(r => r.success && !r.skipped).map(r => r.path)
            await moveInFavorites(event.context.user.name, successfulMoves, destinationPath)
        }

        clearUserCache(event.context.user.name)

        return { success: true, results }
    } catch (error: any) {
        console.error('Error in move API:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not move items',
        })
    }
})
