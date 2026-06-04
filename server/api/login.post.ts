import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { logActivity } from '../utils/activityLogger'

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
            console.warn(`[SECURITY] Login attempt for non-existent user: ${username}`)
            throw createError({
                statusCode: 401,
                statusMessage: 'Invalid username or password',
            })
        }

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) {
            try {
                await logActivity(username, 'LOGIN_FAIL', 'Login', 'Invalid password attempt', event)
            } catch (logError) {
                console.error('Failed to log login failure:', logError)
            }
            throw createError({
                statusCode: 401,
                statusMessage: 'Invalid username or password',
            })
        }

        if (user.twoFactorEnabled) {
            try {
                await logActivity(username, 'LOGIN_STEP1', 'Login', 'Password verified, 2FA required', event)
            } catch (logError) {
                console.error('Failed to log login step 1:', logError)
            }
            // Return temporary token for 2FA verification
            const tempToken = jwt.sign({ 
                user: { name: username },
                isPartial: true 
            }, config.jwtSecret, {
                expiresIn: '5m',
            })
            return { requires2fa: true, tempToken }
        }

        try {
            await logActivity(username, 'LOGIN_SUCCESS', 'Login', 'Successful login', event)
        } catch (logError) {
            console.error('Failed to log login success:', logError)
        }

        const token = jwt.sign({ user: { name: username } }, config.jwtSecret, {
            expiresIn: '30d',
        })

        await fs.mkdir(path.join(config.storagePath, username), { recursive: true })

        // Return token in response body
        return { token }
    } catch (error: any) {
        if (error.statusCode) throw error
        
        console.error('Login error:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal server error',
        })
    }
})