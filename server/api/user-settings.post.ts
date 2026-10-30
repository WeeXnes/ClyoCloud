import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { logActivity } from '../utils/activityLogger'
import { isValidDownloadPath } from '../utils/fileUtils'
import { withFileLock, writeFileAtomic } from '../utils/jsonStore'

// Compute CPU cores and max concurrency limit once at startup (caching the resource check)
const CPU_CORES = os.cpus().length
const DYNAMIC_MAX_CONCURRENCY = Math.min(Math.max(CPU_CORES * 2, 4), 32)

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { downloadPath, mobileAutoPreview, imageViewerMobileFullscreen, maxConcurrentPreviews, experimentalMode, theme, slideshowFrequency, selectedShortsPaths, excludedMediaPaths, maxDuplicateResults } = body
    const config = useRuntimeConfig()
    const user = event.context.user

    if (!user || !user.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    if (!isValidDownloadPath(path.join(config.storagePath, user.name), downloadPath || '')) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Download path must be a folder inside your storage',
        })
    }

    try {
        const usersFilePath = config.usersFilePath
        await withFileLock(usersFilePath, async () => {
            const usersData = await fs.readFile(usersFilePath, 'utf-8')
            const users: any[] = JSON.parse(usersData)

            const userIndex = users.findIndex((u) => u.name === user.name)
            if (userIndex === -1) {
                throw createError({
                    statusCode: 404,
                    statusMessage: 'User not found',
                })
            }

            users[userIndex].downloadPath = downloadPath || ''
            if (typeof mobileAutoPreview === 'boolean') {
                users[userIndex].mobileAutoPreview = mobileAutoPreview
            }
            if (typeof imageViewerMobileFullscreen === 'boolean') {
                users[userIndex].imageViewerMobileFullscreen = imageViewerMobileFullscreen
            }
            if (typeof experimentalMode === 'boolean') {
                users[userIndex].experimentalMode = experimentalMode
            }
            if (typeof maxConcurrentPreviews === 'number') {
                const maxLimit = users[userIndex].experimentalMode ? 200 : DYNAMIC_MAX_CONCURRENCY
                users[userIndex].maxConcurrentPreviews = Math.max(1, Math.min(maxLimit, maxConcurrentPreviews))
            }

            if (theme) {
                users[userIndex].theme = theme
            }

            if (typeof slideshowFrequency === 'number') {
                users[userIndex].slideshowFrequency = Math.max(2, Math.min(50, slideshowFrequency))
            }

            if (Array.isArray(selectedShortsPaths)) {
                users[userIndex].selectedShortsPaths = selectedShortsPaths
            }

            if (Array.isArray(excludedMediaPaths)) {
                users[userIndex].excludedMediaPaths = excludedMediaPaths
            }

            if (typeof maxDuplicateResults === 'number') {
                users[userIndex].maxDuplicateResults = Math.max(10, Math.min(1000, maxDuplicateResults))
            }

            await writeFileAtomic(usersFilePath, JSON.stringify(users, null, 2))
        })

        await logActivity(user.name, 'SETTINGS_UPDATE', 'Settings', 'User preferences updated', event)

        return { message: 'Settings updated successfully' }
    } catch (error) {
        console.error('Update settings error:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error',
        })
    }
})
