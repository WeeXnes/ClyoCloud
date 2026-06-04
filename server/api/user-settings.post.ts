import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import { logActivity } from '../utils/activityLogger'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { downloadPath, tvheadendHost, tvheadendPort, tvheadendUser, tvheadendPassword, mobileAutoPreview, maxConcurrentPreviews, experimentalMode, theme } = body
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

        const userIndex = users.findIndex((u) => u.name === user.name)
        if (userIndex === -1) {
            throw createError({
                statusCode: 404,
                statusMessage: 'User not found',
            })
        }

        users[userIndex].downloadPath = downloadPath || ''
        users[userIndex].tvheadendHost = tvheadendHost || ''
        users[userIndex].tvheadendPort = tvheadendPort || '9981'
        users[userIndex].tvheadendUser = tvheadendUser || ''
        users[userIndex].tvheadendPassword = tvheadendPassword || ''
        if (typeof mobileAutoPreview === 'boolean') {
            users[userIndex].mobileAutoPreview = mobileAutoPreview
        }
        if (typeof experimentalMode === 'boolean') {
            users[userIndex].experimentalMode = experimentalMode
        }
        if (typeof maxConcurrentPreviews === 'number') {
            const maxLimit = users[userIndex].experimentalMode ? 200 : 10
            users[userIndex].maxConcurrentPreviews = Math.max(1, Math.min(maxLimit, maxConcurrentPreviews))
        }

        if (theme) {
            users[userIndex].theme = theme
        }

        await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8')

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
