import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import os from 'os'

// Compute CPU cores and max concurrency limit once at startup (caching the resource check)
const CPU_CORES = os.cpus().length
const SERVER_MAX_CONCURRENCY = Math.min(Math.max(CPU_CORES * 2, 4), 32)

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const user = event.context.user

    if (!user || !user.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    try {
        const usersFilePath = config.usersFilePath
        const usersData = await fs.readFile(usersFilePath, 'utf-8')
        const users: any[] = JSON.parse(usersData)

        const userData = users.find((u) => u.name === user.name)
        if (!userData) {
            throw createError({
                statusCode: 404,
                statusMessage: 'User not found',
            })
        }

        return {
            downloadPath: userData.downloadPath || '',
            twoFactorEnabled: userData.twoFactorEnabled || false,
            mobileAutoPreview: userData.mobileAutoPreview ?? true,
            imageViewerMobileFullscreen: userData.imageViewerMobileFullscreen ?? false,
            maxConcurrentPreviews: userData.maxConcurrentPreviews || 3,
            experimentalMode: userData.experimentalMode || false,
            theme: userData.theme || 'onedev',
            slideshowFrequency: userData.slideshowFrequency || 5,
            selectedShortsPaths: userData.selectedShortsPaths || [],
            excludedMediaPaths: userData.excludedMediaPaths || [],
            maxDuplicateResults: userData.maxDuplicateResults || 50,
            storageQuota: userData.storageQuota || null,
            cpuCores: CPU_CORES,
            serverMaxConcurrency: SERVER_MAX_CONCURRENCY
        }
    } catch (error) {
        console.error('Get settings error:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error',
        })
    }
})
