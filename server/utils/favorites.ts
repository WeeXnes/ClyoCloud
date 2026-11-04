import { createPathIndex, type PathIndexEntry } from './pathIndex'

export type FavoriteEntry = PathIndexEntry

export const favoritesIndex = createPathIndex('.favorites.json', 'favorites')

/** null when no index has been written yet */
export const readFavoritesIndex = favoritesIndex.read
export const getFavoritesIndex = favoritesIndex.get
export const saveFavoritesIndex = favoritesIndex.save

export async function addToFavorites(username: string, filePath: string, isFolder: boolean) {
    await favoritesIndex.add(username, filePath, isFolder)
}

/** For a path that is gone from disk: drops it and everything indexed inside it. */
export async function removeFromFavorites(username: string, filePath: string) {
    await favoritesIndex.remove(username, filePath)
}

export async function renameInFavorites(username: string, oldPath: string, newPath: string) {
    await favoritesIndex.rename(username, oldPath, newPath)
}

export async function moveInFavorites(username: string, oldPaths: string[], destination: string) {
    await favoritesIndex.move(username, oldPaths, destination)
}
