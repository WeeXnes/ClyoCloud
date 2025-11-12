import { defineEventHandler, createError, getCookie, sendRedirect } from 'h3'
import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
    const url = getRequestURL(event).pathname.toLowerCase()
    console.log('API request to:', url)

    const publicPaths = ['/api/login', '/api/logout', '/login']
    if (publicPaths.some((path) => url.startsWith(path.toLowerCase()))) {
        return
    }

    const protectedRoutes = ['/stream/', '/file/', '/thumbnail/', '/media/', '/api/files', // Covers GET for listing and DELETE for deletion
        '/api/upload', '/api/videos', '/api/video-tag']
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
        const decoded = jwt.verify(token, config.jwtSecret) as { user: { name: string } }
        event.context.user = decoded.user // Attach user to context for API/routes
    } catch (error) {
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