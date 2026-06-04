interface DuplicateTaskStatus {
    isScanning: boolean
    progress: number // 0 to 100
    phase: 'indexing' | 'hashing' | 'sorting' | 'idle'
    totalFiles: number
    processedFiles: number
    startTime: number | null
    results: any[]
}

const tasks = new Map<string, DuplicateTaskStatus>()

export function getDuplicateTaskStatus(username: string): DuplicateTaskStatus {
    if (!tasks.has(username)) {
        tasks.set(username, {
            isScanning: false,
            progress: 0,
            phase: 'idle',
            totalFiles: 0,
            processedFiles: 0,
            startTime: null,
            results: []
        })
    }
    return tasks.get(username)!
}

export function updateDuplicateTaskStatus(username: string, updates: Partial<DuplicateTaskStatus>) {
    const status = getDuplicateTaskStatus(username)
    Object.assign(status, updates)
}

export function resetDuplicateTaskStatus(username: string) {
    tasks.set(username, {
        isScanning: false,
        progress: 0,
        phase: 'idle',
        totalFiles: 0,
        processedFiles: 0,
        startTime: null,
        results: []
    })
}
