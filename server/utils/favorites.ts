import fs from 'fs/promises'
import path from 'path'

export interface FavoriteEntry {
    path: string;
    isFolder: boolean;
}

export async function getFavoritesIndex(username: string): Promise<FavoriteEntry[]> {
    const config = useRuntimeConfig()
    const indexPath = path.join(config.storagePath, username, '.favorites.json')
    
    try {
        const content = await fs.readFile(indexPath, 'utf-8')
        return JSON.parse(content)
    } catch {
        return []
    }
}

export async function saveFavoritesIndex(username: string, favorites: FavoriteEntry[]) {
    const config = useRuntimeConfig()
    const indexPath = path.join(config.storagePath, username, '.favorites.json')
    
    try {
        await fs.writeFile(indexPath, JSON.stringify(favorites, null, 2), 'utf-8')
    } catch (err) {
        console.error('Error saving favorites index:', err)
    }
}

export async function addToFavorites(username: string, filePath: string, isFolder: boolean) {
    const favorites = await getFavoritesIndex(username)
    if (!favorites.some(f => f.path === filePath)) {
        favorites.push({ path: filePath, isFolder })
        await saveFavoritesIndex(username, favorites)
    }
}

export async function removeFromFavorites(username: string, filePath: string) {
    const favorites = await getFavoritesIndex(username)
    const newFavorites = favorites.filter(f => f.path !== filePath)
    if (newFavorites.length !== favorites.length) {
        await saveFavoritesIndex(username, newFavorites)
    }
}

export async function renameInFavorites(username: string, oldPath: string, newPath: string) {
    const favorites = await getFavoritesIndex(username)
    let changed = false
    
    const updatedFavorites = favorites.map(f => {
        if (f.path === oldPath) {
            changed = true
            return { ...f, path: newPath }
        }
        // If it's a folder, update children paths
        if (f.path.startsWith(oldPath + '/')) {
            changed = true
            return { ...f, path: newPath + f.path.slice(oldPath.length) }
        }
        return f
    })
    
    if (changed) {
        await saveFavoritesIndex(username, updatedFavorites)
    }
}

export async function moveInFavorites(username: string, oldPaths: string[], destination: string) {
    const favorites = await getFavoritesIndex(username)
    let changed = false
    
    const updatedFavorites = favorites.map(f => {
        const matchingPath = oldPaths.find(p => f.path === p || f.path.startsWith(p + '/'))
        if (matchingPath) {
            changed = true
            const fileName = matchingPath.split('/').pop()!
            const newBase = destination ? `${destination}/${fileName}` : fileName
            return { ...f, path: newBase + f.path.slice(matchingPath.length) }
        }
        return f
    })
    
    if (changed) {
        await saveFavoritesIndex(username, updatedFavorites)
    }
}
