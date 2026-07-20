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
            return activity // Return all (limited to 1000 by logger)
        } catch (err) {
            return [] // No activity yet
        }
    } catch (error) {
        console.error('Error fetching full activity:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not fetch activity',
        })
    }
})
