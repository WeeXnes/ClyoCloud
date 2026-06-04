import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { logActivity } from '../utils/activityLogger';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const folderPath = query.path ? decodeURIComponent(query.path as string) : '';
  const userStoragePath = path.resolve(config.storagePath, event.context.user.name);
  const fullPath = path.resolve(userStoragePath, folderPath);

  // Security check to ensure the path is within the user's directory
  if (!fullPath.startsWith(userStoragePath)) {
    throw createError({ statusCode: 403, message: 'Access denied' });
  }

  if (!fs.existsSync(fullPath) || !fs.lstatSync(fullPath).isDirectory()) {
    throw createError({ statusCode: 404, message: 'Folder not found' });
  }

  // Log the ZIP download
  await logActivity(event.context.user.name, 'ZIP_DOWNLOAD', folderPath || 'root', undefined, event)

  const archive = archiver('zip', { zlib: { level: 9 } });
  
  setHeader(event, 'Content-Type', 'application/zip');
  setHeader(event, 'Content-Disposition', `attachment; filename="${path.basename(fullPath === userStoragePath ? 'root' : fullPath)}.zip"`);
  
  archive.pipe(event.node.res);
  archive.glob('**/*', {
    cwd: fullPath,
    ignore: ['**/*.cloudinfo', '**/.*']
  });
  await archive.finalize();
});
