import path from "path";
import fs from "fs";
import {Tag} from "~/types/File";
import chalk from "chalk";
import readline from "readline";
import bcrypt from "bcryptjs";

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

interface User {
    name: string;
    password: string;
}

export default defineNitroPlugin(async (nitroApp) => {
    const config = useRuntimeConfig()
    console.info("Running server init...")
    console.info("Initializing media backend...")
    console.info("Environment: ")
    console.info("Data Storage Path: " + config.storagePath)
    createDirIfNotExists(config.storagePath)
    console.info("Thumbnail Storage Path: " + config.thumbnailPath)
    createDirIfNotExists(config.thumbnailPath)
    console.info("Users JSON Path: " + config.usersFilePath)
    checkUserFile(config.usersFilePath)
    console.info("Tags JSON Path: " + config.tagsFilePath)
    checkTagsFile(config.tagsFilePath)
});


function createDirIfNotExists(path: string) {
    try {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path, { recursive: true })
            console.info(`Created missing directory: ${path}`)
        } else {
            console.info(`Directory already exists: ${path}`)
        }
    } catch (err) {
        console.error(`Failed to create directory ${path}:`, err)
        process.exit(1)
    }
}

export function checkUserFile(filePath: string) {
    const config = useRuntimeConfig();

    try {
        if (!fs.existsSync(filePath)) {
            console.info(`Users file not found, copying example file...`);
            copyExampleFile("users.json", config.usersFilePath);
            return checkUserFile(filePath);
        }

        const data = fs.readFileSync(filePath, "utf-8");
        let users: { name: string; password: string }[];

        try {
            users = JSON.parse(data);
        } catch (err) {
            console.warn(`Users file is invalid. Resetting...`);
            copyExampleFile("users.json", config.usersFilePath);
            return checkUserFile(filePath);
        }

        if (!Array.isArray(users)) {
            console.warn(`Users file is not an array. Resetting...`);
            copyExampleFile("users.json", config.usersFilePath);
            return checkUserFile(filePath);
        }

        const invalidUsers = users.filter(u => {
            return !u.password || typeof u.password !== "string" || !BCRYPT_HASH_REGEX.test(u.password);
        });

        if (invalidUsers.length > 0) {
            console.warn(`Found ${invalidUsers.length} user(s) with invalid password hashes. Resetting...`);
            copyExampleFile("users.json", config.usersFilePath);
            return checkUserFile(filePath);
        }

        const usernames = users.map(u => u.name);
        console.info("Existing users:", usernames.join(", "));

    } catch (err) {
        console.error(`Error checking users file:`, err);
        process.exit(1);
    }
}

export function checkTagsFile(filePath: string) {
    const config = useRuntimeConfig();

    try {
        if (!fs.existsSync(filePath)) {
            console.info(`Tags file not found at ${filePath}, copying example file...`);
            copyExampleFile("tags.json", config.tagsFilePath);
            return checkTagsFile(filePath); // call again after copying
        }

        const data = fs.readFileSync(filePath, "utf-8");
        let tagsObj: { tags: Tag[] };

        try {
            tagsObj = JSON.parse(data);
        } catch (err) {
            console.warn(`Tags file at ${filePath} is invalid. Resetting...`);
            copyExampleFile("tags.json", config.tagsFilePath);
            return checkTagsFile(filePath); // call again after copying
        }

        if (!tagsObj.tags || !Array.isArray(tagsObj.tags)) {
            console.warn(`Tags file at ${filePath} does not contain a valid 'tags' array. Resetting...`);
            copyExampleFile("tags.json", config.tagsFilePath);
            return checkTagsFile(filePath); // call again after copying
        }

        // File exists and is valid — print tags
        if (tagsObj.tags.length === 0) {
            console.info("No tags found in the file.");
        } else {
            console.info("Existing tags:");
            tagsObj.tags.forEach(tag => {
                console.log(chalk.hex(tag.color)(tag.name));
            });
        }

    } catch (err) {
        console.error(`Error checking tags file at ${filePath}:`, err);
        process.exit(1);
    }
}

export function copyExampleFile(sourceFile: string, destFile: string) {
    try {
        const rootDir = path.resolve(process.cwd(), ".examples");
        const sourcePath = path.join(rootDir, sourceFile);

        if (!fs.existsSync(sourcePath)) {
            console.error(`Source example file does not exist: ${sourcePath}`);
            return;
        }

        const destDir = path.dirname(destFile);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
            console.info(`Created destination directory: ${destDir}`);
        }

        fs.copyFileSync(sourcePath, destFile);
        console.info(`Copied example file from ${sourcePath} to ${destFile}`);
    } catch (err) {
        console.error(`Failed to copy example file from ${sourceFile} to ${destFile}:`, err);
    }
}