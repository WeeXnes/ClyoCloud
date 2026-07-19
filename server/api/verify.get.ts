// server/api/verify.ts
import { defineEventHandler, getCookie, createError, getQuery } from 'h3'
import jwt from 'jsonwebtoken'
import fs from 'fs/promises'
import { activateDevice, isDeviceValid } from '../utils/deviceRegistry'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()

    // Case-insensitive Bearer token extraction
    const authHeader = event.node.req.headers['authorization'] || ''
    const bearerToken = authHeader.replace(/^bearer\s+/i, '')
    const token = getCookie(event, 'token') || (bearerToken !== authHeader ? bearerToken : '')

    if (!token) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized: No token provided',
        })
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret) as {
            user: { name: string }
            isPartial?: boolean
            deviceId?: string
        }

        // Reject partial (2FA-pending) tokens
        if (decoded.isPartial) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized: 2FA required',
            })
        }

        // Verify the user still exists in users.json
        try {
            const usersData = await fs.readFile(config.usersFilePath, 'utf-8')
            const users: { name: string }[] = JSON.parse(usersData)
            const userExists = users.some((u) => u.name === decoded.user.name)
            if (!userExists) {
                throw createError({
                    statusCode: 401,
                    statusMessage: 'Unauthorized: User does not exist',
                })
            }
        } catch (fileError: any) {
            if (fileError.statusCode === 401) throw fileError
            console.error('[Verify] Error reading user database:', fileError)
            throw createError({
                statusCode: 500,
                statusMessage: 'Internal Server Error: Failed to validate user',
            })
        }

        // Handle device-bound tokens (from QR code login)
        if (decoded.deviceId) {
            const valid = await isDeviceValid(decoded.user.name, decoded.deviceId)
            if (!valid) {
                throw createError({
                    statusCode: 401,
                    statusMessage: 'Unauthorized: Device has been revoked',
                })
            }

            // Activate device with model name from query parameter
            const query = getQuery(event)
            const deviceModel = (query.deviceModel as string) || ''
            if (deviceModel) {
                await activateDevice(decoded.user.name, decoded.deviceId, deviceModel)
            }
        }

        return { user: decoded.user }
    } catch (error: any) {
        if (error.statusCode) throw error
        console.error('JWT verification error:', error)
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized: Invalid token',
        })
    }
})