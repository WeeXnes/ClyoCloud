import { defineEventHandler, readBody, createError } from 'h3';
import path from 'node:path';
import fs from 'node:fs/promises';
import { startDownloadJob, getActiveJob, dismissJob } from '../utils/downloadManager';
import { checkDiskHeadroom, checkUserQuota } from '../utils/storageQuota';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const { url, action } = await readBody(event);
  const config = useRuntimeConfig();

  if (action === 'clear') {
    return { success: dismissJob(user.name) };
  }

  // If we're just checking status
  if (action === 'status') {
    const job = getActiveJob(user.name);
    if (!job) return { status: 'idle' };
    
    return {
      status: job.status,
      url: job.url,
      logs: job.logs,
      progress: job.progress
    };
  }

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, message: 'Invalid URL provided' });
  }

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
  
  // Headroom check
  const headroom = await checkDiskHeadroom(userPath, 50 * 1024 * 1024)
  if (!headroom.hasSpace) {
    throw createError({
      statusCode: 507,
      message: 'Host storage volume is nearly full. Download rejected.',
    })
  }

  // Quota check
  const quotaCheck = await checkUserQuota(user.name, 10 * 1024 * 1024)
  if (!quotaCheck.allowed) {
    throw createError({
      statusCode: 413,
      message: quotaCheck.error || 'User storage quota exceeded',
    })
  }

  await logActivity(user.name, 'REMOTE_DOWNLOAD_START', url, `Starting remote download to ${userDownloadSubPath || 'root'}`, event)

  const job = await startDownloadJob(user.name, url, userPath);

  return {
    status: job.status,
    url: job.url,
    message: 'Download started'
  };
});
