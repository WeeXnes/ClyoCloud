import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'clyo-meta-'))
vi.stubGlobal('useRuntimeConfig', () => ({ storagePath: storageRoot }))

const tagCache = await import('../server/utils/tagCache')
const { wallpapersIndex } = await import('../server/utils/wallpapers')
const { favoritesIndex } = await import('../server/utils/favorites')
const { updateFileMeta } = await import('../server/utils/fileMeta')
const { listIndexedFiles } = await import('../server/utils/indexedFiles')
const { resetSizeCacheForTests } = await import('../server/utils/fileUtils')
const watcher = await import('../server/utils/storageWatcher')

const user = 'alice'
const userDir = path.join(storageRoot, user)

async function write(rel: string, content = 'x') {
    const full = path.join(userDir, rel)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, content)
}

async function writeMeta(rel: string, meta: object) {
    await fs.writeFile(path.join(userDir, `${rel}.cloudinfo`), JSON.stringify({ tags: [], ...meta }))
}

async function readIndex(name: string) {
    return JSON.parse(await fs.readFile(path.join(userDir, name), 'utf-8')) as { path: string; isFolder: boolean }[]
}

const paths = (entries: { path: string }[]) => entries.map(e => e.path).sort()
const isWallpaper = (m: any) => m.isWallpaper
const isFavourite = (m: any) => m.isFavourite

beforeEach(async () => {
    await fs.rm(userDir, { recursive: true, force: true })
    await fs.mkdir(userDir, { recursive: true })
    tagCache.resetTagCacheForTests()
    resetSizeCacheForTests()
})

afterAll(async () => {
    watcher.stopStorageWatcher()
    await fs.rm(storageRoot, { recursive: true, force: true })
})

describe('full rescan (reconcileUser)', () => {
    it('makes wallpapers, favourites and tags match the sidecars exactly', async () => {
        await write('pics/a.jpg')
        await writeMeta('pics/a.jpg', { isWallpaper: true, tags: [{ name: 'Sky', color: '#000' }] })
        await write('pics/b.jpg')
        await writeMeta('pics/b.jpg', { isFavourite: true })
        await fs.mkdir(path.join(userDir, 'album'))
        await writeMeta('album', { isWallpaper: true })
        // Stale entries: a deleted file, a file no longer marked, a duplicate with a leading slash
        await write('pics/c.jpg')
        await writeMeta('pics/c.jpg', { isWallpaper: false })
        await fs.writeFile(path.join(userDir, '.wallpapers.json'), JSON.stringify([
            { path: 'gone.jpg', isFolder: false },
            { path: 'pics/c.jpg', isFolder: false },
            { path: '/pics/a.jpg', isFolder: false },
        ]))

        await tagCache.reconcileUser(user)

        expect(await readIndex('.wallpapers.json')).toEqual(expect.arrayContaining([
            { path: 'pics/a.jpg', isFolder: false },
            { path: 'album', isFolder: true },
        ]))
        expect(paths(await readIndex('.wallpapers.json'))).toEqual(['album', 'pics/a.jpg'])
        expect(paths(await readIndex('.favorites.json'))).toEqual(['pics/b.jpg'])
        expect(tagCache.getFilesByTagFromCache(user, 'sky').map(f => f.name)).toEqual(['pics/a.jpg'])
    })

    it('ignores the trash and other hidden folders', async () => {
        await write('.trash/old.jpg')
        await writeMeta('.trash/old.jpg', { isWallpaper: true })
        await tagCache.reconcileUser(user)
        expect(await readIndex('.wallpapers.json')).toEqual([])
    })
})

describe('reading wallpapers and favourites (listIndexedFiles)', () => {
    it('builds the index on first use, then prunes entries that went stale', async () => {
        await write('w1.jpg')
        await writeMeta('w1.jpg', { isWallpaper: true })
        await write('w2.jpg')
        await writeMeta('w2.jpg', { isWallpaper: true })

        let files = await listIndexedFiles(user, wallpapersIndex, isWallpaper)
        expect(files.map(f => f.name)).toEqual(['w1.jpg', 'w2.jpg'])

        // Deleted and un-marked outside ClyoCloud, with no watcher running
        await fs.rm(path.join(userDir, 'w1.jpg'))
        await writeMeta('w2.jpg', { isWallpaper: false })

        files = await listIndexedFiles(user, wallpapersIndex, isWallpaper)
        expect(files).toEqual([])
        expect(await readIndex('.wallpapers.json')).toEqual([])
    })

    it('rejects entries that point outside the user storage', async () => {
        await fs.mkdir(path.join(storageRoot, 'bob'), { recursive: true })
        await fs.writeFile(path.join(storageRoot, 'bob', 'secret.jpg'), 'x')
        await fs.writeFile(path.join(storageRoot, 'bob', 'secret.jpg.cloudinfo'), JSON.stringify({ tags: [], isWallpaper: true }))
        await fs.writeFile(path.join(userDir, '.wallpapers.json'), JSON.stringify([{ path: '../bob/secret.jpg', isFolder: false }]))

        const files = await listIndexedFiles(user, wallpapersIndex, isWallpaper)
        expect(files).toEqual([])
    })

    it('sync picks up files marked outside ClyoCloud', async () => {
        await listIndexedFiles(user, wallpapersIndex, isWallpaper) // creates an empty index
        await write('new.jpg')
        await writeMeta('new.jpg', { isWallpaper: true })

        expect(await listIndexedFiles(user, wallpapersIndex, isWallpaper)).toEqual([])
        const synced = await listIndexedFiles(user, wallpapersIndex, isWallpaper, { sync: true })
        expect(synced.map(f => f.name)).toEqual(['new.jpg'])
    })

    it('corrects a wrong folder/file flag', async () => {
        await fs.mkdir(path.join(userDir, 'dir'))
        await writeMeta('dir', { isFavourite: true })
        await fs.writeFile(path.join(userDir, '.favorites.json'), JSON.stringify([{ path: 'dir', isFolder: false }]))

        const files = await listIndexedFiles(user, favoritesIndex, isFavourite)
        expect(files[0].isFolder).toBe(true)
        expect(await readIndex('.favorites.json')).toEqual([{ path: 'dir', isFolder: true }])
    })
})

