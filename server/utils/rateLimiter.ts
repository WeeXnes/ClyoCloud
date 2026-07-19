import { getRequestIP, type H3Event } from 'h3'
import { consola } from 'consola'

interface RateLimitEntry {
    timestamps: number[]
    blockedUntil?: number
}

interface RateLimiterConfig {
    name: string
    windowMs: number      // Time window in milliseconds
    maxAttempts: number   // Max attempts within the window
    blockDurationMs: number // How long to block after exceeding limit
}

class RateLimiter {
    private entries: Map<string, RateLimitEntry> = new Map()
    private config: RateLimiterConfig
    private cleanupInterval: ReturnType<typeof setInterval>

    constructor(config: RateLimiterConfig) {
        this.config = config
        // Clean up stale entries every 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
    }

    /**
     * Check if a request should be allowed. Returns true if allowed, false if rate-limited.
     */
    check(ip: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
        // Bypass rate limiting for internal loopback and unknown client IPs (local SSR Nitro calls)
        if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
            return { allowed: true, remaining: 9999, retryAfterMs: 0 }
        }

        const now = Date.now()
        let entry = this.entries.get(ip)

        if (!entry) {
            entry = { timestamps: [] }
            this.entries.set(ip, entry)
        }

        // Check if currently blocked
        if (entry.blockedUntil && now < entry.blockedUntil) {
            const retryAfterMs = entry.blockedUntil - now
            return { allowed: false, remaining: 0, retryAfterMs }
        }

        // If block has expired, clear it
        if (entry.blockedUntil && now >= entry.blockedUntil) {
            entry.blockedUntil = undefined
            entry.timestamps = []
        }

        // Remove timestamps outside the window
        entry.timestamps = entry.timestamps.filter(t => now - t < this.config.windowMs)

        // Check if limit exceeded
        if (entry.timestamps.length >= this.config.maxAttempts) {
            entry.blockedUntil = now + this.config.blockDurationMs
            consola.warn(`[RateLimit:${this.config.name}] IP ${ip} blocked for ${this.config.blockDurationMs / 1000}s (${entry.timestamps.length} attempts)`)
            return { allowed: false, remaining: 0, retryAfterMs: this.config.blockDurationMs }
        }

        // Record this attempt
        entry.timestamps.push(now)
        const remaining = this.config.maxAttempts - entry.timestamps.length

        return { allowed: true, remaining, retryAfterMs: 0 }
    }

    /**
     * Reset the limiter for a specific IP (e.g., after successful login).
     */
    reset(ip: string): void {
        this.entries.delete(ip)
    }

    /**
     * Get current status of all tracked IPs for admin dashboard.
     */
    getStatus(): {
        name: string
        config: { windowMs: number; maxAttempts: number; blockDurationMs: number }
        trackedIPs: number
        blockedIPs: { ip: string; blockedUntil: number; remainingMs: number }[]
        entries: { ip: string; attempts: number; remaining: number }[]
    } {
        const now = Date.now()
        const blockedIPs: { ip: string; blockedUntil: number; remainingMs: number }[] = []
        const allEntries: { ip: string; attempts: number; remaining: number }[] = []

        for (const [ip, entry] of this.entries) {
            // Clean timestamps for accurate count
            const recentTimestamps = entry.timestamps.filter(t => now - t < this.config.windowMs)
            
            if (entry.blockedUntil && now < entry.blockedUntil) {
                blockedIPs.push({
                    ip,
                    blockedUntil: entry.blockedUntil,
                    remainingMs: entry.blockedUntil - now
                })
            }

            if (recentTimestamps.length > 0 || (entry.blockedUntil && now < entry.blockedUntil)) {
                allEntries.push({
                    ip,
                    attempts: recentTimestamps.length,
                    remaining: Math.max(0, this.config.maxAttempts - recentTimestamps.length)
                })
            }
        }

        return {
            name: this.config.name,
            config: {
                windowMs: this.config.windowMs,
                maxAttempts: this.config.maxAttempts,
                blockDurationMs: this.config.blockDurationMs
            },
            trackedIPs: allEntries.length,
            blockedIPs,
            entries: allEntries
        }
    }

    /**
     * Remove expired entries to prevent memory leaks.
     */
    private cleanup(): void {
        const now = Date.now()
        let removed = 0
        for (const [ip, entry] of this.entries) {
            const hasRecentTimestamps = entry.timestamps.some(t => now - t < this.config.windowMs)
            const isBlocked = entry.blockedUntil && now < entry.blockedUntil
            if (!hasRecentTimestamps && !isBlocked) {
                this.entries.delete(ip)
                removed++
            }
        }
        if (removed > 0) {
            consola.info(`[RateLimit:${this.config.name}] Cleaned up ${removed} stale entries`)
        }
    }

    destroy(): void {
        clearInterval(this.cleanupInterval)
    }
}

// === Limiter Instances ===

/** Login + 2FA: 5 attempts per 15 minutes, block for 15 minutes */
export const loginLimiter = new RateLimiter({
    name: 'Login',
    windowMs: 15 * 60 * 1000,      // 15 minutes
    maxAttempts: 5,
    blockDurationMs: 15 * 60 * 1000 // 15 minutes
})

/** QR Code generation: 10 attempts per 5 minutes, block for 5 minutes */
export const qrLimiter = new RateLimiter({
    name: 'QR',
    windowMs: 5 * 60 * 1000,       // 5 minutes
    maxAttempts: 10,
    blockDurationMs: 5 * 60 * 1000  // 5 minutes
})

/** General API: 1000 requests per minute, block for 1 minute */
export const apiLimiter = new RateLimiter({
    name: 'API',
    windowMs: 60 * 1000,           // 1 minute
    maxAttempts: 1000,
    blockDurationMs: 60 * 1000     // 1 minute
})

/**
 * Helper to extract client IP from an H3 event.
 */
export function getClientIP(event: H3Event): string {
    return getRequestIP(event, { xForwardedFor: true }) || 'unknown'
}

/**
 * Get combined status of all limiters for admin dashboard.
 */
export function getAllRateLimitStatus() {
    return {
        limiters: [
            loginLimiter.getStatus(),
            qrLimiter.getStatus(),
            apiLimiter.getStatus()
        ]
    }
}
