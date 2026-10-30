import { BlockList, isIP } from 'net'
import { getRequestHeader, getRequestIP, type H3Event } from 'h3'
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
        // Bypass rate limiting only for internal Nitro SSR calls, which have no socket peer
        if (ip === 'unknown') {
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
     * Reset the limiter for a specific key.
     */
    reset(ip: string): void {
        this.entries.delete(ip)
    }

    /**
     * Stop counting the most recent attempt (it succeeded) while keeping earlier failures.
     */
    forgive(ip: string): void {
        this.entries.get(ip)?.timestamps.pop()
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

/** Per-account login and 2FA attempts from any IP: 10 attempts per 15 minutes, block for 15 minutes */
export const accountLimiter = new RateLimiter({
    name: 'Account',
    windowMs: 15 * 60 * 1000,      // 15 minutes
    maxAttempts: 10,
    blockDurationMs: 15 * 60 * 1000 // 15 minutes
})

/** General API: 1000 requests per minute, block for 1 minute */
export const apiLimiter = new RateLimiter({
    name: 'API',
    windowMs: 60 * 1000,           // 1 minute
    maxAttempts: 1000,
    blockDurationMs: 60 * 1000     // 1 minute
})

let trustedProxies: BlockList | null = null

/**
 * Proxies allowed to set X-Forwarded-For: loopback, plus the comma-separated
 * IPs and CIDR ranges in TRUSTED_PROXIES (e.g. "10.0.0.5,172.16.0.0/12").
 */
function getTrustedProxies(): BlockList {
    if (trustedProxies) return trustedProxies

    const list = new BlockList()
    list.addSubnet('127.0.0.0', 8, 'ipv4')
    list.addAddress('::1', 'ipv6')

    for (const entry of (process.env.TRUSTED_PROXIES || '').split(',').map(e => e.trim()).filter(Boolean)) {
        const [address, prefix] = entry.split('/')
        const version = isIP(address)
        if (!version) {
            consola.warn(`[RateLimit] Ignoring invalid TRUSTED_PROXIES entry: ${entry}`)
            continue
        }
        const type = version === 4 ? 'ipv4' : 'ipv6'
        if (prefix !== undefined) {
            list.addSubnet(address, Number(prefix), type)
        } else {
            list.addAddress(address, type)
        }
    }

    trustedProxies = list
    return list
}

function normalizeIP(ip: string): string {
    return ip.trim().replace(/^::ffff:/i, '')
}

function isTrustedProxy(ip: string): boolean {
    const version = isIP(ip)
    return version !== 0 && getTrustedProxies().check(ip, version === 4 ? 'ipv4' : 'ipv6')
}

/**
 * Resolves the real client from the socket peer and X-Forwarded-For.
 * The header is ignored unless the peer is a trusted proxy. It is then read right to left,
 * because only the entries appended by trusted proxies are reliable; anything further left
 * can be supplied by the client.
 */
export function resolveClientIP(peer: string | undefined, forwardedFor: string | undefined): string {
    if (!peer) return 'unknown'

    let client = normalizeIP(peer)
    if (!isTrustedProxy(client) || !forwardedFor) return client

    for (const hop of forwardedFor.split(',').reverse().map(normalizeIP)) {
        if (!isIP(hop)) break
        client = hop
        if (!isTrustedProxy(hop)) break
    }
    return client
}

/**
 * Helper to extract client IP from an H3 event.
 */
export function getClientIP(event: H3Event): string {
    return resolveClientIP(getRequestIP(event), getRequestHeader(event, 'x-forwarded-for'))
}

/**
 * Get combined status of all limiters for admin dashboard.
 */
export function getAllRateLimitStatus() {
    return {
        limiters: [
            loginLimiter.getStatus(),
            accountLimiter.getStatus(),
            apiLimiter.getStatus()
        ]
    }
}
