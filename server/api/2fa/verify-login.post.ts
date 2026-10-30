import { defineEventHandler, createError, readBody } from 'h3'
import fs from 'fs/promises'
import jwt from 'jsonwebtoken'
import { createRequire } from 'module'
import { logActivity } from '../../utils/activityLogger'
import { loginLimiter, accountLimiter, getClientIP } from '../../utils/rateLimiter'
import { withFileLock, writeFileAtomic } from '../../utils/jsonStore'
import { getJwtSecret } from '../../utils/jwtConfig'
import { decryptTwoFactorSecret, verifyAndConsumeRecoveryCode } from '../../utils/twoFactor'

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

    // Rate limiting check (shares limiter with login)
    const clientIP = getClientIP(event)
    const rateLimitResult = loginLimiter.check(clientIP)
    if (!rateLimitResult.allowed) {
        console.warn(`[SECURITY] Rate limited 2FA attempt from IP: ${clientIP}`)
        throw createError({
            statusCode: 429,
            statusMessage: `Too many attempts. Try again in ${Math.ceil(rateLimitResult.retryAfterMs / 1000)} seconds.`,
        })
    }

    try {
        const decoded = jwt.verify(tempToken, getJwtSecret()) as any
        if (!decoded.isPartial) {
            throw createError({ statusCode: 400, statusMessage: 'Invalid token type' })
        }

        const username = decoded.user.name

        // Per-account limit: a fresh password login must not grant more code guesses
        const accountKey = `2fa:${username}`
        const accountRateLimit = accountLimiter.check(accountKey)
        if (!accountRateLimit.allowed) {
            console.warn(`[SECURITY] Rate limited 2FA attempt for user: ${username}`)
            throw createError({
                statusCode: 429,
                statusMessage: `Too many attempts. Try again in ${Math.ceil(accountRateLimit.retryAfterMs / 1000)} seconds.`,
            })
        }

        const usersFilePath = config.usersFilePath
        const usersData = await fs.readFile(usersFilePath, 'utf-8')
        const users = JSON.parse(usersData)

        const userIndex = users.findIndex((u: any) => u.name === username)
        if (userIndex === -1) {
            throw createError({ statusCode: 404, statusMessage: 'User not found' })
        }
        const user = users[userIndex]
        if (!user || !user.twoFactorEnabled) {
            throw createError({ statusCode: 400, statusMessage: '2FA not enabled for this user' })
        }

        const cleanCode = code.toString().replace(/\s/g, '')
        const rawSecret = user.twoFactorSecret

        if (!rawSecret) {
            throw createError({ statusCode: 500, statusMessage: '2FA Secret missing' })
        }

        const plainSecret = decryptTwoFactorSecret(rawSecret)

        let isValid = false
        let usedRecovery = false

        // 1. Try TOTP code
        if (cleanCode.length === 6) {
            let result: any = false
            if (typeof authenticator.verify === 'function') {
                result = await authenticator.verify({ token: cleanCode, secret: plainSecret })
            } else if (typeof authenticator.check === 'function') {
                result = await authenticator.check(cleanCode, plainSecret)
            }
            isValid = result === true || (result && result.valid === true)
        }

        // 2. If not valid TOTP, try recovery code
        if (!isValid) {
            // Re-read under the lock so a code can't be used twice by concurrent requests
            usedRecovery = await withFileLock(usersFilePath, async () => {
                const freshUsers = JSON.parse(await fs.readFile(usersFilePath, 'utf-8'))
                const freshUser = freshUsers.find((u: any) => u.name === username)
                const recoveryCheck = verifyAndConsumeRecoveryCode(code.toString(), freshUser?.twoFactorRecoveryCodes)
                if (!recoveryCheck.valid || !recoveryCheck.updatedCodes) {
                    return false
                }
                freshUser.twoFactorRecoveryCodes = recoveryCheck.updatedCodes
                await writeFileAtomic(usersFilePath, JSON.stringify(freshUsers, null, 2))
                return true
            })
            isValid = usedRecovery
        }

        if (!isValid) {
            console.warn(`[2FA] REJECTED: Invalid code attempt for user ${username}`)
            await logActivity(username, '2FA_FAIL', 'Security', 'Invalid 2FA / recovery code attempt', event)
            throw createError({
                statusCode: 401,
                statusMessage: 'Invalid 2FA or recovery code',
            })
        }

        // Login fully complete: don't count this attempt, and clear this account's code counter
        loginLimiter.forgive(clientIP)
        accountLimiter.reset(accountKey)

        console.log(`[2FA] ACCEPTED: User ${username} verified (recoveryCode: ${usedRecovery})`)
        await logActivity(username, 'LOGIN_SUCCESS', 'Login', usedRecovery ? 'Successful 2FA recovery code verification' : 'Successful 2FA verification', event)

        const token = jwt.sign({ user: { name: username } }, getJwtSecret(), {
            expiresIn: '30d',
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

