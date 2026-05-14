import fs from 'fs/promises'
import path from 'path'
import type { TvheadendConfig } from '~/types/Tvheadend'

export async function getTvheadendConfig(username: string): Promise<TvheadendConfig | null> {
    const config = useRuntimeConfig()
    try {
        const usersFilePath = config.usersFilePath
        const usersData = await fs.readFile(usersFilePath, 'utf-8')
        const users: any[] = JSON.parse(usersData)
        const userData = users.find((u) => u.name === username)

        if (!userData || !userData.tvheadendHost) return null

        return {
            host: userData.tvheadendHost,
            port: userData.tvheadendPort || '9981',
            user: userData.tvheadendUser || '',
            pass: userData.tvheadendPassword || ''
        }
    } catch (error) {
        console.error('Error getting Tvheadend config:', error)
        return null
    }
}

export async function tvheadendRequest(config: TvheadendConfig, endpoint: string, query: Record<string, any> = {}) {
    const { host, port, user, pass } = config
    
    // Clean host
    const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '')
    
    // Construct URL without credentials (fetch API restriction)
    const url = new URL(`http://${cleanHost}:${port}${endpoint}`)
    Object.entries(query).forEach(([key, value]) => url.searchParams.append(key, value))

    // Use standard Basic Auth header
    const auth = Buffer.from(`${user}:${pass}`).toString('base64')

    console.log(`[Tvheadend] Requesting: ${url.toString()} (User: ${user})`)

    try {
        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        })

        if (!response.ok) {
            const errorStatus = response.status
            const errorText = await response.text().catch(() => '')
            console.error(`[Tvheadend] Error: ${errorStatus} ${response.statusText}`)
            
            if (errorStatus === 401) {
                 console.error(`[Tvheadend] 401 Unauthorized. Verify:`)
                 console.error(`1. Username/Password are correct in ClyoCloud settings.`)
                 console.error(`2. 'Plaintext (Basic) Authentication' is enabled in Tvheadend (Configuration -> General -> Base).`)
                 console.error(`3. User has 'Web Interface' and 'Streaming' permissions in Tvheadend.`)
            } else {
                 console.error(`[Tvheadend] Response Snippet: ${errorText.substring(0, 500)}`)
            }
            throw new Error(`Tvheadend request failed: ${response.statusText}`)
        }

        return response.json()
    } catch (err: any) {
        if (err.message.includes('fetch failed')) {
            console.error(`[Tvheadend] Connection failed. Is ${url.origin} reachable from this server?`)
        }
        throw err
    }
}

export async function getChannels(config: TvheadendConfig) {
    return tvheadendRequest(config, '/api/channel/grid', { limit: 1000 })
}

export async function getEpg(config: TvheadendConfig) {
    return tvheadendRequest(config, '/api/epg/events/grid', { limit: 1000 })
}
