import { defineEventHandler, createError, getCookie, sendRedirect } from 'h3'
import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
    const url = getRequestURL(event).pathname.toLowerCase()
    console.log('API request to:', url)

    const publicPaths = ['/api/login', '/api/logout', '/login', '/p/', '/api/public/', '/api/2fa/verify-login']
    if (publicPaths.some((path) => url.startsWith(path.toLowerCase()))) {
        return
    }

    const protectedRoutes = ['/api/', '/stream/', '/file/', '/thumbnail/', '/media/']
    if (!protectedRoutes.some((route) => url.startsWith(route.toLowerCase()))) {
        return
    }

    console.log('Protected route accessed:', url)

    const config = useRuntimeConfig()
    const token = getCookie(event, 'token')

    if (!token) {
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
            throw createError({
                statusCode: 401,
                statusMessage: 'Unauthorized: 2FA required',
            })
        }

        event.context.user = decoded.user // Attach user to context for API/routes
    } catch (error: any) {
        if (error.statusCode === 401) throw error
        
        console.error('JWT verification error:', error)
        if (event.node.req.headers.accept?.includes('text/html')) {
            return sendRedirect(event, '/login', 302)
        }
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized: Invalid token',
        })
    }
})