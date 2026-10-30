import fs from 'fs/promises'
import path from 'path'
import { consola } from 'consola'
import { getHeader, type H3Event } from 'h3'
import { v4 as uuidv4 } from 'uuid'
import { getClientIP } from './rateLimiter'

export interface ActivityEntry {
    id: string
    action: string
    path: string
    timestamp: number
    ip?: string
    userAgent?: string
    details?: string
    metadata?: Record<string, any>
}

/**
 * Resolves the path to the user's activity log file, placing it
 * in the parent configuration directory to prevent deletion by media sync tools.
 */
export function getActivityFilePath(username: string): string {
    const config = useRuntimeConfig()
    const parentDir = path.dirname(config.usersFilePath)
    return path.join(parentDir, `activity_${username}.json`)
}

export async function logActivity(
    username: string, 
    action: string, 
    filePath: string, 
    details?: string, 
    event?: H3Event, 
    metadata?: Record<string, any>
) {
    try {
        const activityFilePath = getActivityFilePath(username)

        let activity: ActivityEntry[] = []
        try {
            const data = await fs.readFile(activityFilePath, 'utf-8')
            activity = JSON.parse(data)
        } catch {
            // New activity log
        }

        const newEntry: ActivityEntry = {
            id: uuidv4(),
            action,
            path: filePath,
            timestamp: Date.now(),
            details,
            metadata
        }

        if (event) {
            newEntry.ip = getClientIP(event)
            newEntry.userAgent = getHeader(event, 'user-agent')
        }

        activity.unshift(newEntry)
        // Keep only last 1000 entries
        activity = activity.slice(0, 1000)

        await fs.writeFile(activityFilePath, JSON.stringify(activity, null, 2), 'utf-8')
        
        // Also log to system console for real-time visibility
        consola.info(`[Activity] ${username}: ${action} ${filePath} ${newEntry.ip ? `(${newEntry.ip})` : ''}`)
    } catch (err) {
        consola.error(`[Activity] Failed to log activity for ${username}:`, err)
    }
}
