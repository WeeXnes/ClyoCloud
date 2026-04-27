import { defineEventHandler, createError, readBody } from 'h3'
import fs from 'fs/promises'

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const config = useRuntimeConfig()
    const usersFilePath = config.usersFilePath
    const usersData = await fs.readFile(usersFilePath, 'utf-8')
    const users = JSON.parse(usersData)

    const userIndex = users.findIndex((u: any) => u.name === event.context.user.name)
    if (userIndex === -1) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    users[userIndex].twoFactorSecret = null
    users[userIndex].twoFactorEnabled = false

    await fs.writeFile(usersFilePath, JSON.stringify(users, null, 2), 'utf-8')

    return { success: true }
})
