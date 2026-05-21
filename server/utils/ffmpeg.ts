import { spawn } from 'child_process'

export async function runFfmpeg(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const process = spawn('ffmpeg', args)
        let stdout = ''
        let stderr = ''
        process.stdout.on('data', (data) => stdout += data)
        process.stderr.on('data', (data) => stderr += data)
        process.on('close', (code) => {
            if (code === 0) resolve(stdout)
            else reject(new Error(`ffmpeg failed with code ${code}: ${stderr}`))
        })
    })
}

export async function runFfprobe(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const process = spawn('ffprobe', args)
        let stdout = ''
        let stderr = ''
        process.stdout.on('data', (data) => stdout += data)
        process.stderr.on('data', (data) => stderr += data)
        process.on('close', (code) => {
            if (code === 0) resolve(stdout)
            else reject(new Error(`ffprobe failed with code ${code}: ${stderr}`))
        })
    })
}
