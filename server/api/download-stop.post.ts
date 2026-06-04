import { defineEventHandler, createError } from 'h3';
import { stopActiveJob } from '../utils/downloadManager';
import { logActivity } from '../utils/activityLogger';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const stopped = stopActiveJob(user.name);
  if (stopped) {
    await logActivity(user.name, 'REMOTE_DOWNLOAD_STOP', 'Downloader', 'Manually stopped remote download job', event);
  }
  return { success: stopped };
});
