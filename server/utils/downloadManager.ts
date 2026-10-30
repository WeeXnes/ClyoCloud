import { ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { clearUserCache } from './fileUtils';

interface LogEntry {
  type: string;
  message: string;
  time: string;
}

interface DownloadJob {
  process: ChildProcess;
  logs: LogEntry[];
  progress: any;
  status: 'running' | 'completed' | 'error' | 'cancelled';
  url: string;
}

const activeJobs = new Map<string, DownloadJob>();

const getFormattedTime = () => {
  const now = new Date();
  return now.toLocaleTimeString('de-DE', { hour12: false });
};

/**
 * Returns the normalized URL if it is a well-formed http(s) URL, otherwise null.
 */
export const parseDownloadUrl = (input: unknown): string | null => {
  if (typeof input !== 'string') return null;
  try {
    const parsed = new URL(input);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
};

export const getActiveJob = (username: string) => activeJobs.get(username);

export const stopActiveJob = (username: string) => {
  const job = activeJobs.get(username);
  if (job && job.status === 'running') {
    job.status = 'cancelled';
    
    job.logs.push({ 
      type: 'warning', 
      message: 'Download cancelled by user. Process terminated.',
      time: getFormattedTime()
    });

    if (job.process.pid) {
      try {
        process.kill(-job.process.pid, 'SIGKILL');
      } catch (e) {
        try {
          job.process.kill('SIGKILL');
        } catch (err) {}
      }
    }
    return true;
  }
  return false;
};

export const dismissJob = (username: string) => {
  const job = activeJobs.get(username);
  if (job && job.status !== 'running') {
    activeJobs.delete(username);
    return true;
  }
  return false;
};

export const startDownloadJob = async (username: string, url: string, userPath: string) => {
  const existingJob = activeJobs.get(username);
  if (existingJob) {
    if (existingJob.status === 'running') return existingJob;
    activeJobs.delete(username);
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
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '--referer', 'https://www.pornhub.com/',
    '--no-check-certificate',
    '--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    '--add-header', 'Accept-Language: en-US,en;q=0.9',
    '--add-header', 'Sec-Fetch-Dest: document',
    '--add-header', 'Sec-Fetch-Mode: navigate',
    '--add-header', 'Sec-Fetch-Site: none',
    '--add-header', 'Sec-Fetch-User: ?1',
    '--add-header', 'Upgrade-Insecure-Requests: 1',
    '-P', userPath,
    '--',
    url
  ], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const job: DownloadJob = {
    process: child,
    logs: [{ type: 'info', message: `Initializing download for: ${url}`, time: getFormattedTime() }],
    progress: { filename: '' },
    status: 'running',
    url
  };

  activeJobs.set(username, job);

  child.stdout?.on('data', (data) => {
    if (job.status !== 'running') return;
    const lines = data.toString().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('progress:')) {
        const content = trimmed.slice(9);
        const parts = content.split('|');
        if (parts.length >= 4) {
           const sizeParts = parts[0].split('/');
           job.progress = {
              ...job.progress,
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
        // Extract filename from normal logs
        if (trimmed.includes('[download] Destination:')) {
          const fullPath = trimmed.split('Destination:')[1].trim();
          job.progress.filename = fullPath.split('/').pop() || '';
        } else if (trimmed.includes('has already been downloaded')) {
          const fullPath = trimmed.replace('[download] ', '').replace(' has already been downloaded', '').trim();
          job.progress.filename = fullPath.split('/').pop() || '';
        }

        job.logs.push({ type: 'log', message: trimmed, time: getFormattedTime() });
        if (job.logs.length > 500) job.logs.shift();
      }
    }
  });

  child.stderr?.on('data', (data) => {
    if (job.status !== 'running') return;
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.trim()) {
        job.logs.push({ type: 'error', message: line, time: getFormattedTime() });
        if (job.logs.length > 500) job.logs.shift();
      }
    }
  });

  child.on('close', (code) => {
    if (job.status === 'running') {
      job.status = code === 0 ? 'completed' : 'error';
      job.logs.push({ 
        type: code === 0 ? 'success' : 'error', 
        message: code === 0 ? 'Download process finished successfully.' : `Process exited with code ${code}`,
        time: getFormattedTime()
      });
    }
    if (code === 0) {
      clearUserCache(username);
    }
    child.stdout?.removeAllListeners();
    child.stderr?.removeAllListeners();
  });

  child.on('error', (err) => {
    if (job.status === 'running') {
      job.status = 'error';
      job.logs.push({ type: 'error', message: err.message, time: getFormattedTime() });
    }
  });

  return job;
};
