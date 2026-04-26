import { ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

interface DownloadJob {
  process: ChildProcess;
  logs: { type: string; message: string }[];
  progress: any;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  url: string;
}

const activeJobs = new Map<string, DownloadJob>();

export const getActiveJob = (username: string) => activeJobs.get(username);

export const stopActiveJob = (username: string) => {
  const job = activeJobs.get(username);
  if (job && job.status === 'running') {
    // Kill the entire process group if possible
    if (job.process.pid) {
      try {
        process.kill(-job.process.pid, 'SIGTERM');
      } catch (e) {
        job.process.kill('SIGTERM');
      }
    }
    job.status = 'cancelled';
    job.logs.push({ type: 'warning', message: 'Download cancelled by user.' });
    return true;
  }
  return false;
};

export const clearJob = (username: string) => {
  activeJobs.delete(username);
};

export const startDownloadJob = async (username: string, url: string, userPath: string) => {
  // If a job is already running, don't start a new one
  if (activeJobs.has(username) && activeJobs.get(username)?.status === 'running') {
    return activeJobs.get(username);
  }

  await fs.mkdir(userPath, { recursive: true });

  const child = spawn('yt-dlp', [
    '--newline',
    '--progress',
    '--progress-template', 'progress:%(progress._downloaded_bytes_str)s/%(progress._total_bytes_str)s|%(progress._eta_str)s|%(progress._speed_str)s|%(progress._percent_str)s|%(info.playlist_index)s|%(info.playlist_count)s',
    '--no-colors',
    '--format', 'bestvideo+bestaudio/best',
    '--output', '%(title)s.%(ext)s',
    '--no-mtime',
    '-P', userPath,
    url
  ], { detached: true }); // detached for process group killing

  const job: DownloadJob = {
    process: child,
    logs: [{ type: 'info', message: `Initializing download for: ${url}` }],
    progress: {},
    status: 'running',
    url
  };

  activeJobs.set(username, job);

  child.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        if (line.startsWith('progress:')) {
          const content = line.slice(9);
          const parts = content.split('|');
          if (parts.length >= 4) {
             const sizeParts = parts[0].split('/');
             job.progress = {
                bytes: sizeParts[0],
                total: sizeParts[1] === 'NA' ? '' : sizeParts[1],
                eta: parts[1],
                speed: parts[2],
                percent: parts[3],
                playlistIndex: parts[4],
                playlistCount: parts[5]
             };
          }
        } else {
          job.logs.push({ type: 'log', message: line });
          // Limit logs to last 500 lines
          if (job.logs.length > 500) job.logs.shift();
        }
      }
    }
  });

  child.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        job.logs.push({ type: 'error', message: line });
        if (job.logs.length > 500) job.logs.shift();
      }
    }
  });

  child.on('close', (code) => {
    if (job.status === 'running') {
      job.status = code === 0 ? 'completed' : 'error';
      job.logs.push({ 
        type: code === 0 ? 'success' : 'error', 
        message: code === 0 ? 'Download process finished successfully.' : `Process exited with code ${code}` 
      });
    }
  });

  child.on('error', (err) => {
    job.status = 'error';
    job.logs.push({ type: 'error', message: err.message });
  });

  return job;
};
