import { defineEventHandler, createError, readBody } from 'h3'
import fs from 'fs/promises'
import { createRequire } from 'module'
import { logActivity } from '../../utils/activityLogger'
import { encryptTwoFactorSecret, generateRecoveryCodes } from '../../utils/twoFactor'
import { withFileLock, writeFileAtomic } from '../../utils/jsonStore'

const require = createRequire(import.meta.url)
const otplib = require('otplib')
const authenticator = otplib.authenticator || otplib

export default defineEventHandler(async (event) => {
    const user = event.context.user
    if (!user || !user.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const body = await readBody(event)
    const { secret, code } = body

    if (!secret || !code) {
        throw createError({ statusCode: 400, statusMessage: 'Secret and code are required' })
    }

    const cleanCode = code.toString().replace(/\s/g, '')
    
    let result: any = false
    if (authenticator && typeof authenticator.verify === 'function') {
        result = await authenticator.verify({ token: cleanCode, secret })
    } else if (typeof authenticator.check === 'function') {
        result = await authenticator.check(cleanCode, secret)
    }

    // Explicitly check for boolean true OR the .valid property
    const isValid = result === true || (result && result.valid === true)

    if (!isValid) {
        await logActivity(user.name, '2FA_ENABLE_FAIL', 'Security', 'Failed attempt to enable 2FA (invalid code)', event)
        throw createError({ statusCode: 400, statusMessage: 'Invalid verification code' })
    }

    const config = useRuntimeConfig()
    const usersFilePath = config.usersFilePath

    // Generate 8 single-use recovery codes
    const { plaintextCodes, hashedCodes } = generateRecoveryCodes(8)

    await withFileLock(usersFilePath, async () => {
        const usersData = await fs.readFile(usersFilePath, 'utf-8')
        const users = JSON.parse(usersData)

        const userIndex = users.findIndex((u: any) => u.name === user.name)
        if (userIndex === -1) {
            throw createError({ statusCode: 404, statusMessage: 'User not found' })
        }

        // Encrypt TOTP secret before persisting
        users[userIndex].twoFactorSecret = encryptTwoFactorSecret(secret)
        users[userIndex].twoFactorRecoveryCodes = hashedCodes
        users[userIndex].twoFactorEnabled = true

        await writeFileAtomic(usersFilePath, JSON.stringify(users, null, 2))
    })

    await logActivity(user.name, '2FA_ENABLED', 'Security', '2FA has been successfully enabled with recovery codes', event)

    return { 
        success: true,
        recoveryCodes: plaintextCodes
    }
})
