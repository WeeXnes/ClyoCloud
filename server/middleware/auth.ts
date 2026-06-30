import { defineEventHandler, createError, getCookie, sendRedirect } from 'h3'
import jwt from 'jsonwebtoken'
import { consola } from 'consola'
import fs from 'fs/promises'

export default defineEventHandler(async (event) => {
    // Normalize URL: lowercase and collapse multiple slashes
    const url = getRequestURL(event).pathname.replace(/\/+/g, '/').toLowerCase()

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

    // Protect all other API, Stream, File, and Page routes
    consola.start(`[Auth] Protecting Route: ${url}`)
    const config = useRuntimeConfig()
    const token = getCookie(event, 'token')

    if (!token) {
        consola.warn(`[Auth] Blocked (No Token): ${url}`)
        if (event.node.req.headers.accept?.includes('text/html')) {
            return sendRedirect(event, '/login', 302)
        }
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized: No token provided',
        })
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret) as { user: { name: string }, isPartial?: boolean }

        // If it's a partial token (for 2FA), only allow verify-login (handled above)
        // Any other protected route should be rejected
        if (decoded.isPartial) {
            consola.warn(`[Auth] Blocked (2FA Required): ${url} for user ${decoded.user.name}`)
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized: 2FA required',
            })
        }

        // Verify that the user still exists in users.json
        try {
            const usersData = await fs.readFile(config.usersFilePath, 'utf-8')
            const users: { name: string }[] = JSON.parse(usersData)
            const userExists = users.some((u) => u.name === decoded.user.name)
            if (!userExists) {
                consola.warn(`[Auth] Blocked (User deleted): ${url} for user ${decoded.user.name}`)
                throw createError({
                    statusCode: 401,
                    statusMessage: 'Unauthorized: User does not exist',
                })
            }
        } catch (fileError: any) {
            if (fileError.statusCode === 401) throw fileError
            consola.error(`[Auth] Error reading user database during validation:`, fileError)
            throw createError({
                statusCode: 500,
                statusMessage: 'Internal Server Error: Failed to validate user',
            })
        }

        event.context.user = decoded.user // Attach user to context for API/routes
        consola.success(`[Auth] Verified: ${url} (User: ${decoded.user.name})`)
    } catch (error: any) {
        if (error.statusCode === 401) throw error

        consola.error(`[Auth] Token Error: ${url}`, error.message)
        if (event.node.req.headers.accept?.includes('text/html')) {
            return sendRedirect(event, '/login', 302)
        }
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized: Invalid token',
        })
    }
})