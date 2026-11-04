import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import mime from 'mime-types'
import wallpaperV2Template from '../workflows/wallpaper_v2_2880x1800.json'
import { isPathWithin, isTrashPath, clearUserCache } from './fileUtils'
import { logActivity } from './activityLogger'
import { addToWallpapers } from './wallpapers'
import { updateFileInCache } from './tagCache'
import { checkDiskHeadroom, checkUserQuota } from './storageQuota'

export type ScenePreset = 'outdoor' | 'indoor' | 'studio'

export interface PipelineJob {
    id: string
    username: string
    filePath: string
    status: 'starting' | 'uploading' | 'queued' | 'processing' | 'saving' | 'completed' | 'failed'
    progress: number // 0 to 100
    message: string
    promptId?: string
    outputPath?: string
    outputName?: string
    modelName?: string
    scenePreset?: ScenePreset
    error?: string
    startTime: number
    updatedTime: number
}

export interface WallpaperV2Options {
    modelName?: string
    scenePreset?: string
    promptOverride?: string
    negativeOverride?: string
}

export const DEFAULT_COMFYUI_URL = 'http://localhost:8188'
export const SUPPORTED_UPSCALE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp']
export const MAX_PROMPT_LENGTH = 4000

const MAX_URL_LENGTH = 512
const MAX_OUTPUT_BYTES = 200 * 1024 * 1024
const JOB_TIMEOUT_MS = 10 * 60 * 1000
const JOB_RETENTION_MS = 60 * 60 * 1000
const MODEL_NAME_PATTERN = /^[\w][\w .+()-]{0,190}\.(pth|pt|safetensors|bin)$/i

export const DEFAULT_UPSCALE_MODELS = [
    { id: '4x-UltraSharp.pth', name: '4x-UltraSharp (Recommended)', scale: 4 },
    { id: 'RealESRGAN_x2plus.pth', name: 'RealESRGAN 2x (Fast)', scale: 2 },
    { id: '4x_foolhardy_Remacri.pth', name: '4x-Remacri (Smooth)', scale: 4 }
]

export const SCENE_PRESETS: Record<ScenePreset, { id: ScenePreset; name: string; label: string; description: string; positive: string; negative: string }> = {
    indoor: {
        id: 'indoor',
        name: 'Indoor (Room / Bed / Interior)',
        label: 'Indoor',
        description: 'Natural room walls, bedding, and ambient interior lighting with matching surface textures (no curtains or clutter)',
        positive: 'high quality 35mm photograph, master photography, seamless background continuation, extending the room background naturally, soft ambient room lighting, realistic interior depth of field, authentic room textures, subtle background bokeh, natural room atmosphere, matching lighting and textures, authentic photograph, photorealistic, sharp focus, 8k uhd, dslr',
        negative: 'curtains, drapes, drapery, window blinds, gold, ornate, baroque, luxury suite, chandelier, lamps, furniture clutter, dividing walls, partitions, pillars, doors, frames, unnatural perspective, warped perspective, outdoor, nature, sky, trees, garden, sunlight, grass, person, woman, girl, duplicate person, cloned subject, extra limbs, extra bodies, seam, border, edge, line, harsh edges, dividing line, vertical line, split screen, smooth flat wall, plastic, drawing, cartoon, 3d render, watermark, text'
    },
    outdoor: {
        id: 'outdoor',
        name: 'Outdoor (Nature / Landscape / Scenery)',
        label: 'Outdoor',
        description: 'Natural scenery extension with matching daylight and landscape atmosphere (prevents unnatural paths and roads)',
        positive: 'high quality 35mm photograph, master photography, seamless background continuation, extending the natural scenery background, soft natural bokeh, matching natural daylight and atmosphere, realistic camera perspective, authentic photograph, photorealistic, sharp focus, 8k uhd, dslr',
        negative: 'paths, pathway, road, footpath, walkway, sidewalk, trail, track, stairs, steps, street, highway, perspective lines, vanishing lines, forced perspective, distorted perspective, warped horizon, tilted angle, fences, railings, lampposts, poles, signs, buildings, indoor, room, walls, furniture, curtains, person, woman, girl, duplicate person, cloned subject, extra limbs, extra bodies, seam, border, edge, line, harsh edges, dividing line, vertical line, split screen, drawing, cartoon, 3d render, watermark, text'
    },
    studio: {
        id: 'studio',
        name: 'Studio (Neutral / Minimalist Backdrop)',
        label: 'Studio',
        description: 'Clean seamless studio backdrop continuation with smooth gradient falloff and neutral ambient lighting',
        positive: 'high quality 35mm photograph, master photography, seamless background continuation, smooth clean backdrop continuation, soft studio ambient lighting, subtle gradient falloff, clean portrait studio background, authentic photograph, photorealistic, sharp focus, 8k uhd, dslr',
        negative: 'curtains, drapes, furniture, objects, clutter, windows, doors, outdoor, nature, trees, sky, paths, roads, person, woman, girl, duplicate person, cloned subject, extra limbs, extra bodies, seam, border, edge, line, harsh edges, dividing line, vertical line, split screen, drawing, cartoon, 3d render, watermark, text'
    }
}

