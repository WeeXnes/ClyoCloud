import fs from 'fs/promises'
import path from 'path'
import { consola } from 'consola'
import { getRequestIP, getHeader, type H3Event } from 'h3'
import { v4 as uuidv4 } from 'uuid'

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

export async function logActivity(
    username: string, 
    action: string, 
    filePath: string, 
    details?: string, 
    event?: H3Event, 
    metadata?: Record<string, any>
) {
    try {
        const config = useRuntimeConfig()
        const userStoragePath = path.join(config.storagePath, username)
        const activityFilePath = path.join(userStoragePath, '.activity.json')

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
            newEntry.ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
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
