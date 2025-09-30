import {scanMp4Files, type Video} from "~/types/File";
import path from "path";

export default defineNitroPlugin(async (nitroApp) => {
    console.info("Running server init...")
    console.info("Initializing media backend...")

    const config = useRuntimeConfig()
    const storagePath = path.join(config.storagePath)

    const mp4Files = await scanMp4Files(storagePath);
    mp4Files.forEach((file, key) => {
        console.log(`Key: ${key}, File: ${file.name}, Path: ${file.fullPath}`);
    });

});
