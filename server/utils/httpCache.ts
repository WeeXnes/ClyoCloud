import { H3Event, getRequestHeader, setHeader, setResponseStatus } from 'h3'
import { stat } from 'fs/promises'
import type { Stats } from 'fs'

// Thumbnail and preview URLs are not versioned, so a replaced file reuses the same URL.
// A short max-age plus stale-while-revalidate keeps grids instant while the browser
// revalidates (a cheap 304) in the background instead of trusting its copy for a week.
const PRIVATE_CACHE_CONTROL = 'private, max-age=60, stale-while-revalidate=604800'
const PUBLIC_CACHE_CONTROL = 'public, max-age=60, stale-while-revalidate=604800'

/**
 * Handle HTTP conditional requests and cache-control headers.
 * Returns true if a 304 Not Modified response was set, meaning the handler should return immediately.
 */
export function handleHttpCache(event: H3Event, stats: Pick<Stats, 'size' | 'mtime'>, isPublic = false): boolean {
    const etag = `"${stats.size.toString(16)}-${stats.mtime.getTime().toString(16)}"`
    const lastModified = stats.mtime.toUTCString()

    setHeader(event, 'ETag', etag)
    setHeader(event, 'Last-Modified', lastModified)
    setHeader(event, 'Cache-Control', isPublic ? PUBLIC_CACHE_CONTROL : PRIVATE_CACHE_CONTROL)

    const ifNoneMatch = getRequestHeader(event, 'if-none-match')
    if (ifNoneMatch) {
        // RFC 9110 13.1.3: when If-None-Match is present, If-Modified-Since must be ignored
        const candidates = ifNoneMatch.split(',').map(tag => tag.trim().replace(/^W\//, ''))
        if (candidates.includes('*') || candidates.includes(etag)) {
            setResponseStatus(event, 304)
            return true
        }
        return false
    }

    const ifModifiedSince = getRequestHeader(event, 'if-modified-since')
    if (ifModifiedSince) {
        const clientTime = new Date(ifModifiedSince).getTime()
        // If client's cached version is newer or equal to mtime (ignoring sub-second precision)
        if (!isNaN(clientTime) && Math.floor(stats.mtime.getTime() / 1000) <= Math.floor(clientTime / 1000)) {
            setResponseStatus(event, 304)
            return true
        }
    }

    return false
}

/**
 * True if a generated file (thumbnail, preview) is still valid for its source:
 * the source exists and has not been modified after the generated file was written.
 */
export async function isDerivedFresh(derived: Pick<Stats, 'mtimeMs'>, sourcePath: string): Promise<boolean> {
    try {
        const source = await stat(sourcePath)
        return source.mtimeMs <= derived.mtimeMs
    } catch {
        return false
    }
}
