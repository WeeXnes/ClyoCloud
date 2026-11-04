import { createPathIndex, type PathIndexEntry } from './pathIndex'

export type WallpaperEntry = PathIndexEntry

export const wallpapersIndex = createPathIndex('.wallpapers.json', 'wallpapers')

/** null when no index has been written yet */
export const readWallpapersIndex = wallpapersIndex.read
export const getWallpapersIndex = wallpapersIndex.get
export const saveWallpapersIndex = wallpapersIndex.save

export async function addToWallpapers(username: string, filePath: string, isFolder: boolean) {
    await wallpapersIndex.add(username, filePath, isFolder)
}

/** For a path that is gone from disk: drops it and everything indexed inside it. */
export async function removeFromWallpapers(username: string, filePath: string) {
    await wallpapersIndex.remove(username, filePath)
}

export async function renameInWallpapers(username: string, oldPath: string, newPath: string) {
    await wallpapersIndex.rename(username, oldPath, newPath)
}

export async function moveInWallpapers(username: string, oldPaths: string[], destination: string) {
    await wallpapersIndex.move(username, oldPaths, destination)
}
