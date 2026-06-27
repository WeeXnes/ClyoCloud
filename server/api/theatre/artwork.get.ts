import fs from 'fs/promises'
import { createReadStream } from 'fs'
import path from 'path'
import { defineEventHandler, createError, getQuery, setHeader } from 'h3'
import mime from 'mime-types'
import { isPathWithin } from '~/server/utils/fileUtils'

const POSTER_FILES = ['poster.jpg', 'poster.jpeg', 'poster.png', 'poster.webp', 'cover.jpg', 'cover.png', 'folder.jpg', 'folder.png']

export default defineEventHandler(async (event) => {
    // Only authenticated users can request artwork
    if (!event.context.user || !event.context.user.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const config = useRuntimeConfig()
    const query = getQuery(event)
    const type = query.type ? query.type.toString() : ''
    const name = query.name ? query.name.toString() : ''

    if (!type || !name) {
        throw createError({ statusCode: 400, statusMessage: 'Type and name query parameters are required' })
    }

    if (type !== 'movie' && type !== 'show') {
        throw createError({ statusCode: 400, statusMessage: 'Invalid media type' })
    }

    const rootDir = type === 'movie' ? config.moviesPath : config.showsPath
    const targetFolder = path.join(rootDir, name)

    // Security check
    if (!isPathWithin(rootDir, targetFolder)) {
        throw createError({ statusCode: 403, statusMessage: 'Access denied: Target path outside root directory' })
    }

    try {
        const files = await fs.readdir(targetFolder)
        
        // Look for any image named poster.* or folder.* or cover.*
        let foundFile = ''
        for (const file of files) {
            if (POSTER_FILES.includes(file.toLowerCase())) {
                foundFile = file
                break
            }
        }

        if (!foundFile) {
            throw createError({ statusCode: 404, statusMessage: 'Artwork not found' })
        }

        const filePath = path.join(targetFolder, foundFile)
        const contentType = mime.lookup(filePath) || 'image/jpeg'

        setHeader(event, 'Content-Type', contentType)
        setHeader(event, 'Cache-Control', 'public, max-age=86400') // Cache for 1 day

        return createReadStream(filePath)
    } catch (err: any) {
        if (err.statusCode) throw err
        console.error('Error fetching artwork:', err)
        throw createError({ statusCode: 404, statusMessage: 'Artwork not found' })
    }
})
