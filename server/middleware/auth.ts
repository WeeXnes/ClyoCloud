import { defineEventHandler, createError, getCookie, sendRedirect } from 'h3'
import jwt from 'jsonwebtoken'
import { consola } from 'consola'
import fs from 'fs/promises'
import { updateDeviceActivity, parseDeviceModel } from '../utils/devices'
import { trafficTracker } from '../utils/trafficTracker'
import { apiLimiter, getClientIP } from '../utils/rateLimiter'

export default defineEventHandler(async (event) => {
    // Normalize URL: lowercase and collapse multiple slashes
    const url = getRequestURL(event).pathname.replace(/\/+/g, '/').toLowerCase()
    const clientIP = getClientIP(event)

    // Record traffic for admin dashboard metrics (after response)
    const method = event.node.req.method || 'GET'
    event.node.res.on('finish', () => {
        const statusCode = event.node.res.statusCode
        const ua = event.node.req.headers['user-agent']
        const isAuth = !!event.context.user
        trafficTracker.record(method, url, statusCode, clientIP, ua, isAuth)
    })

    const publicPaths = [
        '/api/login', 
        '/api/logout', 
        '/login', 
        '/p/', 
        '/api/public', 
        '/api/2fa/verify-login',
        '/_nuxt',
        '/favicon.ico',
        '/robots.txt',
        '/clyo.png',
        '/wicon.png'
    ]

    const isPublic = publicPaths.some((p) => url === p.toLowerCase() || url.startsWith(p.toLowerCase()))

    if (isPublic) {
        consola.info(`[Auth] Public Access: ${url}`)
        return
    }

    let token = getCookie(event, 'token')
    const authHeader = event.node.req.headers['authorization']
    if (!token && authHeader) {
        if (/^Bearer\s+/i.test(authHeader)) {
            token = authHeader.replace(/^Bearer\s+/i, '')
        }
    }

    const config = useRuntimeConfig()
    let isAuthenticated = false
    let decodedUser: any = null

    if (token) {
        try {
            const decoded = jwt.verify(token, config.jwtSecret) as { user: { name: string }, isPartial?: boolean, deviceId?: string, isDevice?: boolean }

            if (!decoded.isPartial) {
                // If it's a device token, verify it still exists
                let deviceValid = true
                if (decoded.isDevice && decoded.deviceId) {
                    const ua = event.node.req.headers['user-agent']
                    const customModel = event.node.req.headers['x-device-model'] as string | undefined
                    const model = parseDeviceModel(ua, customModel)
                    deviceValid = await updateDeviceActivity(decoded.deviceId, model, event)
                }

                if (deviceValid) {
                    // Verify that the user still exists in users.json and read isAdmin
                    const usersData = await fs.readFile(config.usersFilePath, 'utf-8')
                    const users: { name: string; isAdmin?: boolean }[] = JSON.parse(usersData)
                    const foundUser = users.find((u) => u.name === decoded.user.name)
                    if (foundUser) {
                        decodedUser = { 
                            name: decoded.user.name,
                            isAdmin: foundUser.isAdmin === true
                        }
                        isAuthenticated = true
                    }
                }
            }
        } catch (error) {
            // Ignore verification error here; it will be handled when accessing protected routes
        }
    }

    // Rate limiting ONLY for unauthenticated API requests
    if (!isAuthenticated && url.startsWith('/api/')) {
        const apiRateResult = apiLimiter.check(clientIP)
        if (!apiRateResult.allowed) {
            consola.warn(`[Auth] Rate limited unauthenticated request: ${url} for IP ${clientIP}`)
            throw createError({
                statusCode: 429,
                statusMessage: 'Too many requests. Please slow down.',
            })
        }
    }

    if (isPublic) {
        consola.info(`[Auth] Public Access: ${url}`)
        if (isAuthenticated) {
            event.context.user = decodedUser
        }
        return
    }

    // Protect all other API, Stream, File, and Page routes
    consola.start(`[Auth] Protecting Route: ${url}`)

    if (!isAuthenticated) {
        consola.warn(`[Auth] Blocked (Unauthenticated): ${url}`)
        if (event.node.req.headers.accept?.includes('text/html')) {
            return sendRedirect(event, '/login', 302)
        }
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized: Authentication required',
        })
    }

    event.context.user = decodedUser
    consola.success(`[Auth] Verified: ${url} (User: ${decodedUser.name}${decodedUser.isAdmin ? ', Admin' : ''})`)
})