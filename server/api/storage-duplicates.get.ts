import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { getDuplicateTaskStatus, updateDuplicateTaskStatus } from '~/server/utils/duplicateTask'

const QUICK_HASH_SIZE = 64 * 1024 // 64 KB

export default defineEventHandler(async (event) => {
    if (!event.context.user) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        })
    }

    const username = event.context.user.name
    const status = getDuplicateTaskStatus(username)

    if (status.isScanning) {
        return status
    }

    // Start background scan
    performScan(username, event)

    return getDuplicateTaskStatus(username)
})

async function performScan(username: string, event: any) {
    const config = useRuntimeConfig()
    const userStoragePath = path.join(config.storagePath, username)
    
    updateDuplicateTaskStatus(username, {
        isScanning: true,
        progress: 0,
        phase: 'indexing',
        totalFiles: 0,
        processedFiles: 0,
        startTime: Date.now(),
        results: []
    })

    try {
        // Step 1: Group files by size
        const filesBySize = new Map<number, string[]>()
        let totalFilesCount = 0

        async function scanDir(currentPath: string) {
            const entries = await fs.readdir(currentPath, { withFileTypes: true })
            
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name)
                
                if (entry.isDirectory()) {
                    await scanDir(fullPath)
                } else if (entry.isFile() && !entry.name.endsWith('.cloudinfo') && !entry.name.startsWith('.')) {
                    const stats = await fs.stat(fullPath)
                    const size = stats.size
                    
                    if (size === 0) continue // Skip empty files

                    if (!filesBySize.has(size)) {
                        filesBySize.set(size, [])
                    }
                    filesBySize.get(size)!.push(fullPath)
                    totalFilesCount++
                    
                    updateDuplicateTaskStatus(username, { totalFiles: totalFilesCount })
                }
            }
        }

        await scanDir(userStoragePath)

        // Step 2: For sizes with multiple files, perform quick hash
        updateDuplicateTaskStatus(username, { phase: 'hashing' })
        const duplicateGroups: any[] = []
        let processedFiles = 0

        const candidates = Array.from(filesBySize.entries()).filter(([size, paths]) => paths.length >= 2)
        const totalCandidates = candidates.reduce((acc, [_, paths]) => acc + paths.length, 0)

        for (const [size, paths] of candidates) {
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
                } finally {
                    processedFiles++
                    updateDuplicateTaskStatus(username, { 
                        processedFiles,
                        progress: Math.round((processedFiles / totalCandidates) * 100)
                    })
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

        // Load user settings to get duplicate limit
        let maxDuplicateResults = 50
        try {
            const usersFilePath = config.usersFilePath
            const usersData = await fs.readFile(usersFilePath, 'utf-8')
            const users = JSON.parse(usersData)
            const userData = users.find((u: any) => u.name === username)
            if (userData && typeof userData.maxDuplicateResults === 'number') {
                maxDuplicateResults = userData.maxDuplicateResults
            }
        } catch (err) {
            console.error('Error reading maxDuplicateResults for duplicate scan:', err)
        }

        // Step 3: Sort by redundant size (most space saved first)
        updateDuplicateTaskStatus(username, { phase: 'sorting' })
        const finalResults = duplicateGroups.sort((a, b) => b.redundantSize - a.redundantSize).slice(0, maxDuplicateResults)

        updateDuplicateTaskStatus(username, {
            isScanning: false,
            progress: 100,
            phase: 'idle',
            results: finalResults
        })

    } catch (error) {
        console.error('Duplicate scan error:', error)
        updateDuplicateTaskStatus(username, {
            isScanning: false,
            phase: 'idle'
        })
    }
}
