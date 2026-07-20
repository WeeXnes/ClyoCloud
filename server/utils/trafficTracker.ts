/**
 * In-memory traffic metrics collector for the admin dashboard.
 * Tracks requests per minute, status codes, top endpoints, and top IPs.
 */

interface TrafficBucket {
    timestamp: number  // Start of the 1-minute bucket (floored to minute)
    count: number
    statusCodes: { [code: string]: number }
}

interface TrafficSnapshot {
    totalRequests: number
    totalRequestsToday: number
    uptimeMs: number
    timeSeries: { timestamp: number; count: number }[]
    statusCodeDistribution: { [code: string]: number }
    topEndpoints: { path: string; count: number }[]
    topIPs: { ip: string; count: number }[]
    recentRequests: { timestamp: number; method: string; path: string; statusCode: number; ip: string; userAgent?: string; isAuth?: boolean }[]
}

class TrafficTracker {
    private startTime = Date.now()
    private totalRequests = 0

    // Rolling 60 1-minute buckets
    private buckets: TrafficBucket[] = []
    private readonly maxBuckets = 60

    // Counters
    private statusCodes: Map<number, number> = new Map()
    private endpointCounts: Map<string, number> = new Map()
    private ipCounts: Map<string, number> = new Map()

    // Today's counter
    private todayDate: string = new Date().toISOString().slice(0, 10)
    private todayRequests = 0

    // Recent requests ring buffer (last 100)
    private recentRequests: { timestamp: number; method: string; path: string; statusCode: number; ip: string; userAgent?: string; isAuth?: boolean }[] = []
    private readonly maxRecent = 100

    // Cleanup interval
    private cleanupInterval: ReturnType<typeof setInterval>

    constructor() {
        // Clean old buckets every minute
        this.cleanupInterval = setInterval(() => this.cleanupBuckets(), 60 * 1000)
    }

    /**
     * Record a completed request.
     */
    record(method: string, path: string, statusCode: number, ip: string, userAgent?: string, isAuth?: boolean): void {
        const now = Date.now()
        this.totalRequests++

        // Reset today counter if date changed
        const today = new Date().toISOString().slice(0, 10)
        if (today !== this.todayDate) {
            this.todayDate = today
            this.todayRequests = 0
        }
        this.todayRequests++

        // Time series bucket
        const bucketTimestamp = Math.floor(now / 60000) * 60000 // Floor to minute
        let bucket = this.buckets.find(b => b.timestamp === bucketTimestamp)
        if (!bucket) {
            bucket = { timestamp: bucketTimestamp, count: 0, statusCodes: {} }
            this.buckets.push(bucket)
            this.cleanupBuckets()
        }
        bucket.count++
        const codeKey = String(statusCode)
        bucket.statusCodes[codeKey] = (bucket.statusCodes[codeKey] || 0) + 1

        // Global status code counter
        this.statusCodes.set(statusCode, (this.statusCodes.get(statusCode) || 0) + 1)

        // Endpoint counter (normalize to first 2 path segments for grouping)
        const normalizedPath = this.normalizePath(path)
        this.endpointCounts.set(normalizedPath, (this.endpointCounts.get(normalizedPath) || 0) + 1)

        // IP counter
        this.ipCounts.set(ip, (this.ipCounts.get(ip) || 0) + 1)

        // Recent requests
        this.recentRequests.push({ timestamp: now, method, path, statusCode, ip, userAgent, isAuth })
        if (this.recentRequests.length > this.maxRecent) {
            this.recentRequests.shift()
        }
    }

    /**
     * Get a snapshot of traffic metrics for the admin dashboard.
     */
    getSnapshot(): TrafficSnapshot {
        const now = Date.now()

        // Time series — fill gaps with zeros for smooth chart rendering
        const timeSeries: { timestamp: number; count: number }[] = []
        const cutoff = now - (this.maxBuckets * 60 * 1000)
        for (let t = Math.floor(cutoff / 60000) * 60000; t <= now; t += 60000) {
            const bucket = this.buckets.find(b => b.timestamp === t)
            timeSeries.push({ timestamp: t, count: bucket?.count || 0 })
        }

        // Status code distribution
        const statusCodeDistribution: { [code: string]: number } = {}
        for (const [code, count] of this.statusCodes) {
            statusCodeDistribution[String(code)] = count
        }

        // Top endpoints (sorted, top 20)
        const topEndpoints = [...this.endpointCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([path, count]) => ({ path, count }))

        // Top IPs (sorted, top 20)
        const topIPs = [...this.ipCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([ip, count]) => ({ ip, count }))

        return {
            totalRequests: this.totalRequests,
            totalRequestsToday: this.todayRequests,
            uptimeMs: now - this.startTime,
            timeSeries,
            statusCodeDistribution,
            topEndpoints,
            topIPs,
            recentRequests: [...this.recentRequests].reverse().slice(0, 50)
        }
    }

    private normalizePath(path: string): string {
        // Collapse dynamic segments for grouping: /files/user/photos → /files
        // Keep first two segments for API paths, first segment for others
        const segments = path.split('/').filter(Boolean)
        if (segments[0] === 'api') {
            return '/' + segments.slice(0, 2).join('/')
        }
        if (segments[0] === '_nuxt') {
            return '/_nuxt'
        }
        return '/' + (segments[0] || '')
    }

    private cleanupBuckets(): void {
        const cutoff = Date.now() - (this.maxBuckets * 60 * 1000)
        this.buckets = this.buckets.filter(b => b.timestamp > cutoff)
    }

    destroy(): void {
        clearInterval(this.cleanupInterval)
    }
}

// Singleton instance
export const trafficTracker = new TrafficTracker()
