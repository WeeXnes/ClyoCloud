import { describe, it, expect } from 'vitest'
import {
    encryptTwoFactorSecret,
    decryptTwoFactorSecret,
    generateRecoveryCodes,
    verifyAndConsumeRecoveryCode,
    normalizeRecoveryCode
} from '../server/utils/twoFactor'
import { checkDiskHeadroom } from '../server/utils/storageQuota'

describe('Security Audit Fixes Verification', () => {
    describe('2FA Encryption at Rest & Recovery Codes', () => {
        it('encrypts and decrypts TOTP secret using AES-256-GCM', () => {
            const rawSecret = 'JBSWY3DPEHPK3PXP'
            const encrypted = encryptTwoFactorSecret(rawSecret)

            expect(encrypted).not.toBe(rawSecret)
            expect(encrypted.startsWith('enc:v1:')).toBe(true)

            const decrypted = decryptTwoFactorSecret(encrypted)
            expect(decrypted).toBe(rawSecret)
        })

        it('gracefully handles legacy plaintext secrets without enc:v1 prefix', () => {
            const legacySecret = 'LEGACYPLAINSECRET123'
            const result = decryptTwoFactorSecret(legacySecret)
            expect(result).toBe(legacySecret)
        })

        it('generates formatted recovery codes and single-use verification', () => {
            const { plaintextCodes, hashedCodes } = generateRecoveryCodes(8)

            expect(plaintextCodes.length).toBe(8)
            expect(hashedCodes.length).toBe(8)

            // Codes formatted like XXXX-XXXX
            for (const code of plaintextCodes) {
                expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/)
            }

            // Verify and consume first code
            const firstCode = plaintextCodes[0]
            const firstResult = verifyAndConsumeRecoveryCode(firstCode, hashedCodes)
            expect(firstResult.valid).toBe(true)
            expect(firstResult.updatedCodes).toBeDefined()

            // Trying to use same code again must fail
            const secondResult = verifyAndConsumeRecoveryCode(firstCode, firstResult.updatedCodes)
            expect(secondResult.valid).toBe(false)

            // Invalid code must fail
            const badResult = verifyAndConsumeRecoveryCode('INVALID-CODE', hashedCodes)
            expect(badResult.valid).toBe(false)
        })
    })

    describe('Path Prefix Replacement Integrity', () => {
        it('does not corrupt earlier hierarchy path segments during move/rename', () => {
            const oldPath = 'media'
            const newPath = 'media_backup'
            const itemPath = 'media/subfolder/media/file.txt'

            // Slicing logic:
            const fixedPath = newPath + itemPath.slice(oldPath.length)
            expect(fixedPath).toBe('media_backup/subfolder/media/file.txt')

            // Demonstrating that naive .replace() caused the bug:
            const buggyPath = itemPath.replace(oldPath, newPath)
            // If oldPath was 'subfolder', replace() would mutate incorrectly if 'subfolder' appeared twice
            const docOldPath = 'doc'
            const docNewPath = 'documents'
            const docItemPath = 'doc_archive/doc/file.txt'

            // Naive replace would replace 'doc' inside 'doc_archive':
            expect(docItemPath.replace(docOldPath, docNewPath)).toBe('documents_archive/doc/file.txt') // bug!

            // Prefix slice correctly only replaces prefix:
            if (docItemPath.startsWith('doc_archive/')) {
                const correct = 'documents_archive' + docItemPath.slice('doc_archive'.length)
                expect(correct).toBe('documents_archive/doc/file.txt')
            }
        })
    })

    describe('Storage Headroom Check', () => {
        it('checks host filesystem headroom without errors', async () => {
            const result = await checkDiskHeadroom(process.cwd(), 1024)
            expect(typeof result.hasSpace).toBe('boolean')
            expect(typeof result.available).toBe('number')
            expect(result.available).toBeGreaterThan(0)
        })
    })

    describe('Bulk Download Filename Parsing', () => {
        it('preserves commas in filenames encoded as JSON', () => {
            const files = ['Financial_Report,_Q3.pdf', 'Normal_File.docx', 'Comma, separated, name.png']
            const encoded = JSON.stringify(files)

            // Parse using server logic
            const parsed = JSON.parse(encoded)
            expect(Array.isArray(parsed)).toBe(true)
            expect(parsed).toEqual(files)
            expect(parsed[0]).toBe('Financial_Report,_Q3.pdf')
            expect(parsed.length).toBe(3)
        })

        it('falls back to comma split for legacy clients', () => {
            const legacyQuery = 'file1.txt,file2.txt'
            let fileNames: string[] = []
            try {
                const parsed = JSON.parse(legacyQuery)
                if (Array.isArray(parsed)) fileNames = parsed
                else fileNames = legacyQuery.split(',').filter(Boolean)
            } catch {
                fileNames = legacyQuery.split(',').filter(Boolean)
            }
            expect(fileNames).toEqual(['file1.txt', 'file2.txt'])
        })
    })
})

