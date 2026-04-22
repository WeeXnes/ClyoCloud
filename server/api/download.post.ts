import { defineEventHandler, readBody, createError } from 'h3';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

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
  const userPath = path.join(config.storagePath, user.name);

  try {
    // Execute gallery-dl. 
    // Using execFile with arguments array prevents shell injection.
    await execFileAsync('gallery-dl', ['-d', userPath, url]);
    return { success: true, message: 'Download started' };
  } catch (error) {
    console.error('gallery-dl error:', error);
    throw createError({ statusCode: 500, message: 'Failed to download media' });
  }
});
