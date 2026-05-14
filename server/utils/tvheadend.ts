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

export async function tvheadendRequest(config: TvheadendConfig, endpoint: string, query: Record<string, any> = {}, method = 'GET', body: any = null, isForm = false) {
    const { host, port, user, pass } = config
    
    // Clean host
    const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '')
    
    // Construct URL
    const url = new URL(`http://${cleanHost}:${port}${endpoint}`)
    Object.entries(query).forEach(([key, value]) => url.searchParams.append(key, value))

    // Use standard Basic Auth header
    const auth = Buffer.from(`${user}:${pass}`).toString('base64')

    try {
        const fetchOptions: any = {
            method,
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json'
            }
        }

        if (body) {
            if (isForm) {
                const formData = new URLSearchParams()
                Object.entries(body).forEach(([k, v]) => formData.append(k, String(v)))
                fetchOptions.body = formData.toString()
                fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded'
            } else {
                fetchOptions.body = JSON.stringify(body)
                fetchOptions.headers['Content-Type'] = 'application/json'
            }
        }

        const response = await fetch(url.toString(), fetchOptions)

        if (!response.ok) {
            const errorStatus = response.status
            const errorText = await response.text().catch(() => '')
            console.error(`[Tvheadend] ${method} ${endpoint} Error: ${errorStatus} ${response.statusText}`)
            console.error(`[Tvheadend] Response Body: ${errorText.substring(0, 500)}`)
            throw new Error(`Tvheadend request failed: ${response.statusText}`)
        }

        return response.json()
    } catch (err: any) {
        if (err.message.includes('fetch failed')) {
            console.error(`[Tvheadend] Connection failed. Is ${url.origin} reachable?`)
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

export async function getRecordings(config: TvheadendConfig) {
    return tvheadendRequest(config, '/api/dvr/entry/grid', { limit: 1000 })
}

export async function getDvrConfigs(config: TvheadendConfig) {
    return tvheadendRequest(config, '/api/dvr/config/grid', { limit: 100 })
}

export async function createRecording(config: TvheadendConfig, eventId: string) {
    // Try sending event_id as form data, which is highly compatible
    return tvheadendRequest(config, '/api/dvr/entry/create_by_event', {}, 'POST', { event_id: eventId }, true)
}

export async function cancelRecording(config: TvheadendConfig, entryId: string) {
    return tvheadendRequest(config, '/api/dvr/entry/cancel', {}, 'POST', { uuid: entryId }, true)
}

export async function removeRecording(config: TvheadendConfig, entryId: string) {
    return tvheadendRequest(config, '/api/dvr/entry/remove', {}, 'POST', { uuid: entryId }, true)
}
