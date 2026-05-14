import fs from 'fs'
import path from 'path'
import { getTvheadendConfig } from './tvheadend'
import { createReadStream } from 'fs'
import { pipeline } from 'stream/promises'

interface ActiveRecording {
    username: string
    channelUuid: string
    title: string
    startTime: number
    filePath: string
    controller: AbortController
}

const activeRecordings = new Map<string, ActiveRecording>()

export function getActiveRecordings(username: string) {
    return Array.from(activeRecordings.values())
        .filter(r => r.username === username)
        .map(r => ({
            uuid: r.channelUuid, // Use channel UUID as identifier
            title: r.title,
            status: 'recording',
            start: Math.floor(r.startTime / 1000),
            channelname: 'Cloud Recording'
        }))
}

export async function startCloudRecording(username: string, channelUuid: string, title: string) {
    const recordingKey = `${username}:${channelUuid}`
    if (activeRecordings.has(recordingKey)) {
        throw new Error('Recording already in progress for this channel')
    }

    const config = await getTvheadendConfig(username)
    if (!config) throw new Error('Tvheadend not configured')

    const runtimeConfig = useRuntimeConfig()
    const userDir = path.join(runtimeConfig.storagePath, username, 'Recordings')
    
    if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)
    const fileName = `${safeTitle}_${timestamp}.ts` // We'll record raw stream for best quality
    const filePath = path.join(userDir, fileName)

    const { host, port, user: tvUser, pass: tvPass } = config
    const targetUrl = `http://${host}:${port}/stream/channel/${channelUuid}?profile=pass`
    const auth = Buffer.from(`${tvUser}:${tvPass}`).toString('base64')

    const controller = new AbortController()
    const writeStream = fs.createWriteStream(filePath)

    const recording: ActiveRecording = {
        username,
        channelUuid,
        title,
        startTime: Date.now(),
        filePath,
        controller
    }

    activeRecordings.set(recordingKey, recording)

    // Start background recording
    fetch(targetUrl, {
        headers: { 'Authorization': `Basic ${auth}` },
        signal: controller.signal
    }).then(async (response) => {
        if (!response.ok || !response.body) {
            throw new Error(`Tvheadend stream failed: ${response.statusText}`)
        }

        console.log(`[Cloud Recorder] Started recording ${title} for ${username} -> ${fileName}`)
        
        // Pipe the stream to file
        // @ts-ignore - response.body is a ReadableStream, we need to convert or use a helper
        const reader = response.body.getReader()
        
        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                writeStream.write(Buffer.from(value))
            }
        } finally {
            writeStream.end()
            activeRecordings.delete(recordingKey)
            console.log(`[Cloud Recorder] Finished recording: ${fileName}`)
        }
    }).catch((err) => {
        if (err.name === 'AbortError') {
            console.log(`[Cloud Recorder] Recording stopped by user: ${fileName}`)
        } else {
            console.error(`[Cloud Recorder] Recording error:`, err.message)
        }
        writeStream.end()
        activeRecordings.delete(recordingKey)
    })

    return { message: 'Recording started', fileName }
}

export function stopCloudRecording(username: string, channelUuid: string) {
    const recordingKey = `${username}:${channelUuid}`
    const recording = activeRecordings.get(recordingKey)
    
    if (recording) {
        recording.controller.abort()
        activeRecordings.delete(recordingKey)
        return { message: 'Recording stopped' }
    }
    
    throw new Error('No active recording found for this channel')
}
