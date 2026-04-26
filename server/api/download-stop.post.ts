import { defineEventHandler, createError } from 'h3';
import { stopActiveJob } from '../utils/downloadManager';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: 'Unauthorized' });
  }

  const stopped = stopActiveJob(user.name);
  return { success: stopped };
});