export function isScenePreset(value: unknown): value is ScenePreset {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SCENE_PRESETS, value)
}

export function isValidUpscaleModelName(value: unknown): value is string {
    return typeof value === 'string' && MODEL_NAME_PATTERN.test(value) && !value.includes('..')
}

/**
 * Validates and normalises a ComfyUI endpoint.
 * Only plain http(s) URLs without embedded credentials, query or fragment are accepted.
 * Returns null when the value is not acceptable.
 */
export function normalizeComfyUiUrl(raw: unknown): string | null {
    if (typeof raw !== 'string') return null
    const trimmed = raw.trim()
    if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null

    let parsed: URL
    try {
        parsed = new URL(trimmed)
    } catch {
        return null
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (parsed.username || parsed.password) return null
    if (parsed.search || parsed.hash) return null

    // Keep a path prefix so ComfyUI behind a reverse proxy sub-path still works
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
        // Never follow redirects: the endpoint is user-configured and must not bounce the server elsewhere
        return await fetch(url, { ...init, redirect: 'manual', signal: controller.signal })
    } finally {
        clearTimeout(timeout)
    }
}

function truncate(text: string, max = 300): string {
    return text.length > max ? `${text.slice(0, max)}…` : text
}

// In-memory job registry
const activeJobs = new Map<string, PipelineJob>()

const cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - JOB_RETENTION_MS
    for (const [id, job] of activeJobs.entries()) {
        if (job.updatedTime < cutoff) {
            activeJobs.delete(id)
        }
    }
}, 5 * 60 * 1000)
cleanupTimer.unref?.()

function isJobActive(job: PipelineJob) {
    return job.status !== 'completed' && job.status !== 'failed'
}

function updateJob(job: PipelineJob, patch: Partial<PipelineJob>) {
    Object.assign(job, patch, { updatedTime: Date.now() })
}

/**
 * Resolves the ComfyUI endpoint for a user: user setting, then COMFYUI_URL, then the local default.
 */
export async function getComfyUiUrl(username?: string): Promise<string> {
    try {
        const config = typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : null

        if (username && config?.usersFilePath) {
            try {
                const usersData = await fs.readFile(config.usersFilePath, 'utf-8')
                const users: any[] = JSON.parse(usersData)
                const user = users.find((u) => u.name === username)
                const fromUser = normalizeComfyUiUrl(user?.comfyuiUrl)
                if (fromUser) return fromUser
            } catch {}
        }
    } catch {}

    return normalizeComfyUiUrl(process.env.COMFYUI_URL) || DEFAULT_COMFYUI_URL
}

/**
 * Lists the upscale models installed in ComfyUI (via /object_info), falling back to the known defaults.
 */
