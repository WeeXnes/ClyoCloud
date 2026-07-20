import { ofetch } from 'ofetch'

export interface GeoData {
    lat: number
    lon: number
    country: string
    countryCode: string
    city: string
}

const geoCache = new Map<string, GeoData>()

export async function geolocateIP(ip: string): Promise<GeoData | null> {
    const cleanIp = ip.replace(/^::ffff:/, '')

    // Local / Intranet IPs
    if (
        cleanIp === 'unknown' || 
        cleanIp === '127.0.0.1' || 
        cleanIp === '::1' || 
        cleanIp.startsWith('192.168.') || 
        cleanIp.startsWith('10.') || 
        cleanIp.startsWith('172.16.') || 
        cleanIp.startsWith('172.17.') ||
        cleanIp.startsWith('172.18.') ||
        cleanIp.startsWith('172.19.') ||
        cleanIp.startsWith('172.2') ||
        cleanIp.startsWith('172.3')
    ) {
        return {
            lat: 52.52, // Default to center of Europe / Berlin for mock
            lon: 13.40,
            country: 'Local Network',
            countryCode: 'LCL',
            city: 'Intranet'
        }
    }

    if (geoCache.has(cleanIp)) {
        return geoCache.get(cleanIp)!
    }

    try {
        // Fetch from free ip-api.com (limited to 45 req/min, which is plenty with cache)
        const res = await ofetch<any>(`http://ip-api.com/json/${cleanIp}`, { timeout: 3000 })
        if (res && res.status === 'success') {
            const data: GeoData = {
                lat: res.lat,
                lon: res.lon,
                country: res.country,
                countryCode: res.countryCode,
                city: res.city
            }
            geoCache.set(cleanIp, data)
            return data
        }
    } catch (err) {
        console.error(`Failed to geolocate IP ${cleanIp}:`, err)
    }

    // Fallback default
    return {
        lat: 0,
        lon: 0,
        country: 'Unknown Location',
        countryCode: 'UNK',
        city: 'Unknown'
    }
}
