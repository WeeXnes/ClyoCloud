import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import type { ActivityEntry } from '~/server/utils/activityLogger'

export default defineEventHandler(async (event) => {
    try {
        if (!event.context.user) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized',
            })
        }

        const activityFilePath = getActivityFilePath(event.context.user.name)

        try {
            const data = await fs.readFile(activityFilePath, 'utf-8')
            const activity: ActivityEntry[] = JSON.parse(data)
            return activity.slice(0, 10) // Return only latest 10 for dashboard
        } catch (err) {
            return [] // No activity yet
        }
    } catch (error) {
        console.error('Error fetching activity:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not fetch activity',
        })
    }
})
