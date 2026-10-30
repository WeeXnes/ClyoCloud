import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'

import { isPathWithin, isTrashPath, clearUserCache } from '~/server/utils/fileUtils'

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
    const userStoragePath = path.join(config.storagePath, event.context.user.name)
    const body = await readBody(event)
    const folderName = body.name ? body.name.toString().trim() : ''
    const subPath = body.path ? body.path.toString() : ''

    if (!folderName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Folder name is required',
      })
    }

    const safeSubPath = path.normalize(subPath).replace(/^(\.\.(\/|\\|$))+/, '')
    const fullPath = path.join(userStoragePath, safeSubPath, folderName)

    // Ensure path is within user's directory
    if (!isPathWithin(userStoragePath, fullPath) || isTrashPath(userStoragePath, fullPath)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied: Path outside user directory',
      })
    }

    await fs.mkdir(fullPath, { recursive: true })

    const relativePath = path.relative(userStoragePath, fullPath).replace(/\\/g, '/')
    
    // Update tag cache for the new folder
    await updateFileInCache(event.context.user.name, relativePath, { tags: [] })

    await logActivity(event.context.user.name, 'MKDIR', relativePath, undefined, event)

    clearUserCache(event.context.user.name)

    return { success: true }
  } catch (error) {
    console.error('Error creating folder:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Could not create folder',
    })
  }
})
