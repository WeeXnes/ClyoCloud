import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const QUICK_HASH_SIZE = 64 * 1024 // 64 KB

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    const config = useRuntimeConfig()
    const userStoragePath = path.join(config.storagePath, event.context.user.name)
    
    // Step 1: Group files by size
    const filesBySize = new Map<number, string[]>()

    async function scanDir(currentPath: string) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true })
        
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name)
            
            if (entry.isDirectory()) {
                await scanDir(fullPath)
            } else if (entry.isFile() && !entry.name.endsWith('.cloudinfo')) {
                const stats = await fs.stat(fullPath)
                const size = stats.size
                
                if (size === 0) continue // Skip empty files

                if (!filesBySize.has(size)) {
                    filesBySize.set(size, [])
                }
                filesBySize.get(size)!.push(fullPath)
            }
        }
    }

    try {
        await scanDir(userStoragePath)

        // Step 2: For sizes with multiple files, perform quick hash
        const duplicateGroups: any[] = []

        for (const [size, paths] of filesBySize.entries()) {
            if (paths.length < 2) continue

            const hashGroups = new Map<string, any[]>()

            for (const filePath of paths) {
                try {
                    const fd = await fs.open(filePath, 'r')
                    const buffer = Buffer.alloc(Math.min(size, QUICK_HASH_SIZE))
                    await fd.read(buffer, 0, buffer.length, 0)
                    await fd.close()

                    const hash = crypto.createHash('md5').update(buffer).digest('hex')
                    
                    if (!hashGroups.has(hash)) {
                        hashGroups.set(hash, [])
                    }
                    
                    const stats = await fs.stat(filePath)
                    const relativePath = path.relative(userStoragePath, filePath).replace(/\\/g, '/')
                    
                    hashGroups.get(hash)!.push({
                        name: path.basename(filePath),
                        fullPath: relativePath,
                        size: stats.size,
                        lastModified: stats.mtime.getTime()
                    })
                } catch (err) {
                    console.error(`Error hashing ${filePath}:`, err)
                }
            }

            for (const group of hashGroups.values()) {
                if (group.length > 1) {
                    duplicateGroups.push({
                        size,
                        files: group,
                        redundantSize: size * (group.length - 1)
                    })
                }
            }
        }

        // Sort by redundant size (most space saved first)
        return duplicateGroups.sort((a, b) => b.redundantSize - a.redundantSize).slice(0, 50)

    } catch (error) {
        console.error('Duplicate scan error:', error)
        throw createError({
            statusCode: 500,
            statusMessage: 'Could not perform duplicate scan',
        })
    }
})
