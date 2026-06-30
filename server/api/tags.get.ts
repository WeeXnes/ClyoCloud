import {defineEventHandler, createError} from "h3";
import fs from "fs";
import path from "path";

export default defineEventHandler(async (event) => {
    const runtimeConfig = useRuntimeConfig();
    const user = event.context.user;
    if (!user || !user.name) {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized',
        });
    }

    const tagsDir = path.dirname(runtimeConfig.tagsFilePath);
    const userTagsPath = path.join(tagsDir, `tags_${user.name}.json`);

    if (!fs.existsSync(userTagsPath)) {
        try {
            const rootDir = path.resolve(process.cwd(), ".examples");
            const sourcePath = path.join(rootDir, "tags.json");
            if (fs.existsSync(sourcePath)) {
                await fs.promises.mkdir(tagsDir, { recursive: true });
                await fs.promises.copyFile(sourcePath, userTagsPath);
            }
        } catch (err) {
            console.error('Error copying example tags file:', err);
        }
    }

    try {
        if (fs.existsSync(userTagsPath)) {
            const tagsData = await fs.promises.readFile(userTagsPath, 'utf-8');
            const tags = JSON.parse(tagsData);
            return tags.tags || [];
        }
        return [];
    } catch (err) {
        console.error('Read tags error:', err);
        return [];
    }
});
