import fs from 'fs/promises'
import path from 'path'
import { defineEventHandler, createError, readBody } from 'h3'
import { isPathWithin } from '~/server/utils/fileUtils'

export default defineEventHandler(async (event) => {
    // Only authenticated users can update metadata
    if (!event.context.user || !event.context.user.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const config = useRuntimeConfig()
    const { type, name, title, artworkUrl, description, year } = await readBody(event)

    if (!type || !name) {
        throw createError({ statusCode: 400, statusMessage: 'Type and name are required' })
    }

    if (type !== 'movie' && type !== 'show') {
        throw createError({ statusCode: 400, statusMessage: 'Invalid media type' })
    }

    const rootDir = type === 'movie' ? config.moviesPath : config.showsPath
    const targetFolder = path.join(rootDir, name)

    // Security check to ensure folder is within the authorized root directory
    if (!isPathWithin(rootDir, targetFolder)) {
        throw createError({ statusCode: 403, statusMessage: 'Access denied: Target path outside root directory' })
    }

    // Ensure the folder exists
    try {
        await fs.mkdir(targetFolder, { recursive: true })
    } catch (err) {
        throw createError({ statusCode: 500, statusMessage: 'Failed to create directory' })
    }

    const metadataPath = path.join(targetFolder, 'theatre.json')
    
    // Read existing metadata to preserve fields we aren't changing
    let metadata: any = {}
    try {
        const fileContent = await fs.readFile(metadataPath, 'utf-8')
        metadata = JSON.parse(fileContent)
    } catch (err) {}

    // Update fields
    metadata.title = title !== undefined ? title : metadata.title
    metadata.artworkUrl = artworkUrl !== undefined ? artworkUrl : metadata.artworkUrl
    metadata.description = description !== undefined ? description : metadata.description
    metadata.year = year !== undefined ? year : metadata.year

    try {
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
        return { success: true, message: 'Metadata updated successfully', metadata }
    } catch (err: any) {
        console.error('Error writing metadata file:', err)
        throw createError({ statusCode: 500, statusMessage: 'Failed to save metadata' })
    }
})
