import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'

interface ActivityEntry {
    id: string
    action: string
    path: string
    timestamp: number
    ip?: string
    userAgent?: string
    details?: string
    metadata?: Record<string, any>
}

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    if (!event.context.user.isAdmin) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden: Admin access required' })
    }

    try {
        const config = useRuntimeConfig()

        // Read all users to find their activity logs
        const usersData = await fs.readFile(config.usersFilePath, 'utf-8')
        const users: { name: string }[] = JSON.parse(usersData)

        // Aggregate activity from all users
        const allActivities: (ActivityEntry & { username: string })[] = []

        for (const user of users) {
            try {
                const activityFilePath = path.join(config.storagePath, user.name, '.activity.json')
                const data = await fs.readFile(activityFilePath, 'utf-8')
                const activities: ActivityEntry[] = JSON.parse(data)

                // Only include security-relevant events
                const securityActions = [
                    'LOGIN_SUCCESS', 'LOGIN_FAIL', 'LOGIN_STEP1',
                    '2FA_FAIL', 'PASSWORD_CHANGE',
                    'QR_GENERATE', 'DEVICE_REGISTER', 'DEVICE_REVOKE',
                ]
                
                const filtered = activities
                    .filter(a => securityActions.includes(a.action))
                    .slice(0, 100)  // Cap per user
                    .map(a => ({ ...a, username: user.name }))

                allActivities.push(...filtered)
            } catch {
                // User has no activity log yet — skip
            }
        }

        // Sort by timestamp descending and take top 200
        allActivities.sort((a, b) => b.timestamp - a.timestamp)
        return allActivities.slice(0, 200)
    } catch (err: any) {
        console.error('Admin activity error:', err)
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to fetch admin activity',
        })
    }
})
