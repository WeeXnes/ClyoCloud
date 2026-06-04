interface CleanupTaskStatus {
    isScanning: boolean
    totalFiles: number
    startTime: number | null
    results: any | null
}

const tasks = new Map<string, CleanupTaskStatus>()

export function getCleanupTaskStatus(username: string): CleanupTaskStatus {
    if (!tasks.has(username)) {
        tasks.set(username, {
            isScanning: false,
            totalFiles: 0,
            startTime: null,
            results: null
        })
    }
    return tasks.get(username)!
}

export function updateCleanupTaskStatus(username: string, updates: Partial<CleanupTaskStatus>) {
    const status = getCleanupTaskStatus(username)
    Object.assign(status, updates)
}

export function resetCleanupTaskStatus(username: string) {
    tasks.set(username, {
        isScanning: false,
        totalFiles: 0,
        startTime: null,
        results: null
    })
}
