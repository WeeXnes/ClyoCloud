import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const userStoragePath = path.join(config.storagePath, event.context.user.name)
    const body = await readBody(event)
    const subPath = body.path ? body.path.toString() : ''

    if (!subPath) {
      throw createError({
        statusCode: 400,
        statusMessage: 'File path is required',
      })
    }

    const safeSubPath = path.normalize(subPath).replace(/^(\.\.(\/|\\|$))+/, '')
    const fullPath = path.join(userStoragePath, safeSubPath)

    // Ensure path is within user's directory
    if (!fullPath.startsWith(userStoragePath)) {
      console.error(`Access denied: Resolved path ${fullPath} is outside user directory ${userStoragePath}`)
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied: Path outside user directory',
      })
    }

    const cloudInfoPath = `${fullPath}.cloudinfo`

    const stats = await fs.stat(fullPath)
    if (stats.isDirectory()) {
      await fs.rm(fullPath, { recursive: true, force: true })
    } else {
      await fs.unlink(fullPath)
    }

    // Also delete .cloudinfo file if it exists
    try {
      await fs.access(cloudInfoPath)
      await fs.unlink(cloudInfoPath)
    } catch (e) {
      // Ignore if .cloudinfo doesn't exist
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting file:', error)
    if (error.code === 'ENOENT') {
        throw createError({
            statusCode: 404,
            statusMessage: 'File not found',
        })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Could not delete file',
    })
  }
})
