import { defineEventHandler, createError, readBody } from 'h3'
import fs from 'fs/promises'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const otplib = require('otplib')
const authenticator = otplib.authenticator || otplib

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
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

    console.log(`[2FA] Enable Verify - User: ${event.context.user.name}, Code: ${cleanCode}, Raw Result: ${JSON.stringify(result)}`)

    // Explicitly check for boolean true OR the .valid property
    const isValid = result === true || (result && result.valid === true)

    if (!isValid) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid verification code' })
    }

    const config = useRuntimeConfig()
    const usersFilePath = config.usersFilePath
    const usersData = await fs.readFile(usersFilePath, 'utf-8')
    const users = JSON.parse(usersData)

    const userIndex = users.findIndex((u: any) => u.name === event.context.user.name)
    if (userIndex === -1) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    users[userIndex].twoFactorSecret = secret
    users[userIndex].twoFactorEnabled = true

    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8')

    return { success: true }
})