export async function getComfyUiModels(url?: string): Promise<{ id: string; name: string; scale: number }[]> {
    const cleanUrl = normalizeComfyUiUrl(url) || await getComfyUiUrl()
    try {
        const res = await fetchWithTimeout(`${cleanUrl}/object_info/UpscaleModelLoader`, {}, 4000)
        if (res.ok) {
            const data: any = await res.json()
            const field = data?.UpscaleModelLoader?.input?.required?.model_name
            // Newer ComfyUI: [ 'COMBO', { options: [...] } ], older: [ [...] ]
            const rawOptions: unknown = field?.[1]?.options || (Array.isArray(field?.[0]) ? field[0] : [])
            const options = Array.isArray(rawOptions) ? rawOptions.filter(isValidUpscaleModelName) : []
            if (options.length > 0) {
                return options.map((opt) => {
                    const lower = opt.toLowerCase()
                    const scale = lower.includes('2x') || lower.includes('x2') ? 2 : 4
                    let label = opt.replace(/\.(pth|safetensors|pt|bin)$/i, '')
                    if (opt.includes('UltraSharp')) label = '4x-UltraSharp (Recommended)'
                    else if (opt.includes('x2plus')) label = 'RealESRGAN 2x (Fast)'
                    else if (opt.includes('Remacri')) label = '4x-Remacri (Smooth)'
                    return { id: opt, name: label, scale }
                })
            }
        }
    } catch {}

    return DEFAULT_UPSCALE_MODELS
}

/**
 * Checks that a ComfyUI server is reachable and reports its version and devices.
 */
export async function testComfyUiConnection(url: string): Promise<{
    ok: boolean
    version?: string
    devices?: string[]
    availableModels?: string[]
    error?: string
}> {
    const cleanUrl = normalizeComfyUiUrl(url)
    if (!cleanUrl) {
        return { ok: false, error: 'Invalid ComfyUI URL. Use http(s)://host:port without credentials.' }
    }

    try {
        const res = await fetchWithTimeout(`${cleanUrl}/system_stats`, {}, 6000)
        if (!res.ok) {
            return { ok: false, error: `Server responded with HTTP ${res.status}` }
        }

        let data: any
        try {
            data = await res.json()
        } catch {
            return { ok: false, error: 'The server answered, but it is not a ComfyUI API' }
        }
        if (!data || typeof data !== 'object' || !data.system) {
            return { ok: false, error: 'The server answered, but it is not a ComfyUI API' }
        }

        const version = typeof data.system.comfyui_version === 'string' ? data.system.comfyui_version : 'Unknown'
        const devices = (Array.isArray(data.devices) ? data.devices : [])
            .map((d: any) => (typeof d?.name === 'string' ? truncate(d.name, 120) : 'Unknown Device'))
        const models = await getComfyUiModels(cleanUrl)

        return {
            ok: true,
            version,
            devices,
            availableModels: models.map((m) => m.id)
        }
    } catch (err: any) {
        return {
            ok: false,
            error: err?.name === 'AbortError' ? 'Connection timed out (no response in 6s)' : 'Could not reach ComfyUI'
        }
    }
}

/**
 * Uploads an image to ComfyUI's input folder and returns the stored name.
 */
