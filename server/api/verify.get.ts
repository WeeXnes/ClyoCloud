// server/api/verify.ts
import { defineEventHandler, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'
import fs from 'fs/promises'
import { updateDeviceActivity, parseDeviceModel } from '../utils/devices'
import { getJwtSecret } from '../utils/jwtConfig'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    
    let token = getCookie(event, 'token')
    const authHeader = event.node.req.headers['authorization']
    if (!token && authHeader) {
        if (/^Bearer\s+/i.test(authHeader)) {
            token = authHeader.replace(/^Bearer\s+/i, '')
        }
    }

    if (!token) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized: No token provided',
        })
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret()) as { user: { name: string }, isPartial?: boolean, deviceId?: string, isDevice?: boolean }

        // If it's a partial token (for 2FA), block it
        if (decoded.isPartial) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized: 2FA required',
            })
        }

        // Verify that the user still exists in users.json and read isAdmin
        const usersData = await fs.readFile(config.usersFilePath, 'utf-8')
        const users: { name: string; isAdmin?: boolean }[] = JSON.parse(usersData)
        const foundUser = users.find((u) => u.name === decoded.user.name)
        if (!foundUser) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized: User does not exist',
            })
        }

        const isAdmin = foundUser.isAdmin === true

        // If it's a device token, verify it still exists and update its activity status
        if (decoded.isDevice && decoded.deviceId) {
            const ua = event.node.req.headers['user-agent']
            const customModel = event.node.req.headers['x-device-model'] as string | undefined
            const model = parseDeviceModel(ua, customModel)
            const deviceValid = await updateDeviceActivity(decoded.deviceId, model, event)
            if (!deviceValid) {
                throw createError({
                    statusCode: 401,
                    statusMessage: 'Unauthorized: Device revoked',
                })
            }
        }

        return { user: { ...decoded.user, isAdmin } }
    } catch (error: any) {
        if (error.statusCode === 401) throw error
        console.error('JWT verification error:', error)
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized: Invalid token',
        })
    }
})