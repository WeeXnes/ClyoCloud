import {defineEventHandler} from "h3";
import fs from "fs";

export default defineEventHandler(async (event) => {
    const runtimeConfig = useRuntimeConfig();

    if (!fs.existsSync(runtimeConfig.tagsFilePath)) {
        return [];
    }

    const tagsData = await fs.promises.readFile(runtimeConfig.tagsFilePath, 'utf-8');
    const tags = JSON.parse(tagsData);

    return tags.tags;
});
