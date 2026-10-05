import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const otplib = require('otplib')
const QRCode = require('qrcode')

const authenticator = otplib.authenticator || otplib

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const config = useRuntimeConfig()
    const usersData = await fs.readFile(config.usersFilePath, 'utf-8')
    const users = JSON.parse(usersData)
    const user = users.find((u: any) => u.name === event.context.user.name)

    if (user && user.twoFactorEnabled) {
        throw createError({ statusCode: 400, statusMessage: '2FA is already enabled. Disable it first to re-setup.' })
    }

    const username = event.context.user.name
    const service = 'ClyoCloud'
    const secret = authenticator.generateSecret()
    
    let otpauth = ''
    if (typeof authenticator.keyuri === 'function') {
        otpauth = authenticator.keyuri(username, service, secret)
    } else {
        otpauth = `otpauth://totp/${encodeURIComponent(service)}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent(service)}`
    }

    const qrCodeUrl = await QRCode.toDataURL(otpauth)

    console.log(`[2FA] Setup initiated for user: ${username}`)

    return {
        secret,
        qrCodeUrl
    }
})
