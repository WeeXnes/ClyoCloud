import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import si from 'systeminformation'
import { trafficTracker } from '../../utils/trafficTracker'
import { getAllRateLimitStatus } from '../../utils/rateLimiter'
import { readDevicesData } from '../../utils/devices'
import { geolocateIP } from '../../utils/geolocator'

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    if (!event.context.user.isAdmin) {
        throw createError({ statusCode: 403, statusMessage: 'Forbidden: Admin access required' })
    }

    try {
        const config = useRuntimeConfig()

        // Gather all data in parallel
        const [usersData, devicesData, memory, load] = await Promise.all([
            fs.readFile(config.usersFilePath, 'utf-8').then(d => JSON.parse(d)).catch(() => []),
            readDevicesData(),
            si.mem(),
            si.currentLoad()
        ])

        // Users (strip passwords)
        const users = (usersData as any[]).map(u => ({
            name: u.name,
            isAdmin: u.isAdmin === true,
            twoFactorEnabled: u.twoFactorEnabled === true,
        }))

        // Devices per user
        const devicesSummary: { username: string; devices: any[] }[] = []
        let totalDevices = 0
        for (const [username, devices] of Object.entries(devicesData)) {
            const deviceList = Array.isArray(devices) ? devices : []
            totalDevices += deviceList.length
            devicesSummary.push({
                username,
                devices: deviceList.map(d => ({
                    id: d.id,
                    model: d.model,
                    createdAt: d.createdAt,
                    lastActive: d.lastActive,
                }))
            })
        }

        // Traffic metrics
        const traffic = trafficTracker.getSnapshot()

        // Geolocate top client IPs
        const geolocatedTopIPs = await Promise.all(
            traffic.topIPs.map(async (ipData) => {
                const geo = await geolocateIP(ipData.ip)
                return {
                    ...ipData,
                    geo
                }
            })
        )
        traffic.topIPs = geolocatedTopIPs

        // Rate limit status
        const rateLimits = getAllRateLimitStatus()

        // Node.js process info
        const memUsage = process.memoryUsage()

        return {
            server: {
                uptimeMs: traffic.uptimeMs,
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                processMemory: {
                    rss: memUsage.rss,
                    heapUsed: memUsage.heapUsed,
                    heapTotal: memUsage.heapTotal,
                    external: memUsage.external,
                },
                system: {
                    cpuLoad: load.currentLoad,
                    cpuCores: load.cpus?.length || 0,
                    ramTotal: memory.total,
                    ramUsed: memory.active,
                    ramFree: memory.available,
                }
            },
            users,
            totalDevices,
            devices: devicesSummary,
            traffic,
            rateLimits,
        }
    } catch (err: any) {
        console.error('Admin stats error:', err)
        throw createError({
            statusCode: 500,
            statusMessage: 'Failed to fetch admin stats',
        })
    }
})
