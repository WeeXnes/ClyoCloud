import fs from 'fs/promises'
import path from 'path'
import type { FileMeta } from '~/types/File'
import { isPathWithin } from './fileUtils'

export async function isFilePublic(storagePath: string, username: string, relativePath: string): Promise<boolean> {
    const userStoragePath = path.resolve(path.join(storagePath, username))
    const filePath = path.resolve(path.join(userStoragePath, relativePath))
    
    // Safety check to ensure the path is within the user's storage directory
    if (!isPathWithin(userStoragePath, filePath)) {
        return false
    }

    const cloudInfoPath = `${filePath}.cloudinfo`
    try {
        await fs.access(cloudInfoPath)
        const cloudInfoContent = await fs.readFile(cloudInfoPath, 'utf-8')
        const meta = JSON.parse(cloudInfoContent) as FileMeta
        return !!meta.isPublic
    } catch {
        return false
    }
}
