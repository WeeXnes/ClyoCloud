import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody(event);
  const fileNames = body.files as string[];
  const folderPath = body.path ? decodeURIComponent(body.path as string) : '';
  const userStoragePath = path.join(config.storagePath, event.context.user.name);
  const fullPath = path.join(userStoragePath, folderPath);

  if (!fileNames || fileNames.length === 0) {
    throw createError({ statusCode: 400, message: 'No files specified' });
  }

  // Security check
  if (!fullPath.startsWith(path.resolve(userStoragePath))) {
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
      } else {
        if (!name.endsWith('.cloudinfo')) {
          archive.file(filePath, { name });
        }
      }
    }
  }

  await archive.finalize();
});
