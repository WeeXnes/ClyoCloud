import type { ShortMedia } from '~/types/File'

const MEDIA_CACHE_MAX_ENTRIES = 200

// Shared in-memory cache for media scans, keyed per user and scanned sub-path
export const mediaCache = new Map<string, { items: ShortMedia[]; timestamp: number }>();

/**
 * Cache key for one user's scan of one sub-path. Scans of different folders must never share an entry.
 */
export function mediaCacheKey(username: string, subPath = ''): string {
    const normalized = subPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/')
    return `${username}\0${normalized === '.' ? '' : normalized}`
}

export function setMediaCache(key: string, items: ShortMedia[]) {
    mediaCache.delete(key)
    while (mediaCache.size >= MEDIA_CACHE_MAX_ENTRIES) {
        mediaCache.delete(mediaCache.keys().next().value as string)
    }
    mediaCache.set(key, { items, timestamp: Date.now() })
}

/**
 * Clears the media cache for a specific user to force a fresh disk scan on the next request.
 */
export function clearMediaCache(username: string) {
    const prefix = `${username}\0`
    for (const key of mediaCache.keys()) {
        if (key.startsWith(prefix)) mediaCache.delete(key)
    }
}
