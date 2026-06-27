import fs from 'fs/promises'
import path from 'path'
import { defineEventHandler, createError } from 'h3'
import { isPathWithin } from '~/server/utils/fileUtils'

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.mov', '.avi']
const IMAGE_FILES = ['poster.jpg', 'poster.png', 'cover.jpg', 'cover.png', 'folder.jpg', 'folder.png']

export default defineEventHandler(async (event) => {
    // Only authenticated users can list theatre media
    if (!event.context.user || !event.context.user.name) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const config = useRuntimeConfig()
    const moviesPath = config.moviesPath
    const showsPath = config.showsPath

    // Dynamically ensure folders exist
    try {
        await fs.mkdir(moviesPath, { recursive: true })
        await fs.mkdir(showsPath, { recursive: true })
    } catch (err) {
        console.error('Failed to create movies/shows paths:', err)
    }

    const movies: any[] = []
    const shows: any[] = []

    // 1. Scan Movies
    try {
        const movieDirs = await fs.readdir(moviesPath, { withFileTypes: true })
        for (const dir of movieDirs) {
            if (!dir.isDirectory()) continue

            const movieDirName = dir.name
            const movieFolder = path.join(moviesPath, movieDirName)

            // Read metadata if exists
            let meta: any = {}
            try {
                const metaContent = await fs.readFile(path.join(movieFolder, 'theatre.json'), 'utf-8')
                meta = JSON.parse(metaContent)
            } catch (err) {}

            // Scan files in movie folder
            const files = await fs.readdir(movieFolder, { withFileTypes: true })
            let mainVideoFile = ''
            let maxVideoSize = 0
            let mainVideoMtime = Date.now()
            let hasLocalPoster = false

            for (const file of files) {
                if (file.isFile()) {
                    const ext = path.extname(file.name).toLowerCase()
                    if (VIDEO_EXTENSIONS.includes(ext)) {
                        const stats = await fs.stat(path.join(movieFolder, file.name))
                        // Select the largest video file as the movie
                        if (stats.size > maxVideoSize) {
                            maxVideoSize = stats.size
                            mainVideoFile = file.name
                            mainVideoMtime = stats.mtime.getTime()
                        }
                    } else if (IMAGE_FILES.includes(file.name.toLowerCase())) {
                        hasLocalPoster = true
                    }
                }
            }

            // Only add if there is a video file in the folder
            if (mainVideoFile) {
                let artworkUrl = meta.artworkUrl || ''
                if (!artworkUrl && hasLocalPoster) {
                    artworkUrl = `/api/theatre/artwork?type=movie&name=${encodeURIComponent(movieDirName)}`
                }

                movies.push({
                    id: movieDirName,
                    name: movieDirName,
                    title: meta.title || movieDirName,
                    type: 'movie',
                    videoFile: mainVideoFile,
                    videoPath: `/theatre/stream/movie/${encodeURIComponent(movieDirName)}/${encodeURIComponent(mainVideoFile)}`,
                    artworkUrl,
                    description: meta.description || '',
                    year: meta.year || '',
                    size: maxVideoSize,
                    lastModified: mainVideoMtime
                })
            }
        }
    } catch (err) {
        console.error('Error scanning movies directory:', err)
    }

    // 2. Scan Shows
    try {
        const showDirs = await fs.readdir(showsPath, { withFileTypes: true })
        for (const dir of showDirs) {
            if (!dir.isDirectory()) continue

            const showDirName = dir.name
            const showFolder = path.join(showsPath, showDirName)

            // Read metadata if exists
            let meta: any = {}
            try {
                const metaContent = await fs.readFile(path.join(showFolder, 'theatre.json'), 'utf-8')
                meta = JSON.parse(metaContent)
            } catch (err) {}

            const showFiles = await fs.readdir(showFolder, { withFileTypes: true })
            let hasLocalPoster = false
            const seasons: any[] = []

            for (const file of showFiles) {
                if (file.isFile() && IMAGE_FILES.includes(file.name.toLowerCase())) {
                    hasLocalPoster = true
                } else if (file.isDirectory()) {
                    const seasonDirName = file.name // e.g., "Season 1"
                    const seasonFolder = path.join(showFolder, seasonDirName)

                    const episodeFiles = await fs.readdir(seasonFolder, { withFileTypes: true })
                    const episodes: any[] = []

                    for (const epFile of episodeFiles) {
                        if (epFile.isFile()) {
                            const ext = path.extname(epFile.name).toLowerCase()
                            if (VIDEO_EXTENSIONS.includes(ext)) {
                                const stats = await fs.stat(path.join(seasonFolder, epFile.name))
                                episodes.push({
                                    name: epFile.name,
                                    title: epFile.name.replace(/\.[^/.]+$/, ''), // remove ext
                                    videoFile: epFile.name,
                                    videoPath: `/theatre/stream/show/${encodeURIComponent(showDirName)}/${encodeURIComponent(seasonDirName)}/${encodeURIComponent(epFile.name)}`,
                                    size: stats.size
                                })
                            }
                        }
                    }

                    if (episodes.length > 0) {
                        // Sort episodes alphabetically
                        episodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
                        seasons.push({
                            name: seasonDirName,
                            episodes
                        })
                    }
                }
            }

            // Sort seasons
            seasons.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))

            // Only add if there are seasons and episodes
            if (seasons.length > 0) {
                let artworkUrl = meta.artworkUrl || ''
                if (!artworkUrl && hasLocalPoster) {
                    artworkUrl = `/api/theatre/artwork?type=show&name=${encodeURIComponent(showDirName)}`
                }

                shows.push({
                    id: showDirName,
                    name: showDirName,
                    title: meta.title || showDirName,
                    type: 'show',
                    artworkUrl,
                    description: meta.description || '',
                    year: meta.year || '',
                    seasons
                })
            }
        }
    } catch (err) {
        console.error('Error scanning shows directory:', err)
    }

    return {
        movies,
        shows
    }
})
