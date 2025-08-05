// server/api/verify.ts
import { defineEventHandler, getCookie, createError } from 'h3'
import jwt from 'jsonwebtoken'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const token = getCookie(event, 'token')

    if (!token) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized: No token provided',
        })
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret) as { user: { name: string } }
        return { user: decoded.user }
    } catch (error) {
        console.error('JWT verification error:', error)
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized: Invalid token',
        })
    }
})