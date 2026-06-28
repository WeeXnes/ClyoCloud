interface PreviewTaskStatus {
    isProcessing: boolean
    total: number
    processed: number
    generated: number
    skipped: number
    errors: number
    startTime: number | null
}

const tasks = new Map<string, PreviewTaskStatus>()

export function getPreviewTaskStatus(username: string): PreviewTaskStatus {
    if (!tasks.has(username)) {
        tasks.set(username, {
            isProcessing: false,
            total: 0,
            processed: 0,
            generated: 0,
            skipped: 0,
            errors: 0,
            startTime: null
        })
    }
    return tasks.get(username)!
}

export function updatePreviewTaskStatus(username: string, updates: Partial<PreviewTaskStatus>) {
    const status = getPreviewTaskStatus(username)
    Object.assign(status, updates)
}

export function resetPreviewTaskStatus(username: string) {
    tasks.set(username, {
        isProcessing: false,
        total: 0,
        processed: 0,
        generated: 0,
        skipped: 0,
        errors: 0,
        startTime: null
    })
}

const thumbnailTasks = new Map<string, PreviewTaskStatus>()

export function getThumbnailTaskStatus(username: string): PreviewTaskStatus {
    if (!thumbnailTasks.has(username)) {
        thumbnailTasks.set(username, {
            isProcessing: false,
            total: 0,
            processed: 0,
            generated: 0,
            skipped: 0,
            errors: 0,
            startTime: null
        })
    }
    return thumbnailTasks.get(username)!
}

export function updateThumbnailTaskStatus(username: string, updates: Partial<PreviewTaskStatus>) {
    const status = getThumbnailTaskStatus(username)
    Object.assign(status, updates)
}

export function resetThumbnailTaskStatus(username: string) {
    thumbnailTasks.set(username, {
        isProcessing: false,
        total: 0,
        processed: 0,
        generated: 0,
        skipped: 0,
        errors: 0,
        startTime: null
    })
}
