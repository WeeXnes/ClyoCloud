import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import type { H3Event } from 'h3'
import { logActivity } from './activityLogger'

export interface Device {
    id: string;          // UUID
    model: string;       // Device model (e.g. Pixel 7 Pro)
    createdAt: number;   // Timestamp
    lastActive: number;  // Timestamp
}

export interface DevicesData {
    [username: string]: Device[];
}

export async function readDevicesData(): Promise<DevicesData> {
    const config = useRuntimeConfig()
    const devicesFilePath = config.devicesFilePath
    try {
        if (!existsSync(devicesFilePath)) {
            // Ensure parent directory exists
            await fs.mkdir(path.dirname(devicesFilePath), { recursive: true })
            await fs.writeFile(devicesFilePath, '{}', 'utf-8')
            return {}
        }
        const data = await fs.readFile(devicesFilePath, 'utf-8')
        const parsed = JSON.parse(data)
        if (Array.isArray(parsed)) {
            return {}
        }
        return parsed as DevicesData
    } catch (err) {
        console.error('Error reading devices file:', err)
        return {}
    }
}

export async function writeDevicesData(data: DevicesData): Promise<void> {
    const config = useRuntimeConfig()
    const devicesFilePath = config.devicesFilePath
    try {
        await fs.mkdir(path.dirname(devicesFilePath), { recursive: true })
        await fs.writeFile(devicesFilePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
        console.error('Error writing devices file:', err)
    }
}

export async function addDevice(deviceId: string, username: string, model: string): Promise<void> {
    const data = await readDevicesData()
    if (!data[username]) {
        data[username] = []
    }
    const newDevice: Device = {
        id: deviceId,
        model,
        createdAt: Date.now(),
        lastActive: Date.now()
    }
    data[username].push(newDevice)
    await writeDevicesData(data)
}

export async function updateDeviceActivity(deviceId: string, model?: string, event?: H3Event): Promise<boolean> {
    const data = await readDevicesData()
    let found = false
    for (const username in data) {
        const devices = data[username]
        const deviceIndex = devices.findIndex(d => d.id === deviceId)
        if (deviceIndex !== -1) {
            devices[deviceIndex].lastActive = Date.now()
            if (model && (devices[deviceIndex].model === 'Pending Connection...' || devices[deviceIndex].model === 'Unknown Device')) {
                devices[deviceIndex].model = model
                // Log registration
                try {
                    await logActivity(username, 'DEVICE_REGISTER', model, `Device successfully registered via QR Code: ${model}`, event)
                } catch (err) {
                    console.error('Failed to log device registration:', err)
                }
            }
            found = true
            break
        }
    }
    if (found) {
        await writeDevicesData(data)
    }
    return found
}

export async function revokeDevice(deviceId: string, username: string): Promise<boolean> {
    const data = await readDevicesData()
    if (!data[username]) {
        return false
    }
    const originalLength = data[username].length
    data[username] = data[username].filter(d => d.id !== deviceId)
    if (data[username].length === originalLength) {
        return false
    }
    await writeDevicesData(data)
    return true
}

export async function getDevicesForUser(username: string): Promise<Device[]> {
    const data = await readDevicesData()
    return data[username] || []
}

export function parseDeviceModel(ua: string | undefined, customHeader?: string): string {
    if (customHeader && customHeader.trim()) {
        return customHeader.trim()
    }
    if (!ua) {
        return 'Unknown Device'
    }

    // Check for Android Dalvik or standard agent format
    // E.g., Dalvik/2.1.0 (Linux; U; Android 13; Pixel 7 Pro Build/TQ3A.230705.001)
    // E.g., Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro Build/...)
    const androidMatch = ua.match(/\bAndroid\s+[^;]+;\s*([^;)]+)\s+Build\//i)
    if (androidMatch && androidMatch[1]) {
        return androidMatch[1].trim()
    }

    // Try without "Build/" check, just get the token after Android version
    const androidMatch2 = ua.match(/\bAndroid\s+[^;]+;\s*([^;)]+)/i)
    if (androidMatch2 && androidMatch2[1]) {
        const model = androidMatch2[1].trim()
        // Filter out common browser strings if they leak in
        if (!/wv|applewebkit|chrome|safari|mobile/i.test(model)) {
            return model
        }
    }

    // Generic fallbacks
    if (/android/i.test(ua)) {
        return 'Android Device'
    }
    if (/iphone|ipad|ipod/i.test(ua)) {
        return 'iOS Device'
    }
    if (/windows/i.test(ua)) {
        return 'Windows PC'
    }
    if (/macintosh/i.test(ua)) {
        return 'macOS Device'
    }
    if (/linux/i.test(ua)) {
        return 'Linux PC'
    }

    return 'Unknown Device'
}
