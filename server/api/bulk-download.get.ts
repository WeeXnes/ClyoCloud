import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { isPathWithin } from '~/server/utils/fileUtils';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const fileNames = query.files ? decodeURIComponent(query.files as string).split(',') : [];
  const folderPath = query.path ? decodeURIComponent(query.path as string) : '';
  const userStoragePath = path.resolve(config.storagePath, event.context.user.name);
  const fullPath = path.resolve(userStoragePath, folderPath);

  if (fileNames.length === 0) {
    throw createError({ statusCode: 400, message: 'No files specified' });
  }

  // Security check
  if (!isPathWithin(userStoragePath, fullPath)) {
    throw createError({ statusCode: 403, message: 'Access denied' });
  }

  const archive = archiver('zip', { zlib: { level: 9 } });

  setHeader(event, 'Content-Type', 'application/zip');
  setHeader(event, 'Content-Disposition', `attachment; filename="files.zip"`);

  archive.pipe(event.node.res);

  // Correct strategy: Use archive.directory for folders (maintains structure) 
  // and archive.file for files, and filter .cloudinfo and dotfiles.
  for (const name of fileNames) {
      const filePath = path.join(fullPath, name);
      if (!isPathWithin(fullPath, filePath)) {
          throw createError({ statusCode: 403, message: 'Access denied' });
      }

      if (fs.existsSync(filePath)) {
          if (fs.lstatSync(filePath).isDirectory()) {
              archive.directory(filePath, name, {
                  filter: (path) => !path.endsWith('.cloudinfo') && !path.split('/').some(part => part.startsWith('.'))
              });
          } else if (!name.endsWith('.cloudinfo') && !name.startsWith('.')) {
              archive.file(filePath, { name });
          }
      }
  }
  
  await archive.finalize();
});
