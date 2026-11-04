import fs from 'fs/promises'
import crypto from 'crypto'

// Serializes read-modify-write cycles per file within this process
const fileQueues = new Map<string, Promise<unknown>>()

/**
 * Runs `task` once every earlier task for the same file has settled.
 * Not reentrant: calling it again for the same file from inside `task` deadlocks.
 */
export function withFileLock<T>(filePath: string, task: () => Promise<T>): Promise<T> {
    const previous = fileQueues.get(filePath) ?? Promise.resolve()
    const run = previous.catch(() => {}).then(task)
    const settled = run.catch(() => {})
    fileQueues.set(filePath, settled)
    settled.then(() => {
        if (fileQueues.get(filePath) === settled) {
            fileQueues.delete(filePath)
        }
    })
    return run
}

/**
 * Writes via a synced temp file and rename, so a crash never leaves a truncated file behind.
 * Keeps the existing file's mode; new files get `newFileMode` (owner-only by default).
 */
export async function writeFileAtomic(filePath: string, data: string, newFileMode = 0o600): Promise<void> {
    let mode = newFileMode
    try {
        mode = (await fs.stat(filePath)).mode & 0o777
    } catch {
        // New file
    }

    const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`
    try {
        const handle = await fs.open(tempPath, 'wx', mode)
        try {
            await handle.writeFile(data, 'utf-8')
            await handle.sync()
        } finally {
            await handle.close()
        }
        await fs.rename(tempPath, filePath)
    } catch (err) {
        await fs.rm(tempPath, { force: true }).catch(() => {})
        throw err
    }
}
