import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'clyo-cache-'))
vi.stubGlobal('useRuntimeConfig', () => ({ storagePath: storageRoot }))

const {
    getDirSize, clearUserCache, clearSizeCache, resetSizeCacheForTests, createLimiter, getUserCacheEpoch,
} = await import('../server/utils/fileUtils')
const { SwrStore, getUserUsage, getUserStorageMap, resetStorageStatsForTests } = await import('../server/utils/storageStats')
const { mediaCache, mediaCacheKey, setMediaCache, clearMediaCache } = await import('../server/utils/mediaCache')
const tagCache = await import('../server/utils/tagCache')
const favorites = await import('../server/utils/favorites')
const trash = await import('../server/utils/trash')
const { handleHttpCache, isDerivedFresh } = await import('../server/utils/httpCache')

const user = 'alice'
const userDir = path.join(storageRoot, user)

async function write(rel: string, bytes: number) {
    const full = path.join(userDir, rel)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, Buffer.alloc(bytes))
}

async function writeMeta(rel: string, meta: object) {
    await fs.writeFile(path.join(userDir, `${rel}.cloudinfo`), JSON.stringify(meta))
}

beforeEach(async () => {
    await fs.rm(userDir, { recursive: true, force: true })
    await fs.mkdir(userDir, { recursive: true })
    resetSizeCacheForTests()
    resetStorageStatsForTests()
    tagCache.resetTagCacheForTests()
    mediaCache.clear()
})

afterAll(async () => {
    await fs.rm(storageRoot, { recursive: true, force: true })
})

describe('directory size cache', () => {
    it('shares one scan between concurrent callers and normalizes keys', async () => {
        await write('a/one.bin', 10)
        await write('b/two.bin', 20)
        const spy = vi.spyOn(fs, 'readdir')
        const [x, y, z] = await Promise.all([getDirSize(userDir), getDirSize(userDir + '/'), getDirSize(path.join(userDir, 'a', '..'))])
        expect([x, y, z]).toEqual([30, 30, 30])
        // root + a + b, once each
        expect(spy).toHaveBeenCalledTimes(3)
        spy.mockRestore()
    })

    it('targeted invalidation rescans the changed folder and its parents only', async () => {
        await write('a/one.bin', 10)
        await write('b/two.bin', 20)
        expect(await getDirSize(userDir)).toBe(30)

        // A change nobody reported stays invisible: proves b is served from the cache
        await write('b/unreported.bin', 5)
        await write('a/new.bin', 7)
        clearUserCache(user, [path.join(userDir, 'a')])

        expect(await getDirSize(path.join(userDir, 'a'))).toBe(17)
        expect(await getDirSize(path.join(userDir, 'b'))).toBe(20)
        expect(await getDirSize(userDir)).toBe(37)
    })

    it('drops cached sizes of everything inside a removed folder', async () => {
        await write('a/sub/one.bin', 10)
        expect(await getDirSize(path.join(userDir, 'a', 'sub'))).toBe(10)
        await fs.rm(path.join(userDir, 'a'), { recursive: true })
        await write('a/sub/other.bin', 3)
        clearSizeCache(path.join(userDir, 'a'))
        expect(await getDirSize(path.join(userDir, 'a', 'sub'))).toBe(3)
    })

    it('does not cache a scan that an invalidation overtook', async () => {
        await write('a/one.bin', 10)
        const subDir = path.join(userDir, 'a')
        const realReaddir = fs.readdir.bind(fs)
        let listed!: () => void
        let release!: () => void
        const listedA = new Promise<void>(r => { listed = r })
        const gate = new Promise<void>(r => { release = r })
        const spy = vi.spyOn(fs, 'readdir').mockImplementation((async (dir: any, opts: any) => {
            const result = await realReaddir(dir, opts)
            if (dir === subDir) {
                listed()
                await gate // the listing is taken; hold the scan until after the change below
            }
            return result
        }) as any)

        const scan = getDirSize(userDir)
        await listedA
        await write('a/two.bin', 5)
        clearUserCache(user, [subDir])
        release()
        expect(await scan).toBe(10) // this scan saw the old listing
        spy.mockRestore()

        // ...but must not have been cached
        expect(await getDirSize(userDir)).toBe(15)
    })

    it('limits concurrent work', async () => {
        const limit = createLimiter(2)
        let active = 0
        let peak = 0
        await Promise.all(Array.from({ length: 10 }, () => limit(async () => {
            active++
            peak = Math.max(peak, active)
            await new Promise(r => setTimeout(r, 2))
            active--
        })))
        expect(peak).toBe(2)
    })
})

