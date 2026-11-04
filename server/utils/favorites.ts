import { createPathIndex, type PathIndexEntry } from './pathIndex'

export type FavoriteEntry = PathIndexEntry

const index = createPathIndex('.favorites.json', 'favorites')

/** null when no index has been written yet */
export const readFavoritesIndex = index.read
export const getFavoritesIndex = index.get
export const saveFavoritesIndex = index.save

export async function addToFavorites(username: string, filePath: string, isFolder: boolean) {
    await index.add(username, filePath, isFolder)
}

export async function removeFromFavorites(username: string, filePath: string) {
    await index.remove(username, filePath)
}

export async function renameInFavorites(username: string, oldPath: string, newPath: string) {
    await index.rename(username, oldPath, newPath)
}

export async function moveInFavorites(username: string, oldPaths: string[], destination: string) {
    await index.move(username, oldPaths, destination)
}
