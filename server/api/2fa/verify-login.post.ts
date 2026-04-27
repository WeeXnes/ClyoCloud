import { defineEventHandler, createError, readBody } from 'h3'
import fs from 'fs/promises'
import jwt from 'jsonwebtoken'
import { authenticator } from 'otplib'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { tempToken, code } = body
    const config = useRuntimeConfig()

    if (!tempToken || !code) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Token and code are required',
        })
    }

    try {
        const decoded = jwt.verify(tempToken, config.jwtSecret) as any
        if (!decoded.isPartial) {
            throw createError({ statusCode: 400, statusMessage: 'Invalid token type' })
        }

        const username = decoded.user.name
        const usersFilePath = config.usersFilePath
        const usersData = await fs.readFile(usersFilePath, 'utf-8')
        const users = JSON.parse(usersData)

        const user = users.find((u: any) => u.name === username)
        if (!user || !user.twoFactorEnabled) {
            throw createError({ statusCode: 400, statusMessage: '2FA not enabled for this user' })
        }

        const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret })
        if (!isValid) {
            throw createError({ statusCode: 401, statusMessage: 'Invalid 2FA code' })
        }

        const token = jwt.sign({ user: { name: username } }, config.jwtSecret, {
            expiresIn: '7d',
        })

        return { token }
    } catch (error: any) {
        console.error('2FA verification error:', error)
        throw createError({
            statusCode: error.statusCode || 401,
            statusMessage: error.statusMessage || 'Verification failed',
        })
    }
})
