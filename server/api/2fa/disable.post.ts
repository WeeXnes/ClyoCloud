import { defineEventHandler, createError, readBody } from 'h3'
import fs from 'fs/promises'
import { createRequire } from 'module'
import { logActivity } from '../../utils/activityLogger'

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
        
        let isValid = false
        if (typeof authenticator.verify === 'function') {
            isValid = await authenticator.verify({ token: cleanCode, secret: user.twoFactorSecret })
        } else if (typeof authenticator.check === 'function') {
            isValid = await authenticator.check(cleanCode, user.twoFactorSecret)
        }

        // Handle result object {valid: true/false}
        const finalValid = isValid === true || (isValid && isValid.valid === true)

        if (!finalValid) {
            await logActivity(user.name, '2FA_DISABLE_FAIL', 'Security', 'Failed attempt to disable 2FA (invalid code)')
            throw createError({ statusCode: 400, statusMessage: 'Invalid 2FA code' })
        }
    }

    users[userIndex].twoFactorSecret = null
    users[userIndex].twoFactorEnabled = false

    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8')
    await logActivity(user.name, '2FA_DISABLED', 'Security', '2FA has been disabled')

    return { success: true }
})
