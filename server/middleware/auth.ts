import { defineEventHandler, createError, getCookie, sendRedirect } from 'h3'
import jwt from 'jsonwebtoken'
import { consola } from 'consola'

export default defineEventHandler(async (event) => {
    const url = getRequestURL(event).pathname.toLowerCase()

    const publicPaths = [
        '/api/login', 
        '/api/logout', 
        '/login', 
        '/p/', 
        '/api/public/', 
        '/api/2fa/verify-login',
        '/_nuxt/',
        '/favicon.ico',
        '/robots.txt',
        '/clyo.png',
        '/wicon.png'
    ]

    if (publicPaths.some((path) => url.startsWith(path.toLowerCase()))) {
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