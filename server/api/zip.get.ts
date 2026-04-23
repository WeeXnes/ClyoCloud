import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const folderPath = query.path ? decodeURIComponent(query.path as string) : '';
  const userStoragePath = path.join(config.storagePath, event.context.user.name);
  const fullPath = path.join(userStoragePath, folderPath);

  // Security check to ensure the path is within the user's directory
  if (!fullPath.startsWith(path.resolve(userStoragePath))) {
    throw createError({ statusCode: 403, message: 'Access denied' });
  }

  if (!fs.existsSync(fullPath) || !fs.lstatSync(fullPath).isDirectory()) {
    throw createError({ statusCode: 404, message: 'Folder not found' });
  }

  const archive = archiver('zip', { zlib: { level: 9 } });
  
  setHeader(event, 'Content-Type', 'application/zip');
  setHeader(event, 'Content-Disposition', `attachment; filename="${path.basename(fullPath || 'archive')}.zip"`);
  
  archive.pipe(event.node.res);
  archive.directory(fullPath, false);
  await archive.finalize();
});
