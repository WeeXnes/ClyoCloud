import { describe, it, expect } from 'vitest'
import {
    loadWallpaperV2Template,
    getComfyUiUrl,
    normalizeComfyUiUrl,
    isValidUpscaleModelName,
    isScenePreset,
    DEFAULT_UPSCALE_MODELS,
    SCENE_PRESETS
} from '../server/utils/comfyui'

describe('ComfyUI Wallpaper V2 Pipeline', () => {
    it('loads the Wallpaper V2 workflow template with correct node topology', async () => {
        const template = await loadWallpaperV2Template()
        expect(template).toBeDefined()
        expect(typeof template).toBe('object')

        // Node 258: LoadImage input node
        expect(template['258'].class_type).toBe('LoadImage')

        // Node 257: SeamlessPadForOutpaint with mean fill and smooth feathering
        expect(template['257'].class_type).toBe('SeamlessPadForOutpaint')
        expect(template['257'].inputs.fill_mode).toBe('mean')
        expect(template['257'].inputs.feathering).toBe(64)

        // Node 264: KSampler with the stochastic SDE sampler
        expect(template['264'].class_type).toBe('KSampler')
        expect(template['264'].inputs.steps).toBe(30)
        expect(template['264'].inputs.sampler_name).toBe('dpmpp_2m_sde')

        // Node 268 / 289: SD 1.5 inpainting checkpoint and VAE
        expect(template['268'].inputs.ckpt_name).toBe('Realistic_Vision_V5.1-inpainting.safetensors')
        expect(template['289'].inputs.vae_name).toBe('vae-ft-mse-840000-ema-pruned.safetensors')

        // Node 269: upscale takes the clean VAE decode
        expect(template['269'].inputs.image).toEqual(['266', 0])

        // Node 288: ImageScale to 2880x1800
        expect(template['288'].class_type).toBe('ImageScale')
        expect(template['288'].inputs.width).toBe(2880)
        expect(template['288'].inputs.height).toBe(1800)

        // Node 275: SaveImage output node fed by the high-res composite
        expect(template['275'].class_type).toBe('SaveImage')
        expect(template['275'].inputs.filename_prefix).toBe('Wallpaper_v2_2880x1800')
        expect(template['275'].inputs.images).toEqual(['298', 0])

        // Node 277: UpscaleModelLoader
        expect(template['277'].class_type).toBe('UpscaleModelLoader')

        // Nodes 271 / 272: prompts
        expect(template['271'].class_type).toBe('CLIPTextEncode')
        expect(template['272'].class_type).toBe('CLIPTextEncode')

        // Nodes 295-298: high-res plate preservation
        expect(template['295'].class_type).toBe('ImageScale')
        expect(template['295'].inputs.width).toBe(1280)
        expect(template['295'].inputs.height).toBe(1800)
        expect(template['295'].inputs.image).toEqual(['258', 0])
        expect(template['296'].class_type).toBe('SolidMask')
        expect(template['297'].class_type).toBe('FeatherMask')
        expect(template['297'].inputs.left).toBe(160)
        expect(template['297'].inputs.right).toBe(160)
        expect(template['298'].class_type).toBe('ImageCompositeMasked')
        expect(template['298'].inputs.x).toBe(800)
        expect(template['298'].inputs.destination).toEqual(['288', 0])
        expect(template['298'].inputs.source).toEqual(['295', 0])
        expect(template['298'].inputs.mask).toEqual(['297', 0])
    })

    it('returns an independent copy of the template on each load', async () => {
        const a = await loadWallpaperV2Template()
        a['258'].inputs.image = 'changed.png'
        const b = await loadWallpaperV2Template()
        expect(b['258'].inputs.image).not.toBe('changed.png')
    })

    it('resolves the default ComfyUI URL correctly', async () => {
        const previous = process.env.COMFYUI_URL
        delete process.env.COMFYUI_URL
        try {
            expect(await getComfyUiUrl('non_existent_user')).toBe('http://localhost:8188')
        } finally {
            if (previous !== undefined) process.env.COMFYUI_URL = previous
        }
    })

    it('accepts only plain http(s) ComfyUI URLs', () => {
        expect(normalizeComfyUiUrl('http://localhost:8188/')).toBe('http://localhost:8188')
        expect(normalizeComfyUiUrl(' https://gpu.example.ts.net/comfy/ ')).toBe('https://gpu.example.ts.net/comfy')
        expect(normalizeComfyUiUrl('http://100.64.0.2:8188')).toBe('http://100.64.0.2:8188')
        expect(normalizeComfyUiUrl('file:///etc/passwd')).toBeNull()
        expect(normalizeComfyUiUrl('ftp://host')).toBeNull()
        expect(normalizeComfyUiUrl('http://user:pass@host:8188')).toBeNull()
        expect(normalizeComfyUiUrl('http://host:8188/?x=1')).toBeNull()
        expect(normalizeComfyUiUrl('not a url')).toBeNull()
        expect(normalizeComfyUiUrl(42)).toBeNull()
    })

    it('validates upscale model names and scene presets', () => {
        expect(isValidUpscaleModelName('4x-UltraSharp.pth')).toBe(true)
        expect(isValidUpscaleModelName('RealESRGAN_x2plus.pth')).toBe(true)
        expect(isValidUpscaleModelName('../../etc/passwd.pth')).toBe(false)
        expect(isValidUpscaleModelName('sub/model.pth')).toBe(false)
        expect(isValidUpscaleModelName('model.exe')).toBe(false)
        expect(isScenePreset('indoor')).toBe(true)
        expect(isScenePreset('studio')).toBe(true)
        expect(isScenePreset('toString')).toBe(false)
        expect(isScenePreset('custom')).toBe(false)
    })

    it('defines supported upscale models including RealESRGAN 2x and 4x-UltraSharp', () => {
        const ids = DEFAULT_UPSCALE_MODELS.map((m) => m.id)
        expect(ids).toContain('4x-UltraSharp.pth')
        expect(ids).toContain('RealESRGAN_x2plus.pth')
        expect(ids).toContain('4x_foolhardy_Remacri.pth')
        expect(DEFAULT_UPSCALE_MODELS.find((m) => m.id === 'RealESRGAN_x2plus.pth')?.scale).toBe(2)
    })

    it('provides prompt presets for Outdoor, Indoor, and Studio scenes', () => {
        expect(SCENE_PRESETS.outdoor.positive).toContain('natural scenery background')
        expect(SCENE_PRESETS.outdoor.negative).toContain('road')
        expect(SCENE_PRESETS.outdoor.negative).toContain('vanishing lines')
        expect(SCENE_PRESETS.indoor.positive).toContain('extending the room background naturally')
        expect(SCENE_PRESETS.indoor.negative).toContain('curtains')
        expect(SCENE_PRESETS.indoor.negative).toContain('sky')
        expect(SCENE_PRESETS.studio.positive).toContain('smooth clean backdrop continuation')
        expect(SCENE_PRESETS.studio.negative).toContain('outdoor')
    })
})
