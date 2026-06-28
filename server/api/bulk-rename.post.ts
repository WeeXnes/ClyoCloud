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
        const { folderPath, renames } = body

        if (!renames || !Array.isArray(renames)) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Missing or invalid renames list',
            })
        }

        const folderFullPath = path.resolve(path.join(userStoragePath, folderPath || ''))
        
        // Security check
        if (!isPathWithin(userStoragePath, folderFullPath)) {
            throw createError({
                statusCode: 403,
                statusMessage: 'Access denied',
            })
        }

        // Validate that there are no duplicate target names in the request
        const newNamesSet = new Set<string>()
        for (const r of renames) {
            if (!r.oldName || !r.newName) {
                throw createError({
                    statusCode: 400,
                    statusMessage: 'Each rename entry must have oldName and newName',
                })
            }
            if (newNamesSet.has(r.newName)) {
                throw createError({
                    statusCode: 400,
                    statusMessage: `Duplicate target name in request: ${r.newName}`,
                })
            }
            newNamesSet.add(r.newName)
        }

        // 1. Dry run: Verify all old files exist, and check if any new name exists outside of the selection
        const oldNamesSet = new Set(renames.map(r => r.oldName))
        const renamePlan = []

        for (const r of renames) {
            const oldFullPath = path.resolve(path.join(folderFullPath, r.oldName))
            const newFullPath = path.resolve(path.join(folderFullPath, r.newName))

            // Security check on each file path
            if (!isPathWithin(userStoragePath, oldFullPath) || !isPathWithin(userStoragePath, newFullPath)) {
                throw createError({
                    statusCode: 403,
                    statusMessage: 'Access denied',
                })
            }

            // Verify source file/folder exists and get its stat
            let oldStat
            try {
                oldStat = await fs.stat(oldFullPath)
            } catch {
                throw createError({
                    statusCode: 404,
                    statusMessage: `Source file does not exist: ${r.oldName}`,
                })
            }

            // Check if target name already exists on disk
            try {
                const newStat = await fs.stat(newFullPath)
                
                // If it resolves to the same device/inode, it's the exact same file (e.g. case-only change)
                if (oldStat.ino === newStat.ino && oldStat.dev === newStat.dev) {
                    // This is fine
                } else {
                    // It's a different file! Check if it's part of the files we are renaming.
                    // If it is NOT in oldNamesSet, then it's an external file we would overwrite!
                    if (!oldNamesSet.has(r.newName)) {
                        throw createError({
                            statusCode: 409,
                            statusMessage: `Target file already exists: ${r.newName}`,
                        })
                    }
                }
            } catch (err: any) {
                // If it doesn't exist (ENOENT), that's perfect.
                if (err.code !== 'ENOENT') {
                    throw err
                }
            }

            // Generate unique temp name for safety
            const randSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
            const tempName = `${r.newName}.tmp_${randSuffix}`
            const tempFullPath = path.resolve(path.join(folderFullPath, tempName))

            renamePlan.push({
                oldName: r.oldName,
                newName: r.newName,
                oldFullPath,
                tempFullPath,
                newFullPath,
            })
        }

        // 2. Phase 1: Rename all source files to temporary names
        const completedPhase1: Array<{ oldFullPath: string; tempFullPath: string; hasCloudInfo: boolean }> = []
        try {
            for (const item of renamePlan) {
                await fs.rename(item.oldFullPath, item.tempFullPath)
                
                let hasCloudInfo = false
                const oldCloudInfo = `${item.oldFullPath}.cloudinfo`
                const tempCloudInfo = `${item.tempFullPath}.cloudinfo`
                try {
                    await fs.access(oldCloudInfo)
                    await fs.rename(oldCloudInfo, tempCloudInfo)
                    hasCloudInfo = true
                } catch {
                    // No cloudinfo
                }

                completedPhase1.push({
                    oldFullPath: item.oldFullPath,
                    tempFullPath: item.tempFullPath,
                    hasCloudInfo,
                })
            }
        } catch (error: any) {
            // Rollback Phase 1
            console.error('Error during bulk-rename Phase 1, rolling back...', error)
            for (const item of completedPhase1.reverse()) {
                try {
                    await fs.rename(item.tempFullPath, item.oldFullPath)
                    if (item.hasCloudInfo) {
                        await fs.rename(`${item.tempFullPath}.cloudinfo`, `${item.oldFullPath}.cloudinfo`)
                    }
                } catch (rollbackErr) {
                    console.error(`Failed to rollback rename of ${item.tempFullPath}:`, rollbackErr)
                }
            }
            throw createError({
                statusCode: 500,
                statusMessage: `Bulk rename failed during initial phase: ${error.message || error}`,
            })
        }

        // 3. Phase 2: Rename temporary files to final names
        try {
            for (const item of renamePlan) {
                await fs.rename(item.tempFullPath, item.newFullPath)

                const oldCloudInfo = `${item.tempFullPath}.cloudinfo`
                const newCloudInfo = `${item.newFullPath}.cloudinfo`
                try {
                    await fs.access(oldCloudInfo)
                    await fs.rename(oldCloudInfo, newCloudInfo)
                } catch {
                    // No cloudinfo
                }

                // Update caches and logs
                const relativeOldPath = path.relative(userStoragePath, item.oldFullPath).replace(/\\/g, '/')
                const relativeNewPath = path.relative(userStoragePath, item.newFullPath).replace(/\\/g, '/')
                
                await logActivity(event.context.user.name, 'RENAME', relativeOldPath, `Renamed to ${relativeNewPath} (Bulk)`, event, {
                    from: relativeOldPath,
                    to: relativeNewPath
                })

                const relativeOldPathParam = folderPath ? `${folderPath}/${item.oldName}` : item.oldName
                const relativeNewPathParam = folderPath ? `${folderPath}/${item.newName}` : item.newName
                
                // Update tag cache
                moveFileInCache(event.context.user.name, relativeOldPathParam, relativeNewPathParam.replace(/\\/g, '/'))

                // Update favorites index if needed
                await renameInFavorites(event.context.user.name, relativeOldPathParam, relativeNewPathParam.replace(/\\/g, '/'))
            }
        } catch (error: any) {
            console.error('Critical error during bulk-rename Phase 2:', error)
            throw createError({
                statusCode: 500,
                statusMessage: `Bulk rename was partially successful, but failed at the final step: ${error.message || error}`,
            })
        }

        return { success: true }
    } catch (error: any) {
        console.error('Error in bulk-rename endpoint:', error)
        throw createError({
            statusCode: error.statusCode || 500,
            statusMessage: error.statusMessage || 'Could not bulk rename files',
        })
    }
})
