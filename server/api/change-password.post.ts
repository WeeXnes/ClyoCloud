import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import bcrypt from 'bcryptjs'
import { logActivity } from '../utils/activityLogger'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { newPassword } = body
    const config = useRuntimeConfig()
    const user = event.context.user

    if (!user || !user.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    if (!newPassword || newPassword.length < 6) {
        throw createError({
            statusCode: 400,
            statusMessage: 'New password must be at least 6 characters long',
        })
    }

    try {
        const usersFilePath = config.usersFilePath
        const usersData = await fs.readFile(usersFilePath, 'utf-8')
        const users: any[] = JSON.parse(usersData)

        const userIndex = users.findIndex((u) => u.name === user.name)
        if (userIndex === -1) {
            throw createError({
                statusCode: 404,
                statusMessage: 'User not found',
            })
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12)
        users[userIndex].password = hashedPassword

        await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8')

        await logActivity(user.name, 'PASSWORD_CHANGE', 'Account', 'Password updated successfully', event)

        return { message: 'Password updated successfully' }
    } catch (error) {
        console.error('Change password error:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error',
        })
    }
})