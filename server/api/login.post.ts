import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

interface User {
    name: string
    password: string
}

export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const { username, password } = body
    const config = useRuntimeConfig()

    if (!username || !password) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Username and password are required',
        })
    }

    try {
        const usersFilePath = config.usersFilePath
        const usersData = await fs.readFile(usersFilePath, 'utf-8')
        const users: User[] = JSON.parse(usersData)

        const user = users.find((u) => u.name === username)
        if (!user) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Invalid username or password',
            })
        }

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) {
            throw createError({
                statusCode: 401,
                statusMessage: 'Invalid username or password',
            })
        }

        const token = jwt.sign({ user: { name: username } }, config.jwtSecret, {
            expiresIn: '7d',
        })

        await fs.mkdir(path.join(config.storagePath, username), { recursive: true })

        // Return token in response body
        return { token }
    } catch (error) {
        console.error('Login error:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error',
        })
    }
})