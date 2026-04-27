import { defineEventHandler, createError } from 'h3'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const otplib = require('otplib')
const QRCode = require('qrcode')

const authenticator = otplib.authenticator || otplib

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
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

    console.log(`[2FA] Setup - User: ${username}, Secret Generated: ${secret}`)

    return {
        secret,
        qrCodeUrl
    }
})