describe('stale-while-revalidate summaries', () => {
    it('serves the old value while recomputing after an invalidation', async () => {
        let epoch = 0
        let calls = 0
        let release!: () => void
        const store = new SwrStore<number>(60_000)
        const loader = async () => {
            calls++
            if (calls > 1) await new Promise<void>(r => { release = r })
            return calls
        }

        expect(await store.get('k', () => epoch, loader, 1000)).toEqual({ value: 1, pending: false })
        expect(await store.get('k', () => epoch, loader)).toEqual({ value: 1, pending: false })

        epoch++
        expect(await store.get('k', () => epoch, loader)).toEqual({ value: 1, pending: true })
        // still the same refresh, not a second one
        expect(await store.get('k', () => epoch, loader)).toEqual({ value: 1, pending: true })
        expect(calls).toBe(2)
        release()
        await new Promise(r => setTimeout(r, 0))
        expect(await store.get('k', () => epoch, loader)).toEqual({ value: 2, pending: false })
    })

    it('answers without a value instead of waiting on a slow first scan', async () => {
        const store = new SwrStore<number>(60_000)
        const result = await store.get('k', () => 0, () => new Promise(r => setTimeout(() => r(5), 50)), 5)
        expect(result).toEqual({ value: undefined, pending: true })
    })

    it('usage and storage map follow file changes', async () => {
        await write('a/one.bin', 10)
        await write('.trash/old.bin', 4)
        expect((await getUserUsage(user, 1000)).value).toBe(14)
        const map = (await getUserStorageMap(user, 1000)).value!
        expect(map.size).toBe(10) // hidden folders are left out of the map
        expect(map.children?.map(c => c.name)).toEqual(['a'])

        const epoch = getUserCacheEpoch(user)
        await write('b/two.bin', 6)
        clearUserCache(user, [path.join(userDir, 'b')])
        expect(getUserCacheEpoch(user)).toBeGreaterThan(epoch)
        expect((await getUserUsage(user, 1000)).value).toBe(20)
        expect((await getUserStorageMap(user, 1000)).value!.size).toBe(16)
    })
})

describe('media cache', () => {
    it('keeps scans of different folders apart and clears only one user', () => {
        setMediaCache(mediaCacheKey(user, ''), [])
        setMediaCache(mediaCacheKey(user, 'Videos/'), [{ name: 'x' } as any])
        setMediaCache(mediaCacheKey('bob', ''), [])
        expect(mediaCacheKey(user, '/Videos')).toBe(mediaCacheKey(user, 'Videos/'))
        expect(mediaCacheKey(user, 'Videos')).not.toBe(mediaCacheKey(user, ''))

        clearUserCache(user)
        expect(mediaCache.has(mediaCacheKey(user, ''))).toBe(false)
        expect(mediaCache.has(mediaCacheKey(user, 'Videos'))).toBe(false)
        expect(mediaCache.has(mediaCacheKey('bob', ''))).toBe(true)
        clearMediaCache('bob')
        expect(mediaCache.size).toBe(0)
    })
})

describe('tag cache', () => {
    const tagged = { tags: [{ name: 'Holiday' }] }

    it('skips trashed files on rebuild', async () => {
        await write('pics/a.jpg', 1)
        await writeMeta('pics/a.jpg', tagged)
        await write('.trash/1_b.jpg', 1)
        await writeMeta('.trash/1_b.jpg', tagged)
        await tagCache.rebuildTagCache()
        expect(tagCache.getFilesByTagFromCache(user, 'holiday').map(f => f.name)).toEqual(['pics/a.jpg'])
    })

    it('normalizes client paths on update, move and remove', async () => {
        await tagCache.rebuildTagCache()
        await write('pics/a.jpg', 1)
        await tagCache.updateFileInCache(user, '/pics/a.jpg', tagged as any)
        expect(tagCache.getFilesByTagFromCache(user, 'holiday').map(f => f.name)).toEqual(['pics/a.jpg'])

        tagCache.moveFileInCache(user, '/pics/', 'photos')
        expect(tagCache.getFilesByTagFromCache(user, 'holiday').map(f => f.name)).toEqual(['photos/a.jpg'])

        tagCache.removeFileFromCache(user, './photos')
        expect(tagCache.getFilesByTagFromCache(user, 'holiday')).toEqual([])
    })

    it('tracks users created after startup', async () => {
        await write('x.jpg', 1)
        await tagCache.updateFileInCache(user, 'x.jpg', tagged as any)
        expect(tagCache.getFilesByTagFromCache(user, 'holiday')).toHaveLength(1)
    })

    it('re-indexes a restored folder', async () => {
        await tagCache.rebuildTagCache()
        await write('restored/inner.jpg', 1)
        await writeMeta('restored/inner.jpg', tagged)
        await tagCache.addTreeToCache(user, 'restored')
        expect(tagCache.getFilesByTagFromCache(user, 'holiday').map(f => f.name)).toEqual(['restored/inner.jpg'])
    })
})

