import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDirSize, clearUserCache, resetSizeCacheForTests, getUserCacheEpoch } from '../server/utils/fileUtils'
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
        resetSizeCacheForTests()
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

    it('bumps the user epoch so storage summaries are recomputed', () => {
        const before = getUserCacheEpoch('testuser')
        const other = getUserCacheEpoch('otheruser')
        clearUserCache('testuser')
        expect(getUserCacheEpoch('testuser')).toBe(before + 1)
        expect(getUserCacheEpoch('otheruser')).toBe(other)
    })

    it('sets caching headers and handles 304 Not Modified', async () => {
        const { handleHttpCache } = await import('../server/utils/httpCache')
        const mockStats = {
            size: 1024,
            mtime: new Date('2026-10-01T12:00:00Z')
        } as any

        const headers: Record<string, string> = {}
        let responseStatus = 200
        const mockEvent = {
            node: {
                req: {
                    headers: {}
                },
                res: {
                    setHeader: (name: string, value: string) => {
                        headers[name.toLowerCase()] = value
                    },
                    statusCode: 200
                }
            }
        } as any

        // Test fresh request (no cache headers from client)
        const handled1 = handleHttpCache(mockEvent, mockStats, false)
        expect(handled1).toBe(false)
        expect(headers['etag']).toBeDefined()
        expect(headers['cache-control']).toBe('private, max-age=60, stale-while-revalidate=604800')
        expect(headers['last-modified']).toBe(mockStats.mtime.toUTCString())

        // Test public caching header
        handleHttpCache(mockEvent, mockStats, true)
        expect(headers['cache-control']).toBe('public, max-age=60, stale-while-revalidate=604800')

        // Test matching If-None-Match ETag
        mockEvent.node.req.headers['if-none-match'] = headers['etag']
        const handled2 = handleHttpCache(mockEvent, mockStats, false)
        expect(handled2).toBe(true)
        expect(mockEvent.node.res.statusCode).toBe(304)

        // Test matching If-Modified-Since
        delete mockEvent.node.req.headers['if-none-match']
        mockEvent.node.req.headers['if-modified-since'] = mockStats.mtime.toUTCString()
        mockEvent.node.res.statusCode = 200
        const handled3 = handleHttpCache(mockEvent, mockStats, false)
        expect(handled3).toBe(true)
        expect(mockEvent.node.res.statusCode).toBe(304)
    })
})