export async function uploadImageToComfy(comfyUrl: string, imageBuffer: Buffer, filename: string): Promise<string> {
    const contentType = mime.lookup(filename) || 'image/jpeg'
    const formData = new FormData()
    formData.append('image', new Blob([new Uint8Array(imageBuffer)], { type: contentType }), filename)
    formData.append('overwrite', 'true')

    const res = await fetchWithTimeout(`${comfyUrl}/upload/image`, { method: 'POST', body: formData }, 60000)
    if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Failed to upload image to ComfyUI: HTTP ${res.status} ${truncate(text)}`)
    }

    const data: any = await res.json()
    return typeof data?.name === 'string' ? data.name : filename
}

/**
 * Returns a fresh copy of the Wallpaper V2 (2880x1800) ComfyUI API workflow.
 */
export async function loadWallpaperV2Template(): Promise<Record<string, any>> {
    return structuredClone(wallpaperV2Template) as Record<string, any>
}

/**
 * Validates the request and starts a Wallpaper V2 job in the background.
 */
export async function startWallpaperV2Job(
    username: string,
    relativeFilePath: string,
    options?: WallpaperV2Options
): Promise<PipelineJob> {
    const config = useRuntimeConfig()
    const userStoragePath = path.resolve(config.storagePath, username)
    const fullPath = path.resolve(userStoragePath, relativeFilePath)

    if (!isPathWithin(userStoragePath, fullPath) || isTrashPath(userStoragePath, fullPath)) {
        throw new Error('Access denied: Path is outside user storage')
    }

    let stats
    try {
        stats = await fs.stat(fullPath)
    } catch {
        throw new Error('Source image file not found')
    }
    if (!stats.isFile()) {
        throw new Error('Source image file not found')
    }

    const ext = path.extname(fullPath).toLowerCase()
    if (!SUPPORTED_UPSCALE_EXTENSIONS.includes(ext)) {
        throw new Error(`Unsupported image format: ${ext || 'none'}. Please select JPG, PNG, or WebP.`)
    }

    const modelName = options?.modelName === undefined || options.modelName === '' ? '4x-UltraSharp.pth' : options.modelName
    if (!isValidUpscaleModelName(modelName)) {
        throw new Error('Invalid upscale model name')
    }

    const scenePreset: ScenePreset = options?.scenePreset === undefined ? 'indoor' : (options.scenePreset as ScenePreset)
    if (!isScenePreset(scenePreset)) {
        throw new Error('Invalid scene preset')
    }

    for (const text of [options?.promptOverride, options?.negativeOverride]) {
        if (text !== undefined && text !== null && (typeof text !== 'string' || text.length > MAX_PROMPT_LENGTH)) {
            throw new Error(`Prompts must be text of at most ${MAX_PROMPT_LENGTH} characters`)
        }
    }

    // One job per user at a time keeps the GPU queue fair and avoids concurrent writes
    for (const existing of activeJobs.values()) {
        if (existing.username === username && isJobActive(existing)) {
            throw new Error('A wallpaper job is already running. Wait for it to finish first.')
        }
    }

    const jobId = `wv2_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const job: PipelineJob = {
        id: jobId,
        username,
        filePath: path.relative(userStoragePath, fullPath).replace(/\\/g, '/'),
        status: 'starting',
        progress: 5,
        modelName,
        scenePreset,
        message: `Initializing Wallpaper V2 (${SCENE_PRESETS[scenePreset].label}, ${modelName.replace(/\.(pth|safetensors|pt|bin)$/i, '')})...`,
        startTime: Date.now(),
        updatedTime: Date.now()
    }

    activeJobs.set(jobId, job)

    runJobAsync(job, fullPath, {
        modelName,
        scenePreset,
        promptOverride: options?.promptOverride || undefined,
        negativeOverride: options?.negativeOverride || undefined
    }).catch((err) => {
        console.error(`[ComfyUI Pipeline] Job ${jobId} failed:`, err)
        const error = err?.message || 'Unknown error occurred'
        updateJob(job, { status: 'failed', error, message: `Failed: ${error}` })
    })

    return job
}

function extractExecutionError(item: any): string {
    const messages: any[] = Array.isArray(item?.status?.messages) ? item.status.messages : []
    const execError = messages.find((m) => Array.isArray(m) && m[0] === 'execution_error')?.[1]
    if (execError) {
        const node = execError.node_type ? `${execError.node_type}: ` : ''
        return truncate(`${node}${execError.exception_message || 'execution error'}`)
    }
    return 'ComfyUI execution error'
}