describe('writing metadata (updateFileMeta)', () => {
    it('does not lose changes made at the same time', async () => {
        await write('photo.jpg')
        await Promise.all([
            updateFileMeta(user, 'photo.jpg', m => { m.isWallpaper = true }),
            updateFileMeta(user, 'photo.jpg', m => { m.isFavourite = true }),
            updateFileMeta(user, 'photo.jpg', m => { m.description = 'hello' }),
            updateFileMeta(user, 'photo.jpg', m => { m.tags = [{ name: 'Trip', color: '#fff' }] }),
        ])
        const meta = JSON.parse(await fs.readFile(path.join(userDir, 'photo.jpg.cloudinfo'), 'utf-8'))
        expect(meta).toMatchObject({ isWallpaper: true, isFavourite: true, description: 'hello', tags: [{ name: 'Trip' }] })
        expect(paths(await readIndex('.wallpapers.json'))).toEqual(['photo.jpg'])
        expect(paths(await readIndex('.favorites.json'))).toEqual(['photo.jpg'])
        expect(tagCache.getFilesByTagFromCache(user, 'trip').map(f => f.name)).toEqual(['photo.jpg'])
    })

    it('un-marking a folder keeps the marked files inside it', async () => {
        await write('trip/one.jpg')
        await updateFileMeta(user, 'trip', m => { m.isFavourite = true })
        await updateFileMeta(user, 'trip/one.jpg', m => { m.isFavourite = true })
        await updateFileMeta(user, 'trip', m => { m.isFavourite = false })
        expect(paths(await readIndex('.favorites.json'))).toEqual(['trip/one.jpg'])
    })

    it('keeps the tag lookup in step when tags are removed', async () => {
        await write('a.jpg')
        await updateFileMeta(user, 'a.jpg', m => { m.tags = [{ name: 'Old', color: '#000' }] })
        await updateFileMeta(user, 'a.jpg', m => { m.tags = [] })
        expect(tagCache.getFilesByTagFromCache(user, 'old')).toEqual([])
    })
})

describe('changes made outside ClyoCloud (storage watcher events)', () => {
    it('adds a marked file that appears and drops it when it is deleted', async () => {
        await tagCache.reconcileUser(user)
        await write('drop/fresh.jpg')
        await writeMeta('drop/fresh.jpg', { isWallpaper: true, tags: [{ name: 'New', color: '#000' }] })
        watcher.simulateStorageEventForTests(`${user}/drop/fresh.jpg`)
        watcher.simulateStorageEventForTests(`${user}/drop/fresh.jpg.cloudinfo`)
        await watcher.flushStorageWatcherForTests()

        expect(paths(await readIndex('.wallpapers.json'))).toEqual(['drop/fresh.jpg'])
        expect(tagCache.getFilesByTagFromCache(user, 'new').map(f => f.name)).toEqual(['drop/fresh.jpg'])

        await fs.rm(path.join(userDir, 'drop'), { recursive: true })
        watcher.simulateStorageEventForTests(`${user}/drop`)
        await watcher.flushStorageWatcherForTests()

        expect(await readIndex('.wallpapers.json')).toEqual([])
        expect(tagCache.getFilesByTagFromCache(user, 'new')).toEqual([])
    })

    it('follows a folder renamed outside ClyoCloud', async () => {
        await write('before/x.jpg')
        await writeMeta('before/x.jpg', { isFavourite: true })
        await tagCache.reconcileUser(user)

        await fs.rename(path.join(userDir, 'before'), path.join(userDir, 'after'))
        watcher.simulateStorageEventForTests(`${user}/before`)
        watcher.simulateStorageEventForTests(`${user}/after`)
        await watcher.flushStorageWatcherForTests()

        expect(paths(await readIndex('.favorites.json'))).toEqual(['after/x.jpg'])
    })

    it('a hand-edited sidecar only re-reads that file', async () => {
        await write('dir/inner.jpg')
        await writeMeta('dir/inner.jpg', { isWallpaper: true })
        await fs.writeFile(path.join(userDir, 'dir.cloudinfo'), JSON.stringify({ tags: [] }))
        await tagCache.reconcileUser(user)

        await writeMeta('dir', { isWallpaper: true })
        watcher.simulateStorageEventForTests(`${user}/dir.cloudinfo`)
        await watcher.flushStorageWatcherForTests()

        expect(paths(await readIndex('.wallpapers.json'))).toEqual(['dir', 'dir/inner.jpg'])
    })

    it('ignores its own index writes and temporary files', async () => {
        await tagCache.reconcileUser(user)
        watcher.simulateStorageEventForTests(`${user}/.wallpapers.json`)
        watcher.simulateStorageEventForTests(`${user}/a.jpg.cloudinfo.1234.abcd1234.tmp`)
        await watcher.flushStorageWatcherForTests()
        expect(await readIndex('.wallpapers.json')).toEqual([])
    })
})
