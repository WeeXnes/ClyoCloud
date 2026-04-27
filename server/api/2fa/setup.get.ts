import { defineEventHandler, createError } from 'h3'
import { authenticator } from 'otplib'
import QRCode from 'qrcode'

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const secret = authenticator.generateSecret()
    const otpauth = authenticator.keyuri(
        event.context.user.name,
        'ClyoCloud',
        secret
    )

    const qrCodeUrl = await QRCode.toDataURL(otpauth)

    return {
        secret,
        qrCodeUrl
    }
})
