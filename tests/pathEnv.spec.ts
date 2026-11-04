import { describe, it, expect } from 'vitest'
import path from 'path'
import { applyPathEnv } from '../server/pathEnv'

const NAMES = ['STORAGE_PATH', 'MOVIES_PATH', 'SHOWS_PATH', 'THUMBNAIL_PATH', 'PREVIEW_PATH', 'USERS_FILE_PATH', 'TAGS_FILE_PATH', 'DEVICES_FILE_PATH']

describe('Path environment', () => {
    it('defaults every path to ~/.clyo of the given home directory', () => {
        const env: Record<string, string | undefined> = {}
        applyPathEnv(env, () => '/home/runner')
        expect(env.NUXT_STORAGE_PATH).toBe(path.join('/home/runner', '.clyo', 'data'))
        expect(env.NUXT_USERS_FILE_PATH).toBe(path.join('/home/runner', '.clyo', 'users.json'))
        for (const name of NAMES) {
            expect(env[`NUXT_${name}`]).toMatch(/^\/home\/runner\/\.clyo\//)
        }
    })

    it('uses the unprefixed variables without needing a home directory', () => {
        const env: Record<string, string | undefined> = Object.fromEntries(NAMES.map(name => [name, `/srv/${name}`]))
        applyPathEnv(env, () => { throw new Error('home directory should not be read') })
        for (const name of NAMES) {
            expect(env[`NUXT_${name}`]).toBe(`/srv/${name}`)
        }
    })

    it('prefers NUXT_ variables over the unprefixed ones', () => {
        const env: Record<string, string | undefined> = { STORAGE_PATH: '/plain', NUXT_STORAGE_PATH: '/prefixed' }
        applyPathEnv(env, () => '/home/runner')
        expect(env.NUXT_STORAGE_PATH).toBe('/prefixed')
    })

    it('treats empty values as unset', () => {
        const env: Record<string, string | undefined> = { STORAGE_PATH: '', NUXT_STORAGE_PATH: '' }
        applyPathEnv(env, () => '/home/runner')
        expect(env.NUXT_STORAGE_PATH).toBe(path.join('/home/runner', '.clyo', 'data'))
    })
})
