import { describe, it, expect } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { isTrashPath, isValidDownloadPath } from '../server/utils/fileUtils'
import { parseDownloadUrl } from '../server/utils/downloadManager'
import { isSafeTrashName } from '../server/utils/trash'
import { resolveClientIP, loginLimiter } from '../server/utils/rateLimiter'
import { withFileLock, writeFileAtomic } from '../server/utils/jsonStore'

describe('Downloader input validation', () => {
    it('accepts http and https URLs', () => {
        expect(parseDownloadUrl('https://example.com/video')).toBe('https://example.com/video')
        expect(parseDownloadUrl('http://example.com/a b')).toBe('http://example.com/a%20b')
    })

    it('rejects anything else, including values that look like options', () => {
        for (const input of ['--version', '-x', 'file:///etc/hostname', 'ftp://example.com/a', 'not a url', '', null, 42, {}]) {
            expect(parseDownloadUrl(input)).toBeNull()
        }
    })

    it('keeps the download path inside user storage and out of the trash', () => {
        const root = '/data/alice'
        for (const valid of ['', 'videos', 'videos/new', '/videos', 'a/../b']) {
            expect(isValidDownloadPath(root, valid)).toBe(true)
        }
        for (const invalid of ['..', '../bob', 'a/../../bob', '.trash', '.trash/x', 5, null]) {
            expect(isValidDownloadPath(root, invalid)).toBe(false)
        }
    })
})

describe('Trash boundaries', () => {
    it('only accepts single-segment stored names', () => {
        expect(isSafeTrashName('1700000000_abcd1234_photo.jpg')).toBe(true)
        expect(isSafeTrashName('name with spaces..jpg')).toBe(true)
        for (const name of ['', '.', '..', '../x', 'a/b', 'a\\b', '/etc/hostname', 'a\0b', undefined, 7]) {
            expect(isSafeTrashName(name)).toBe(false)
        }
    })

    it('recognizes paths inside the trash', () => {
        const root = '/data/alice'
        expect(isTrashPath(root, '/data/alice/.trash')).toBe(true)
        expect(isTrashPath(root, '/data/alice/.trash/metadata.json')).toBe(true)
        expect(isTrashPath(root, '/data/alice/docs/.trash')).toBe(false)
        expect(isTrashPath(root, '/data/alice/.trashy')).toBe(false)
        expect(isTrashPath(root, '/data/alice')).toBe(false)
    })
})

describe('Client IP resolution', () => {
    it('ignores X-Forwarded-For from an untrusted peer', () => {
        expect(resolveClientIP('203.0.113.9', '127.0.0.1')).toBe('203.0.113.9')
        expect(resolveClientIP('::ffff:203.0.113.9', '198.51.100.1')).toBe('203.0.113.9')
    })

    it('uses the entry added by a trusted proxy, not ones supplied by the client', () => {
        expect(resolveClientIP('127.0.0.1', '198.51.100.1')).toBe('198.51.100.1')
        expect(resolveClientIP('127.0.0.1', '10.9.9.9, 198.51.100.1')).toBe('198.51.100.1')
        expect(resolveClientIP('127.0.0.1', 'garbage, 198.51.100.1')).toBe('198.51.100.1')
    })

    it('falls back to the peer when the header is missing or malformed', () => {
        expect(resolveClientIP('127.0.0.1', undefined)).toBe('127.0.0.1')
        expect(resolveClientIP('127.0.0.1', 'unknown')).toBe('127.0.0.1')
        expect(resolveClientIP(undefined, '198.51.100.1')).toBe('unknown')
    })

    it('no longer exempts loopback from rate limiting', () => {
        const key = '127.0.0.1'
        loginLimiter.reset(key)
        for (let i = 0; i < 5; i++) {
            expect(loginLimiter.check(key).allowed).toBe(true)
        }
        expect(loginLimiter.check(key).allowed).toBe(false)
        loginLimiter.reset(key)
    })

    it('forgiving a successful attempt keeps earlier failures', () => {
        const key = '198.51.100.77'
        loginLimiter.reset(key)
        loginLimiter.check(key) // failure
        loginLimiter.check(key) // success
        loginLimiter.forgive(key)
        expect(loginLimiter.check(key).remaining).toBe(3)
        loginLimiter.reset(key)
    })
})

describe('JSON store', () => {
    it('replaces files atomically, keeps the mode and leaves no temp files', async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'clyo-store-'))
        const file = path.join(dir, 'data.json')
        try {
            await writeFileAtomic(file, '{"a":1}')
            expect((await fs.stat(file)).mode & 0o777).toBe(0o600)

            await fs.chmod(file, 0o640)
            await writeFileAtomic(file, '{"a":2}')
            expect((await fs.stat(file)).mode & 0o777).toBe(0o640)
            expect(await fs.readFile(file, 'utf-8')).toBe('{"a":2}')
            expect(await fs.readdir(dir)).toEqual(['data.json'])
        } finally {
            await fs.rm(dir, { recursive: true, force: true })
        }
    })

    it('does not lose concurrent read-modify-write updates, even after a failure', async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'clyo-store-'))
        const file = path.join(dir, 'count.json')
        try {
            await writeFileAtomic(file, '0')
            const increment = () => withFileLock(file, async () => {
                const value = JSON.parse(await fs.readFile(file, 'utf-8'))
                await writeFileAtomic(file, JSON.stringify(value + 1))
            })
            const failing = withFileLock(file, async () => { throw new Error('boom') })

            await Promise.all([...Array.from({ length: 25 }, increment), failing.catch(() => {})])

            expect(JSON.parse(await fs.readFile(file, 'utf-8'))).toBe(25)
        } finally {
            await fs.rm(dir, { recursive: true, force: true })
        }
    })
})
