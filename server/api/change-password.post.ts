import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import bcrypt from 'bcryptjs'
import { logActivity } from '../utils/activityLogger'
import { withFileLock, writeFileAtomic } from '../utils/jsonStore'

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { currentPassword, newPassword } = body
    const config = useRuntimeConfig()
    const user = event.context.user

    if (!user || !user.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    if (!currentPassword) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Current password is required',
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
        await withFileLock(usersFilePath, async () => {
            const usersData = await fs.readFile(usersFilePath, 'utf-8')
            const users: any[] = JSON.parse(usersData)

            const userIndex = users.findIndex((u) => u.name === user.name)
            if (userIndex === -1) {
                throw createError({
                    statusCode: 404,
                    statusMessage: 'User not found',
                })
            }

            const isCurrentValid = await bcrypt.compare(currentPassword, users[userIndex].password)
            if (!isCurrentValid) {
                await logActivity(user.name, 'PASSWORD_CHANGE_FAIL', 'Security', 'Failed password change attempt (incorrect current password)', event)
                throw createError({
                    statusCode: 403,
                    statusMessage: 'Incorrect current password',
                })
            }

            const hashedPassword = await bcrypt.hash(newPassword, 12)
            users[userIndex].password = hashedPassword

            await writeFileAtomic(usersFilePath, JSON.stringify(users, null, 2))
        })

        await logActivity(user.name, 'PASSWORD_CHANGE', 'Account', 'Password updated successfully', event)

        return { message: 'Password updated successfully' }
    } catch (error: any) {
        if (error.statusCode) throw error
        console.error('Change password error:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error',
        })
    }
})