import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const PREFIX = 'enc:v1:'

let _encryptionKey: Buffer | null = null

/**
 * Get or initialize persistent 256-bit encryption key for 2FA secrets.
 */
function getEncryptionKey(): Buffer {
    if (_encryptionKey) {
        return _encryptionKey
    }

    const envKey = process.env.TWO_FACTOR_ENCRYPTION_KEY || process.env.NUXT_2FA_KEY
    if (envKey) {
        _encryptionKey = crypto.createHash('sha256').update(envKey).digest()
        return _encryptionKey
    }

    let configDir = process.cwd()
    let usersFilePath = path.join(process.cwd(), 'users.json')
    try {
        if (typeof useRuntimeConfig === 'function') {
            const config = useRuntimeConfig()
            if (config?.usersFilePath) {
                usersFilePath = config.usersFilePath
                configDir = path.dirname(config.usersFilePath)
            }
        }
    } catch {}

    const keyFile = path.join(configDir, '2fa.key')

    try {
        if (fs.existsSync(keyFile)) {
            const raw = fs.readFileSync(keyFile, 'utf-8').trim()
            if (raw.length === 64) {
                _encryptionKey = Buffer.from(raw, 'hex')
                return _encryptionKey
            }
        }

        // Generate a new 256-bit key and persist it
        const newKey = crypto.randomBytes(32)
        fs.writeFileSync(keyFile, newKey.toString('hex'), { mode: 0o600 })
        _encryptionKey = newKey
        return _encryptionKey
    } catch (err) {
        console.error('[2FA] Failed to read/write persistent key file, falling back to hashed key:', err)
        _encryptionKey = crypto.createHash('sha256').update(usersFilePath + (process.env.JWT_SECRET || 'clyo-fallback-salt')).digest()
        return _encryptionKey
    }
}

/**
 * Encrypt a TOTP secret before saving to disk.
 */
export function encryptTwoFactorSecret(secret: string): string {
    if (!secret) return secret
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    
    let encrypted = cipher.update(secret, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')

    return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`
}

/**
 * Decrypt a stored TOTP secret. Gracefully falls back to plain string for legacy unencrypted records.
 */
export function decryptTwoFactorSecret(storedSecret: string): string {
    if (!storedSecret) return storedSecret

    if (!storedSecret.startsWith(PREFIX)) {
        // Legacy plaintext secret
        return storedSecret
    }

    try {
        const payload = storedSecret.slice(PREFIX.length)
        const [ivHex, authTagHex, encryptedHex] = payload.split(':')
        if (!ivHex || !authTagHex || !encryptedHex) {
            throw new Error('Malformed encrypted secret payload')
        }

        const key = getEncryptionKey()
        const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
        decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))

        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
        decrypted += decipher.final('utf8')
        return decrypted
    } catch (err) {
        console.error('[2FA] Decryption failed:', err)
        throw new Error('Failed to decrypt 2FA credentials')
    }
}

export interface RecoveryCodeRecord {
    hash: string
    used: boolean
    usedAt?: number
}

/**
 * Clean recovery code for comparison (uppercase, strip dashes/spaces)
 */
export function normalizeRecoveryCode(code: string): string {
    return code.replace(/[-\s]/g, '').toUpperCase().trim()
}

/**
 * Generate 8 single-use recovery scratch codes.
 * Returns plaintext codes for display to user and hashed records for disk storage.
 */
export function generateRecoveryCodes(count = 8): {
    plaintextCodes: string[]
    hashedCodes: RecoveryCodeRecord[]
} {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
    const plaintextCodes: string[] = []
    const hashedCodes: RecoveryCodeRecord[] = []

    for (let i = 0; i < count; i++) {
        let code = ''
        const bytes = crypto.randomBytes(8)
        for (let j = 0; j < 8; j++) {
            code += chars[bytes[j] % chars.length]
        }
        // Format as XXXX-XXXX
        const formatted = `${code.slice(0, 4)}-${code.slice(4)}`
        plaintextCodes.push(formatted)

        const normalized = normalizeRecoveryCode(formatted)
        const hash = crypto.createHash('sha256').update(normalized).digest('hex')
        hashedCodes.push({
            hash,
            used: false
        })
    }

    return { plaintextCodes, hashedCodes }
}

/**
 * Verify if input code matches an unused recovery code and consume it if matched.
 */
export function verifyAndConsumeRecoveryCode(
    inputCode: string,
    storedCodes: RecoveryCodeRecord[] | undefined
): { valid: boolean; updatedCodes?: RecoveryCodeRecord[] } {
    if (!storedCodes || !Array.isArray(storedCodes) || storedCodes.length === 0) {
        return { valid: false }
    }

    const normalized = normalizeRecoveryCode(inputCode)
    if (normalized.length !== 8) {
        return { valid: false }
    }

    const inputHash = crypto.createHash('sha256').update(normalized).digest('hex')
    const matchIndex = storedCodes.findIndex(c => !c.used && c.hash === inputHash)

    if (matchIndex === -1) {
        return { valid: false }
    }

    const updatedCodes = storedCodes.map((c, index) => {
        if (index === matchIndex) {
            return {
                ...c,
                used: true,
                usedAt: Date.now()
            }
        }
        return c
    })

    return { valid: true, updatedCodes }
}
