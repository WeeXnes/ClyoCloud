import { defineEventHandler, getRouterParam, createError, sendProxy, getQuery, setHeader } from 'h3'
import { getTvheadendConfig } from '~/server/utils/tvheadend'

export default defineEventHandler(async (event) => {
    const user = event.context.user
    if (!user || !user.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const path = getRouterParam(event, 'path')
    if (!path) throw createError({ statusCode: 400, statusMessage: 'Path required' })

    const config = await getTvheadendConfig(user.name)
    if (!config) throw createError({ statusCode: 400, statusMessage: 'Tvheadend not configured' })

    const query = getQuery(event)
    const { host, port, user: tvUser, pass: tvPass } = config
    
    const targetUrl = new URL(`http://${host}:${port}/stream/${path}`)
    Object.entries(query).forEach(([k, v]) => targetUrl.searchParams.append(k, String(v)))

    const auth = Buffer.from(`${tvUser}:${tvPass}`).toString('base64')

    // Determine if this is an HLS playlist
    const isPlaylist = path.endsWith('.m3u8') || query.profile === 'hls'

    if (isPlaylist) {
        try {
            const response = await fetch(targetUrl.toString(), {
                headers: { 'Authorization': `Basic ${auth}` }
            })

            if (!response.ok) throw new Error(`Tvheadend failed: ${response.statusText}`)

            let content = await response.text()
            content = content.replace(/(\/stream\/)/g, '/tv/stream/')
            const lines = content.split('\n').map(line => {
                const t = line.trim()
                if (t && !t.startsWith('#') && !t.startsWith('http') && !t.startsWith('/tv/stream/')) {
                    const lastSlash = path.lastIndexOf('/')
                    const base = lastSlash !== -1 ? path.substring(0, lastSlash + 1) : ''
                    return `/tv/stream/${base}${t}`
                }
                return line
            })
            setHeader(event, 'Content-Type', 'application/vnd.apple.mpegurl')
            setHeader(event, 'Access-Control-Allow-Origin', '*')
            return lines.join('\n')
        } catch (err: any) {
            console.error('[Tvheadend Proxy] Playlist rewrite failed:', err.message)
            throw createError({ statusCode: 500, statusMessage: `Stream proxy error` })
        }
    }

    const controller = new AbortController()
    event.node.res.on('close', () => {
        controller.abort()
        console.log(`[Tvheadend Proxy] Client disconnected, closing stream for ${path}`)
    })

    // Direct Video Stream (Matroska, WebM, etc.)
    const proxyResponse = await sendProxy(event, targetUrl.toString(), {
        sendStream: true,
        fetchOptions: {
            headers: {
                'Authorization': `Basic ${auth}`
            },
            signal: controller.signal
        },
        onResponse(e, response) {
            setHeader(e, 'Access-Control-Allow-Origin', '*')
            
            const originalType = response.headers.get('Content-Type')
            const p = query.profile?.toString() || ''
            
            if (p.includes('matroska')) {
                setHeader(e, 'Content-Type', 'video/x-matroska')
            } else if (p.includes('webm')) {
                setHeader(e, 'Content-Type', 'video/webm')
            } else if (p === 'pass') {
                setHeader(e, 'Content-Type', 'video/mp2t')
            } else if (originalType) {
                setHeader(e, 'Content-Type', originalType)
            } else {
                setHeader(e, 'Content-Type', 'video/x-matroska')
            }
        }
    })

    return proxyResponse
})