describe('favorites index', () => {
    it('keeps every entry when changes arrive at once', async () => {
        expect(await favorites.readFavoritesIndex(user)).toBeNull()
        await Promise.all(Array.from({ length: 20 }, (_, i) => favorites.addToFavorites(user, `/f${i}.txt`, false)))
        const entries = await favorites.getFavoritesIndex(user)
        expect(entries).toHaveLength(20)
        expect(entries.every(e => !e.path.startsWith('/'))).toBe(true)
    })

    it('removes entries inside a deleted folder', async () => {
        await favorites.addToFavorites(user, 'dir', true)
        await favorites.addToFavorites(user, 'dir/a.txt', false)
        await favorites.addToFavorites(user, 'dirt.txt', false)
        await favorites.removeFromFavorites(user, '/dir/')
        expect((await favorites.getFavoritesIndex(user)).map(e => e.path)).toEqual(['dirt.txt'])
    })
})

describe('trash receipts', () => {
    it('keeps a receipt for every item trashed at once', async () => {
        await Promise.all(Array.from({ length: 8 }, (_, i) => write(`t${i}.bin`, 1)))
        await Promise.all(Array.from({ length: 8 }, (_, i) => trash.moveToTrash(user, `t${i}.bin`)))
        const items = await trash.listTrash(user)
        expect(items).toHaveLength(8)
    })

    it('updates the used size after the trash is emptied', async () => {
        await write('big.bin', 100)
        await trash.moveToTrash(user, 'big.bin')
        clearUserCache(user)
        const before = (await getUserUsage(user, 1000)).value!
        expect(before).toBeGreaterThanOrEqual(100) // trash counts, plus its metadata.json
        await trash.emptyTrash(user)
        const after = (await getUserUsage(user, 1000)).value!
        expect(before - after).toBeGreaterThanOrEqual(100)
    })
})

describe('http cache', () => {
    function mockEvent(headers: Record<string, string>) {
        return {
            node: {
                req: { headers },
                res: { setHeader: () => {}, statusCode: 200 },
            },
        } as any
    }
    const stats = { size: 10, mtime: new Date('2026-01-01T00:00:00Z') } as any

    it('ignores If-Modified-Since when the ETag does not match', () => {
        const event = mockEvent({ 'if-none-match': '"stale"', 'if-modified-since': new Date('2026-06-01').toUTCString() })
        expect(handleHttpCache(event, stats)).toBe(false)
    })

    it('matches an ETag inside a list', () => {
        const etag = `"${(10).toString(16)}-${stats.mtime.getTime().toString(16)}"`
        const event = mockEvent({ 'if-none-match': `"other", W/${etag}` })
        expect(handleHttpCache(event, stats)).toBe(true)
        expect(event.node.res.statusCode).toBe(304)
    })

    it('treats a thumbnail as stale once its source changed', async () => {
        await write('pic.jpg', 1)
        const source = path.join(userDir, 'pic.jpg')
        const sourceStats = await fs.stat(source)
        expect(await isDerivedFresh({ mtimeMs: sourceStats.mtimeMs + 1000 }, source)).toBe(true)
        expect(await isDerivedFresh({ mtimeMs: sourceStats.mtimeMs - 1000 }, source)).toBe(false)
        expect(await isDerivedFresh({ mtimeMs: Date.now() }, path.join(userDir, 'missing.jpg'))).toBe(false)
    })
})
