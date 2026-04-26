import { defineEventHandler, readBody, createError, setResponseHeader } from 'h3';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const { url } = await readBody(event);
  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, message: 'Invalid URL provided' });
  }

  const config = useRuntimeConfig();
  
  // Get user specific download path
  let userDownloadSubPath = '';
  try {
    const usersData = await fs.readFile(config.usersFilePath, 'utf-8');
    const users = JSON.parse(usersData);
    const userData = users.find((u: any) => u.name === user.name);
    if (userData && userData.downloadPath) {
      userDownloadSubPath = userData.downloadPath;
    }
  } catch (e) {
    console.error('Error reading user settings for download path:', e);
  }

  const userPath = path.join(config.storagePath, user.name, userDownloadSubPath);
  
  // Ensure the directory exists
  await fs.mkdir(userPath, { recursive: true });

  // Set headers for streaming
  setResponseHeader(event, 'Content-Type', 'text/event-stream');
  setResponseHeader(event, 'Cache-Control', 'no-cache');
  setResponseHeader(event, 'Connection', 'keep-alive');

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
  ]);

  return new ReadableStream({
    start(controller) {
      child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            controller.enqueue(`data: ${JSON.stringify({ type: 'log', message: line })}\n\n`);
          }
        }
      });

      child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            controller.enqueue(`data: ${JSON.stringify({ type: 'error', message: line })}\n\n`);
          }
        }
      });

      child.on('close', (code) => {
        controller.enqueue(`data: ${JSON.stringify({ type: 'close', code })}\n\n`);
        controller.close();
      });

      child.on('error', (err) => {
        controller.enqueue(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        controller.close();
      });
    },
    cancel() {
      child.kill();
    }
  });
});
