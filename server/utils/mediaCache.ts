import type { ShortMedia } from '~/types/File'

// Shared in-memory cache for media scans
export const mediaCache = new Map<string, { items: ShortMedia[]; timestamp: number }>();

/**
 * Clears the media cache for a specific user to force a fresh disk scan on the next request.
 */
export function clearMediaCache(username: string) {
    mediaCache.delete(username);
}
