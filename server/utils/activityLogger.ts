import fs from 'fs/promises'
import path from 'path'

export interface ActivityEntry {
    action: string
    path: string
    timestamp: number
    details?: string
}

export async function logActivity(username: string, action: string, filePath: string, details?: string) {
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
            action,
            path: filePath,
            timestamp: Date.now(),
            details
        }

        activity.unshift(newEntry)
        // Keep only last 100 entries
        activity = activity.slice(0, 100)

        await fs.writeFile(activityFilePath, JSON.stringify(activity, null, 2), 'utf-8')
    } catch (err) {
        console.error('Failed to log activity:', err)
    }
}
