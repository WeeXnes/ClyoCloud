import { defineEventHandler, getQuery, createError } from 'h3'
import { getPipelineJob } from '../../utils/comfyui'

export default defineEventHandler(async (event) => {
    const user = event.context.user
    if (!user || !user.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const jobId = getQuery(event).jobId?.toString()
    if (!jobId) {
        throw createError({ statusCode: 400, statusMessage: 'Job ID is required' })
    }

    const job = getPipelineJob(jobId)
    // Same answer for "missing" and "not yours", so job IDs of other users cannot be probed
    if (!job || (job.username !== user.name && !user.isAdmin)) {
        throw createError({ statusCode: 404, statusMessage: 'Job not found or expired' })
    }

    return { success: true, job }
})
