import { defineEventHandler, createError, readBody } from 'h3'
import fs from 'fs/promises'
import jwt from 'jsonwebtoken'
import { createRequire } from 'module'
import { logActivity } from '../../utils/activityLogger'

const require = createRequire(import.meta.url)
const otplib = require('otplib')

// Try to get the authenticator instance correctly
const authenticator = otplib.authenticator || otplib

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

        const cleanCode = code.toString().replace(/\s/g, '')
        const secret = user.twoFactorSecret

        if (!secret) {
            throw createError({ statusCode: 500, statusMessage: '2FA Secret missing' })
        }

        let result: any = false
        
        // Try verification and capture raw result
        if (typeof authenticator.verify === 'function') {
            result = await authenticator.verify({ token: cleanCode, secret })
        } else if (typeof authenticator.check === 'function') {
            result = await authenticator.check(cleanCode, secret)
        }

        console.log(`[2FA] Login Verify - User: ${username}, Code: ${cleanCode}, Raw Result: ${JSON.stringify(result)}`)

        // Explicitly check for boolean true OR the .valid property
        const isValid = result === true || (result && result.valid === true)

        if (!isValid) {
            console.warn(`[2FA] REJECTED: Code ${cleanCode} is NOT valid for user ${username}`)
            await logActivity(username, '2FA_FAIL', 'Security', `Invalid 2FA code attempt: ${cleanCode}`)
            throw createError({
                statusCode: 401,
                statusMessage: 'Invalid 2FA code',
            })
        }

        console.log(`[2FA] ACCEPTED: Code ${cleanCode} is valid for user ${username}`)
        await logActivity(username, 'LOGIN_SUCCESS', 'Login', 'Successful 2FA verification')

        const token = jwt.sign({ user: { name: username } }, config.jwtSecret, {
            expiresIn: '7d',
        })

        return { token }
    } catch (error: any) {
        console.error('[2FA] Error:', error.message)
        throw createError({
            statusCode: error.statusCode || 401,
            statusMessage: error.statusMessage || 'Verification failed',
        })
    }
})
