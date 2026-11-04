import { defineEventHandler, readBody, createError } from 'h3'
import { testComfyUiConnection, getComfyUiUrl, normalizeComfyUiUrl } from '../../utils/comfyui'

export default defineEventHandler(async (event) => {
    const user = event.context.user
    if (!user || !user.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const body = await readBody(event).catch(() => ({}))
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : ''

    let targetUrl: string
    if (rawUrl) {
        const normalized = normalizeComfyUiUrl(rawUrl)
        if (!normalized) {
            return { ok: false, error: 'Invalid ComfyUI URL. Use http(s)://host:port without credentials.', url: rawUrl }
        }
        targetUrl = normalized
    } else {
        targetUrl = await getComfyUiUrl(user.name)
    }

    const result = await testComfyUiConnection(targetUrl)
    return { ...result, url: targetUrl }
})
