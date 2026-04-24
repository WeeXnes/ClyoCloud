import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  // Expecting a comma-separated list of filenames in the query
  const fileNames = query.files ? decodeURIComponent(query.files as string).split(',') : [];
  const folderPath = query.path ? decodeURIComponent(query.path as string) : '';
  const userStoragePath = path.resolve(config.storagePath, event.context.user.name);
  const fullPath = path.resolve(userStoragePath, folderPath);

  if (fileNames.length === 0) {
    throw createError({ statusCode: 400, message: 'No files specified' });
  }

  // Security check
  if (!fullPath.startsWith(userStoragePath)) {
    throw createError({ statusCode: 403, message: 'Access denied' });
  }

  const archive = archiver('zip', { zlib: { level: 9 } });
  
  setHeader(event, 'Content-Type', 'application/zip');
  setHeader(event, 'Content-Disposition', 'attachment; filename="files.zip"');
  
  archive.pipe(event.node.res);

  for (const name of fileNames) {
    const filePath = path.join(fullPath, name);
    if (fs.existsSync(filePath)) {
      if (fs.lstatSync(filePath).isDirectory()) {
        archive.glob('**/*', {
          cwd: filePath,
          prefix: name,
          ignore: ['**/*.cloudinfo']
        });
      } else if (!name.endsWith('.cloudinfo')) {
        archive.file(filePath, { name });
      }
    }
  }

  await archive.finalize();
});