async function runJobAsync(
    job: PipelineJob,
    fullPath: string,
    options: { modelName: string; scenePreset: ScenePreset; promptOverride?: string; negativeOverride?: string }
) {
    const config = useRuntimeConfig()
    const comfyUrl = await getComfyUiUrl(job.username)
    const preset = SCENE_PRESETS[options.scenePreset]

    // 1. Connection check
    updateJob(job, { status: 'uploading', progress: 10, message: 'Connecting to ComfyUI...' })
    const connTest = await testComfyUiConnection(comfyUrl)
    if (!connTest.ok) {
        throw new Error(`Cannot connect to ComfyUI at ${comfyUrl}. ${connTest.error}`)
    }

    // 2. Upload the source image
    updateJob(job, { progress: 20, message: 'Uploading source image to ComfyUI...' })
    const fileBuffer = await fs.readFile(fullPath)
    const baseName = path.basename(fullPath)
    const safeBaseName = baseName.replace(/[^\w.-]+/g, '_').slice(-120)
    const uploadedName = await uploadImageToComfy(comfyUrl, fileBuffer, `${job.id}_${safeBaseName}`)

    // 3. Configure the workflow
    updateJob(job, { progress: 30, message: 'Configuring Wallpaper V2 workflow...' })
    const workflow = await loadWallpaperV2Template()

    // Node 258: LoadImage
    if (workflow['258']?.inputs) workflow['258'].inputs.image = uploadedName
    // Node 264: KSampler seed
    if (workflow['264']?.inputs) workflow['264'].inputs.seed = crypto.randomInt(0, 2 ** 48 - 1)
    // Node 277: UpscaleModelLoader
    if (workflow['277']?.inputs) workflow['277'].inputs.model_name = options.modelName
    // Nodes 271 / 272: positive and negative prompts
    const posText = options.promptOverride?.trim() || preset.positive
    const negText = options.negativeOverride?.trim() || preset.negative
    if (workflow['271']?.inputs) workflow['271'].inputs.text = posText
    if (workflow['272']?.inputs) workflow['272'].inputs.text = negText

    // 4. Queue the prompt
    updateJob(job, { status: 'queued', progress: 35, message: 'Submitting workflow to ComfyUI execution queue...' })
    const promptRes = await fetchWithTimeout(`${comfyUrl}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workflow, client_id: `clyo_${job.id}` })
    }, 30000)

    if (!promptRes.ok) {
        const text = await promptRes.text().catch(() => '')
        throw new Error(`ComfyUI rejected the workflow (check that all models and custom nodes are installed): ${truncate(text)}`)
    }

    const promptData: any = await promptRes.json()
    const promptId = typeof promptData?.prompt_id === 'string' ? promptData.prompt_id : null
    if (!promptId) {
        throw new Error('ComfyUI did not return a prompt ID')
    }

    const friendlyModelName = options.modelName.replace(/\.(pth|safetensors|pt|bin)$/i, '')
    updateJob(job, {
        promptId,
        status: 'processing',
        progress: 45,
        message: `Generating 2880x1800 wallpaper (${preset.label}, ${friendlyModelName})...`
    })

    // 5. Poll the history until the SaveImage output appears
    const startTime = Date.now()
    let resultImageInfo: { filename: string; subfolder?: string; type?: string } | null = null

    while (Date.now() - startTime < JOB_TIMEOUT_MS) {
        await new Promise((resolve) => setTimeout(resolve, 2000))

        let item: any = null
        try {
            const histRes = await fetchWithTimeout(`${comfyUrl}/history/${encodeURIComponent(promptId)}`, {}, 10000)
            if (histRes.ok) {
                const histData: any = await histRes.json()
                item = histData?.[promptId] || null
            }
        } catch {
            // Transient network hiccup: keep polling until the timeout
        }

        if (item) {
            if (item.status?.status_str === 'error') {
                throw new Error(`ComfyUI pipeline error: ${extractExecutionError(item)}`)
            }

            const outputs = item.outputs || {}
            // Node 275 is the SaveImage node; fall back to any node with images
            let foundImages: any[] = outputs['275']?.images || []
            if (foundImages.length === 0) {
                for (const nodeKey of Object.keys(outputs)) {
                    const images = outputs[nodeKey]?.images
                    if (Array.isArray(images) && images.some((img: any) => img?.type === 'output')) {
                        foundImages = images.filter((img: any) => img?.type === 'output')
                        break
                    }
                }
            }

            if (foundImages.length > 0 && typeof foundImages[0]?.filename === 'string') {
                resultImageInfo = foundImages[0]
                break
            }
        }

        if (job.progress < 90) {
            updateJob(job, { progress: job.progress + 3 })
        }
    }

    if (!resultImageInfo) {
        throw new Error('Timed out waiting for ComfyUI to produce the wallpaper')
    }

    // 6. Download the result and store it next to the source image
    updateJob(job, { status: 'saving', progress: 92, message: 'Saving the 2880x1800 wallpaper to your cloud...' })

    const viewParams = new URLSearchParams({
        filename: resultImageInfo.filename,
        subfolder: resultImageInfo.subfolder || '',
        type: resultImageInfo.type || 'output'
    })
    const imgRes = await fetchWithTimeout(`${comfyUrl}/view?${viewParams.toString()}`, {}, 120000)
    if (!imgRes.ok) {
        throw new Error(`Failed to download output image from ComfyUI: HTTP ${imgRes.status}`)
    }
    const declaredLength = Number(imgRes.headers.get('content-length') || 0)
    if (declaredLength > MAX_OUTPUT_BYTES) {
        throw new Error('ComfyUI output is unexpectedly large')
    }
    const outputBuffer = Buffer.from(await imgRes.arrayBuffer())
    if (outputBuffer.length === 0 || outputBuffer.length > MAX_OUTPUT_BYTES) {
        throw new Error('ComfyUI returned an empty or oversized image')
    }

    const userStoragePath = path.resolve(config.storagePath, job.username)
    const targetDir = path.dirname(fullPath)

    const headroom = await checkDiskHeadroom(userStoragePath, outputBuffer.length)
    if (!headroom.hasSpace) {
        throw new Error('Host storage volume is nearly full')
    }
    const quota = await checkUserQuota(job.username, outputBuffer.length)
    if (!quota.allowed) {
        throw new Error(quota.error || 'User storage quota exceeded')
    }

    const nameWithoutExt = path.basename(baseName, path.extname(baseName))
    let candidateName = ''
    let candidatePath = ''
    for (let counter = 0; counter < 1000; counter++) {
        candidateName = counter === 0 ? `${nameWithoutExt}_2880x1800.png` : `${nameWithoutExt}_2880x1800_${counter}.png`
        candidatePath = path.join(targetDir, candidateName)
        try {
            // 'wx' fails if the file exists, so a concurrent writer can never be overwritten
            await fs.writeFile(candidatePath, outputBuffer, { flag: 'wx' })
            break
        } catch (err: any) {
            if (err?.code !== 'EEXIST') throw err
            candidatePath = ''
        }
    }
    if (!candidatePath) {
        throw new Error('Could not find a free output file name')
    }

    // .cloudinfo: tag as Wallpaper, resolution, scene and model
    const modelTag = options.modelName.includes('RealESRGAN') ? 'RealESRGAN-2x' : options.modelName.includes('Remacri') ? 'Remacri-4x' : options.modelName.includes('UltraSharp') ? '4x-UltraSharp' : friendlyModelName
    const sceneTag = preset.label
    const sceneColor = sceneTag === 'Indoor' ? '#F59E0B' : (sceneTag === 'Outdoor' ? '#10B981' : '#EC4899')

    const meta = {
        description: `Generated via ComfyUI Wallpaper V2 pipeline (2880x1800, ${sceneTag}, ${modelTag}) from ${baseName}`,
        isWallpaper: true,
        isPhotoWidget: true,
        tags: [
            { name: 'Wallpaper', color: '#8B5CF6' },
            { name: '2880x1800', color: '#3B82F6' },
            { name: sceneTag, color: sceneColor },
            { name: modelTag, color: '#6366F1' }
        ]
    }
    await fs.writeFile(`${candidatePath}.cloudinfo`, JSON.stringify(meta, null, 2), 'utf-8')

    const relativeOutputPath = path.relative(userStoragePath, candidatePath).replace(/\\/g, '/')

    // Make it show up in the Wallpapers tab, companion apps and collections right away
    await addToWallpapers(job.username, relativeOutputPath, false)
    await updateFileInCache(job.username, relativeOutputPath, meta)
    clearUserCache(job.username)

    await logActivity(
        job.username,
        'WALLPAPER_V2_UPSCALE',
        relativeOutputPath,
        `Generated 2880x1800 wallpaper (${sceneTag}, ${modelTag}) from ${job.filePath} via ComfyUI`
    )

    updateJob(job, {
        status: 'completed',
        progress: 100,
        outputPath: relativeOutputPath,
        outputName: candidateName,
        message: `Successfully generated wallpaper: ${candidateName}`
    })
}

/**
 * Returns an active or recently finished job.
 */
export function getPipelineJob(jobId: string): PipelineJob | null {
    return activeJobs.get(jobId) || null
}
