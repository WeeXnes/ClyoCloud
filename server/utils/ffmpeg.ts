import { spawn } from 'child_process'

export async function runFfmpeg(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const cmd = process.platform === 'win32' ? 'ffmpeg' : 'nice'
        const cmdArgs = process.platform === 'win32' ? args : ['-n', '19', 'ffmpeg', ...args]
        const childProcess = spawn(cmd, cmdArgs)
        let stdout = ''
        let stderr = ''
        childProcess.stdout.on('data', (data) => stdout += data)
        childProcess.stderr.on('data', (data) => stderr += data)
        childProcess.on('close', (code) => {
            if (code === 0) resolve(stdout)
            else reject(new Error(`ffmpeg failed with code ${code}: ${stderr}`))
        })
    })
}

export async function runFfprobe(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const cmd = process.platform === 'win32' ? 'ffprobe' : 'nice'
        const cmdArgs = process.platform === 'win32' ? args : ['-n', '19', 'ffprobe', ...args]
        const childProcess = spawn(cmd, cmdArgs)
        let stdout = ''
        let stderr = ''
        childProcess.stdout.on('data', (data) => stdout += data)
        childProcess.stderr.on('data', (data) => stderr += data)
        childProcess.on('close', (code) => {
            if (code === 0) resolve(stdout)
            else reject(new Error(`ffprobe failed with code ${code}: ${stderr}`))
        })
    })
}
