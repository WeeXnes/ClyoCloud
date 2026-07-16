import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDirSize, clearUserCache, storageMapCache } from '../server/utils/fileUtils'
import fs from 'fs/promises'

vi.mock('fs/promises', () => ({
    default: {
        readdir: vi.fn().mockResolvedValue([]),
        stat: vi.fn()
    }
}))

vi.stubGlobal('useRuntimeConfig', () => ({
    storagePath: '/mock/storage'
}))

describe('Cache and Invalidation Utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        storageMapCache.clear()
    })

    it('caches directory size and invalidates correctly', async () => {
        const userPath = '/mock/storage/testuser'
        
        const readdirMock = vi.mocked(fs.readdir)
        readdirMock.mockResolvedValue([])

        // First call to getDirSize should call fs.readdir
        await getDirSize(userPath)
        expect(readdirMock).toHaveBeenCalledTimes(1)

        // Second call should hit the cache and not call fs.readdir
        await getDirSize(userPath)
        expect(readdirMock).toHaveBeenCalledTimes(1)

        // Calling clearUserCache should clear the cache
        clearUserCache('testuser')

        // Third call should call fs.readdir again
        await getDirSize(userPath)
        expect(readdirMock).toHaveBeenCalledTimes(2)
    })

    it('manages storage map cache correctly', () => {
        const username = 'testuser'
        const mockMapData = { name: 'root', size: 100, children: [] }

        storageMapCache.set(username, { data: mockMapData, timestamp: Date.now() })
        expect(storageMapCache.has(username)).toBe(true)

        clearUserCache(username)
        expect(storageMapCache.has(username)).toBe(false)
    })
})
