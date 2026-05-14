import fs from 'fs'
import path from 'path'
import { getTvheadendConfig } from './tvheadend'
import { spawn } from 'child_process'
import { consola } from 'consola'

interface ActiveRecording {
    username: string
    channelUuid: string
    activeEventId?: string
    title: string
    startTime: number
    filePath: string // The .ts file path
    process: any
}

const activeRecordings = new Map<string, ActiveRecording>()

export function getActiveRecordings(username: string) {
    return Array.from(activeRecordings.values())
        .filter(r => r.username === username)
        .map(r => ({
            uuid: r.channelUuid,
            eventId: r.activeEventId,
            title: r.title,
            status: 'recording',
            start: Math.floor(r.startTime / 1000),
            channelname: 'Cloud Recording'
        }))
}

export async function startCloudRecording(username: string, channelUuid: string, title: string, eventId?: string) {
    const recordingKey = `${username}:${channelUuid}`
    if (activeRecordings.has(recordingKey)) throw new Error('Recording already in progress')

    const config = await getTvheadendConfig(username)
    if (!config) throw new Error('Tvheadend not configured')

    const runtimeConfig = useRuntimeConfig()
    const userDir = path.join(runtimeConfig.storagePath, username, 'Recordings')
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const safeTitle = title.replace(/[^a-z0-9]/gi, '_').substring(0, 50)
    const fileNameTs = `${safeTitle}_${timestamp}.ts`
    const filePathTs = path.join(userDir, fileNameTs)
    const fileNameMp4 = `${safeTitle}_${timestamp}.mp4`
    const filePathMp4 = path.join(userDir, fileNameMp4)

    const { host, port, user: tvUser, pass: tvPass } = config
    const encodedUser = encodeURIComponent(tvUser)
    const encodedPass = encodeURIComponent(tvPass)
    const targetUrl = `http://${encodedUser}:${encodedPass}@${host}:${port}/stream/channel/${channelUuid}?profile=pass`

    consola.start(`[Cloud Recorder] Starting raw capture for: ${title}`)
    const ffmpeg = spawn('ffmpeg', [
        '-i', targetUrl,
        '-c', 'copy',
        '-map', '0',
        '-fflags', '+genpts',
        '-copyts',
        '-start_at_zero',
        '-y',
        filePathTs
    ], { stdio: ['pipe', 'pipe', 'pipe'] })

    const recording: ActiveRecording = {
        username,
        channelUuid,
        activeEventId: eventId,
        title,
        startTime: Date.now(),
        filePath: filePathTs,
        process: ffmpeg
    }
    activeRecordings.set(recordingKey, recording)

    ffmpeg.on('close', (code) => {
        activeRecordings.delete(recordingKey)
        consola.info(`[Cloud Recorder] Finished raw capture. Code: ${code}`)
        consola.start(`[Cloud Recorder] Starting MP4 conversion: ${fileNameMp4}`)
        
        // Post-process: Convert TS to MP4
        // Adding aresample=async=1 and avoid_negative_ts to fix A/V desync
        const converter = spawn('ffmpeg', [
            '-i', filePathTs,
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-af', 'aresample=async=1',
            '-map', '0:v',
            '-map', '0:a',
            '-avoid_negative_ts', 'make_zero',
            '-movflags', '+faststart',
            '-y',
            filePathMp4
        ])
        
        converter.on('close', (c) => {
            if (c === 0) {
                consola.success(`[Cloud Recorder] Conversion successful: ${fileNameMp4}`)
                if (fs.existsSync(filePathTs)) fs.unlinkSync(filePathTs)
            } else {
                consola.error(`[Cloud Recorder] Conversion failed for ${fileNameTs} with code ${c}`)
            }
        })

        converter.stderr.on('data', (data) => {
            // Optional: log conversion errors if they happen
            const msg = data.toString()
            if (msg.toLowerCase().includes('error')) {
                consola.error(`[Cloud Recorder] Conversion Error: ${msg.substring(0, 200)}`)
            }
        })
    })

    return { message: 'Recording started', fileName: fileNameTs }
}

export function stopCloudRecording(username: string, channelUuid: string) {
    const recordingKey = `${username}:${channelUuid}`
    const recording = activeRecordings.get(recordingKey)
    if (recording) {
        consola.info(`[Cloud Recorder] Stopping active recording for ${recording.title}`)
        recording.process.stdin.write('q\n')
        setTimeout(() => {
            if (activeRecordings.has(recordingKey)) {
                consola.warn(`[Cloud Recorder] Force killing recording process: ${recording.title}`)
                recording.process.kill('SIGKILL')
            }
        }, 3000)
        return { message: 'Recording stopping...' }
    }
    throw new Error('No active recording found')
}
