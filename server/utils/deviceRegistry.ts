import fs from 'fs/promises'
import { v4 as uuidv4 } from 'uuid'

export interface RegisteredDevice {
    deviceId: string
    deviceModel: string
    createdAt: string
    lastUsed: string
}

interface DeviceStore {
    [username: string]: RegisteredDevice[]
}

/**
 * Reads the full device registry from disk.
 * Returns an empty object if the file does not exist yet.
 */
async function readStore(): Promise<DeviceStore> {
    const config = useRuntimeConfig()
    try {
        const data = await fs.readFile(config.devicesFilePath, 'utf-8')
        return JSON.parse(data) as DeviceStore
    } catch {
        return {}
    }
}

/**
 * Writes the full device registry to disk.
 */
async function writeStore(store: DeviceStore): Promise<void> {
    const config = useRuntimeConfig()
    await fs.writeFile(config.devicesFilePath, JSON.stringify(store, null, 2), 'utf-8')
}

/**
 * Registers a new pending device for a user.
 * Returns the generated deviceId (UUID).
 */
export async function registerDevice(username: string): Promise<string> {
    const store = await readStore()
    if (!store[username]) {
        store[username] = []
    }
    const deviceId = uuidv4()
    store[username].push({
        deviceId,
        deviceModel: 'Pending Activation',
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
    })
    await writeStore(store)
    return deviceId
}

/**
 * Activates a pending device by setting its model name.
 * Called when the mobile app first verifies with the device-bound token.
 */
export async function activateDevice(username: string, deviceId: string, deviceModel: string): Promise<boolean> {
    const store = await readStore()
    const devices = store[username]
    if (!devices) return false

    const device = devices.find(d => d.deviceId === deviceId)
    if (!device) return false

    device.deviceModel = deviceModel || 'Unknown Device'
    device.lastUsed = new Date().toISOString()
    await writeStore(store)
    return true
}

/**
 * Returns all registered devices for a user.
 */
export async function getDevices(username: string): Promise<RegisteredDevice[]> {
    const store = await readStore()
    return store[username] || []
}

/**
 * Revokes (deletes) a device by its deviceId.
 * Returns true if the device was found and removed.
 */
export async function revokeDevice(username: string, deviceId: string): Promise<boolean> {
    const store = await readStore()
    const devices = store[username]
    if (!devices) return false

    const index = devices.findIndex(d => d.deviceId === deviceId)
    if (index === -1) return false

    devices.splice(index, 1)
    await writeStore(store)
    return true
}

/**
 * Checks whether a deviceId is still registered for a user.
 */
export async function isDeviceValid(username: string, deviceId: string): Promise<boolean> {
    const store = await readStore()
    const devices = store[username]
    if (!devices) return false
    return devices.some(d => d.deviceId === deviceId)
}

/**
 * Updates the lastUsed timestamp for a device.
 * Called on each successful auth check for device-bound tokens.
 */
export async function touchDevice(username: string, deviceId: string): Promise<void> {
    const store = await readStore()
    const devices = store[username]
    if (!devices) return

    const device = devices.find(d => d.deviceId === deviceId)
    if (!device) return

    device.lastUsed = new Date().toISOString()
    await writeStore(store)
}
