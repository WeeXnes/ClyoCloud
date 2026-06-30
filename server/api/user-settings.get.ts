import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'

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
            maxConcurrentPreviews: userData.maxConcurrentPreviews || 3,
            experimentalMode: userData.experimentalMode || false,
            theme: userData.theme || 'onedev',
            slideshowFrequency: userData.slideshowFrequency || 5,
            selectedShortsPaths: userData.selectedShortsPaths || [],
            excludedMediaPaths: userData.excludedMediaPaths || []
        }
    } catch (error) {
        console.error('Get settings error:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error',
        })
    }
})
