import { defineEventHandler, createError } from 'h3'
import { getComfyUiModels, getComfyUiUrl, SCENE_PRESETS } from '../../utils/comfyui'

export default defineEventHandler(async (event) => {
    const user = event.context.user
    if (!user || !user.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const comfyUrl = await getComfyUiUrl(user.name)
    const models = await getComfyUiModels(comfyUrl)

    const presets = Object.values(SCENE_PRESETS).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        positive: p.positive,
        negative: p.negative
    }))

    return { models, presets }
})
