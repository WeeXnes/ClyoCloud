import { createPathIndex, type PathIndexEntry } from './pathIndex'

export type WallpaperEntry = PathIndexEntry

const index = createPathIndex('.wallpapers.json', 'wallpapers')

/** null when no index has been written yet */
export const readWallpapersIndex = index.read
export const getWallpapersIndex = index.get
export const saveWallpapersIndex = index.save

export async function addToWallpapers(username: string, filePath: string, isFolder: boolean) {
    await index.add(username, filePath, isFolder)
}

export async function removeFromWallpapers(username: string, filePath: string) {
    await index.remove(username, filePath)
}

export async function renameInWallpapers(username: string, oldPath: string, newPath: string) {
    await index.rename(username, oldPath, newPath)
}

export async function moveInWallpapers(username: string, oldPaths: string[], destination: string) {
    await index.move(username, oldPaths, destination)
}
