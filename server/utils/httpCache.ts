import { H3Event, getRequestHeader, setHeader, setResponseStatus } from 'h3'
import type { Stats } from 'fs'

/**
 * Handle HTTP conditional requests and cache-control headers.
 * Returns true if a 304 Not Modified response was set, meaning the handler should return immediately.
 */
export function handleHttpCache(event: H3Event, stats: Stats, isPublic = false): boolean {
    const etag = `"${stats.size.toString(16)}-${stats.mtime.getTime().toString(16)}"`
    const lastModified = stats.mtime.toUTCString()

    setHeader(event, 'ETag', etag)
    setHeader(event, 'Last-Modified', lastModified)
    setHeader(event, 'Cache-Control', isPublic
        ? 'public, max-age=604800, stale-while-revalidate=86400'
        : 'private, max-age=604800, stale-while-revalidate=86400'
    )

    const ifNoneMatch = getRequestHeader(event, 'if-none-match')
    if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === `W/${etag}`)) {
        setResponseStatus(event, 304)
        return true
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
