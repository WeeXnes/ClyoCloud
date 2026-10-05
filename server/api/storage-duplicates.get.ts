import { defineEventHandler, createError } from 'h3'
import fs from 'fs/promises'
import { createReadStream } from 'fs'
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

        // Step 2: For sizes with multiple files, perform quick hash followed by full SHA-256 verification
        updateDuplicateTaskStatus(username, { phase: 'hashing' })
        const duplicateGroups: any[] = []
        let processedFiles = 0

        const candidates = Array.from(filesBySize.entries()).filter(([size, paths]) => paths.length >= 2)
        const totalCandidates = candidates.reduce((acc, [_, paths]) => acc + paths.length, 0)

        for (const [size, paths] of candidates) {
            const hashGroups = new Map<string, Array<{
                name: string
                fullPath: string
                realPath: string
                size: number
                lastModified: number
            }>>()

            for (const filePath of paths) {
                try {
                    const fd = await fs.open(filePath, 'r')
                    const buffer = Buffer.alloc(Math.min(size, QUICK_HASH_SIZE))
                    await fd.read(buffer, 0, buffer.length, 0)
                    await fd.close()

                    // Use SHA-256 for quick candidate hashing
                    const quickHash = crypto.createHash('sha256').update(buffer).digest('hex')
                    
                    if (!hashGroups.has(quickHash)) {
                        hashGroups.set(quickHash, [])
                    }
                    
                    const stats = await fs.stat(filePath)
                    const relativePath = path.relative(userStoragePath, filePath).replace(/\\/g, '/')
                    
                    hashGroups.get(quickHash)!.push({
                        name: path.basename(filePath),
                        fullPath: relativePath,
                        realPath: filePath,
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

            // Phase 2: For candidate groups with >= 2 files, perform full-stream SHA-256 verification
            for (const candidateGroup of hashGroups.values()) {
                if (candidateGroup.length < 2) continue

                // If file size is within QUICK_HASH_SIZE, the quick hash already covered the entire file
                if (size <= QUICK_HASH_SIZE) {
                    const files = candidateGroup.map(({ name, fullPath, size, lastModified }) => ({
                        name,
                        fullPath,
                        size,
                        lastModified
                    }))
                    duplicateGroups.push({
                        size,
                        files,
                        redundantSize: size * (files.length - 1)
                    })
                    continue
                }

                // If file is larger than QUICK_HASH_SIZE, verify exact match via full-file SHA-256 streaming
                const fullHashGroups = new Map<string, Array<{
                    name: string
                    fullPath: string
                    size: number
                    lastModified: number
                }>>()

                for (const candidate of candidateGroup) {
                    try {
                        const fullHash = await computeFullSha256(candidate.realPath)
                        if (!fullHashGroups.has(fullHash)) {
                            fullHashGroups.set(fullHash, [])
                        }
                        fullHashGroups.get(fullHash)!.push({
                            name: candidate.name,
                            fullPath: candidate.fullPath,
                            size: candidate.size,
                            lastModified: candidate.lastModified
                        })
                    } catch (err) {
                        console.error(`Error computing full hash for ${candidate.realPath}:`, err)
                    }
                }

                for (const confirmedGroup of fullHashGroups.values()) {
                    if (confirmedGroup.length > 1) {
                        duplicateGroups.push({
                            size,
                            files: confirmedGroup,
                            redundantSize: size * (confirmedGroup.length - 1)
                        })
                    }
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

async function computeFullSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256')
        const stream = createReadStream(filePath)
        stream.on('data', (chunk) => hash.update(chunk))
        stream.on('end', () => resolve(hash.digest('hex')))
        stream.on('error', (err) => reject(err))
    })
}
