import { defineEventHandler, createError, readBody } from 'h3'
import fs from 'fs/promises'
import { createRequire } from 'module'
import { logActivity } from '../../utils/activityLogger'
import { decryptTwoFactorSecret, verifyAndConsumeRecoveryCode } from '../../utils/twoFactor'

const require = createRequire(import.meta.url)
const otplib = require('otplib')
const authenticator = otplib.authenticator || otplib

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const body = await readBody(event)
    const { code } = body

    if (!code) {
        throw createError({ statusCode: 400, statusMessage: '2FA code is required to disable 2FA' })
    }

    const config = useRuntimeConfig()
    const usersFilePath = config.usersFilePath
    const usersData = await fs.readFile(usersFilePath, 'utf-8')
    const users = JSON.parse(usersData)

    const userIndex = users.findIndex((u: any) => u.name === event.context.user.name)
    if (userIndex === -1) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    const user = users[userIndex]
    
    if (user.twoFactorEnabled) {
        const cleanCode = code.toString().replace(/\s/g, '')
        const plainSecret = decryptTwoFactorSecret(user.twoFactorSecret)
        
        let isValid = false
        if (typeof authenticator.verify === 'function') {
            isValid = await authenticator.verify({ token: cleanCode, secret: plainSecret })
        } else if (typeof authenticator.check === 'function') {
            isValid = await authenticator.check(cleanCode, plainSecret)
        }

        const finalValid = isValid === true || (isValid && (isValid as any).valid === true)

        if (!finalValid) {
            // Check recovery codes
            const recoveryCheck = verifyAndConsumeRecoveryCode(code.toString(), user.twoFactorRecoveryCodes)
            if (!recoveryCheck.valid) {
                await logActivity(user.name, '2FA_DISABLE_FAIL', 'Security', 'Failed attempt to disable 2FA (invalid code)', event)
                throw createError({ statusCode: 400, statusMessage: 'Invalid 2FA or recovery code' })
            }
        }
    }

    users[userIndex].twoFactorSecret = null
    users[userIndex].twoFactorRecoveryCodes = []
    users[userIndex].twoFactorEnabled = false

    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8')
    await logActivity(user.name, '2FA_DISABLED', 'Security', '2FA has been disabled', event)

    return { success: true }
})
