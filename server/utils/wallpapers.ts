import fs from 'fs/promises'
import path from 'path'

export interface WallpaperEntry {
    path: string;
    isFolder: boolean;
}

export async function getWallpapersIndex(username: string): Promise<WallpaperEntry[]> {
    const config = useRuntimeConfig()
    const indexPath = path.join(config.storagePath, username, '.wallpapers.json')
    
    try {
        const content = await fs.readFile(indexPath, 'utf-8')
        return JSON.parse(content)
    } catch {
        return []
    }
}

export async function saveWallpapersIndex(username: string, wallpapers: WallpaperEntry[]) {
    const config = useRuntimeConfig()
    const indexPath = path.join(config.storagePath, username, '.wallpapers.json')
    
    try {
        await fs.writeFile(indexPath, JSON.stringify(wallpapers, null, 2), 'utf-8')
    } catch (err) {
        console.error('Error saving wallpapers index:', err)
    }
}

export async function addToWallpapers(username: string, filePath: string, isFolder: boolean) {
    const wallpapers = await getWallpapersIndex(username)
    if (!wallpapers.some(f => f.path === filePath)) {
        wallpapers.push({ path: filePath, isFolder })
        await saveWallpapersIndex(username, wallpapers)
    }
}

export async function removeFromWallpapers(username: string, filePath: string) {
    const wallpapers = await getWallpapersIndex(username)
    const newWallpapers = wallpapers.filter(f => f.path !== filePath)
    if (newWallpapers.length !== wallpapers.length) {
        await saveWallpapersIndex(username, newWallpapers)
    }
}

export async function renameInWallpapers(username: string, oldPath: string, newPath: string) {
    const wallpapers = await getWallpapersIndex(username)
    let changed = false
    
    const updatedWallpapers = wallpapers.map(f => {
        if (f.path === oldPath) {
            changed = true
            return { ...f, path: newPath }
        }
        // If it's a folder, update children paths
        if (f.path.startsWith(oldPath + '/')) {
            changed = true
            return { ...f, path: f.path.replace(oldPath, newPath) }
        }
        return f
    })
    
    if (changed) {
        await saveWallpapersIndex(username, updatedWallpapers)
    }
}

export async function moveInWallpapers(username: string, oldPaths: string[], destination: string) {
    const wallpapers = await getWallpapersIndex(username)
    let changed = false
    
    const updatedWallpapers = wallpapers.map(f => {
        const matchingPath = oldPaths.find(p => f.path === p || f.path.startsWith(p + '/'))
        if (matchingPath) {
            changed = true
            const fileName = matchingPath.split('/').pop()!
            const newBase = destination ? `${destination}/${fileName}` : fileName
            return { ...f, path: f.path.replace(matchingPath, newBase) }
        }
        return f
    })
    
    if (changed) {
        await saveWallpapersIndex(username, updatedWallpapers)
    }
}
