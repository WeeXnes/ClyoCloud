import { defineEventHandler, readBody, createError } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import { removeFromFavorites } from '~/server/utils/favorites'
import { removeFromWallpapers } from '~/server/utils/wallpapers'
import { moveToTrash } from '~/server/utils/trash'

import { isPathWithin, clearUserCache } from '~/server/utils/fileUtils'

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
    const fullPath = path.resolve(path.join(userStoragePath, safeSubPath))

    // Ensure path is within user's directory
    if (!isPathWithin(userStoragePath, fullPath)) {
      console.error(`Access denied: Resolved path ${fullPath} is outside user directory ${userStoragePath}`)
      throw createError({
        statusCode: 403,
        statusMessage: 'Access denied: Path outside user directory',
      })
    }

    // Prevent deleting the root directory
    if (fullPath === path.resolve(userStoragePath)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot delete storage root directory',
      })
    }

    const cloudInfoPath = `${fullPath}.cloudinfo`
    const isPermanent = body.permanent === true

    if (isPermanent) {
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
      await logActivity(event.context.user.name, 'PERMANENT_DELETE', safeSubPath, undefined, event)
    } else {
      // Soft-delete to user .trash directory
      await moveToTrash(event.context.user.name, safeSubPath)
      await logActivity(event.context.user.name, 'TRASH', safeSubPath, 'Moved to trash', event)
    }

    // Update tag cache
    removeFileFromCache(event.context.user.name, safeSubPath)

    // Update favorites and wallpapers indexes
    await removeFromFavorites(event.context.user.name, safeSubPath)
    await removeFromWallpapers(event.context.user.name, safeSubPath)

    clearUserCache(event.context.user.name)

    return { success: true, trashed: !isPermanent }
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
