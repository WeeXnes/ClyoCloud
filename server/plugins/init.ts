import path from "path";
import fs from "fs";
import crypto from "crypto";
import {Tag} from "~/types/File";
import chalk from "chalk";
import readline from "readline";
import bcrypt from "bcryptjs";
import { setJwtSecret } from "~/server/utils/jwtConfig";

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

// Hash from the example users.json shipped in versions before 2.19.1
const LEGACY_DEFAULT_ADMIN_HASH = "$2a$12$8qYzByro8Ws1De5fZdDMW.heSdErztjUzGm1E3lq9HYCTP9h/k2Y6";

interface User {
    name: string;
    password: string;
}

/**
 * Resolves the JWT secret. Checks env, jwt.secret file, or runtime config before falling back
 * to generating a secure random 32-char ephemeral secret in-memory on every startup.
 */
function getOrGenerateJwtSecret(usersFilePath: string, currentSecret: string): string {
    const envSecret = process.env.JWT_SECRET || process.env.NUXT_JWT_SECRET
    if (envSecret && envSecret !== 'jei0ghjesi0ogj8ie0jg8093jg8390') {
        const secretStart = envSecret.slice(0, 4)
        console.info(chalk.green(`[SECURITY] Using custom JWT secret from environment (starts with: ${secretStart}...)`))
        return envSecret
    }

    const configDir = path.dirname(usersFilePath)
    const jwtSecretFile = path.join(configDir, 'jwt.secret')
    try {
        if (fs.existsSync(jwtSecretFile)) {
            const fileSecret = fs.readFileSync(jwtSecretFile, 'utf-8').trim()
            if (fileSecret.length > 0) {
                const secretStart = fileSecret.slice(0, 4)
                console.info(chalk.green(`[SECURITY] Using custom JWT secret from file ${jwtSecretFile} (starts with: ${secretStart}...)`))
                return fileSecret
            }
        }
    } catch (err) {
        console.error(`Failed to read ${jwtSecretFile}:`, err)
    }

    if (currentSecret && currentSecret !== 'jei0ghjesi0ogj8ie0jg8093jg8390') {
        const secretStart = currentSecret.slice(0, 4)
        console.info(chalk.green(`[SECURITY] Using custom JWT secret from config (starts with: ${secretStart}...)`))
        return currentSecret
    }

    const newSecret = crypto.randomBytes(24).toString('base64')
    console.info(chalk.cyan('[SECURITY] No JWT_SECRET configured. Automatically generated a secure random ephemeral secret key for this session.'))
    return newSecret
}

export default defineNitroPlugin(async (nitroApp) => {
    const config = useRuntimeConfig()
    console.info("Running server init...")
    console.info("Environment: ")
    console.info("Data Storage Path: " + config.storagePath)
    console.info("Movies Path: " + config.moviesPath)
    console.info("Shows Path: " + config.showsPath)
    console.info("Thumbnail Storage Path: " + config.thumbnailPath)
    console.info("Preview Storage Path: " + config.previewPath)
    console.info("Users JSON Path: " + config.usersFilePath)
    console.info("Tags JSON Directory: " + path.dirname(config.tagsFilePath))
    console.info("Devices JSON Path: " + config.devicesFilePath)

    const configDir = path.dirname(config.usersFilePath)
    const jwtSecretFile = path.join(configDir, 'jwt.secret')
    const activeEnv = process.env.JWT_SECRET || process.env.NUXT_JWT_SECRET
    const hasCustomEnv = !!(activeEnv && activeEnv !== 'jei0ghjesi0ogj8ie0jg8093jg8390')
    const hasFileSecret = fs.existsSync(jwtSecretFile) && fs.readFileSync(jwtSecretFile, 'utf-8').trim().length > 0
    const hasConfigSecret = config.jwtSecret && config.jwtSecret !== 'jei0ghjesi0ogj8ie0jg8093jg8390'

    const isEphemeral = !hasCustomEnv && !hasFileSecret && !hasConfigSecret

    // Store the resolved secret in a module-level singleton.
    // We cannot write to config.jwtSecret because Nuxt 3's runtimeConfig
    // is a read-only (frozen) proxy in the production bundle.
    setJwtSecret(getOrGenerateJwtSecret(config.usersFilePath, config.jwtSecret))

    // Clear authorized devices database if using a fresh ephemeral key, since all existing tokens are now invalid
    if (isEphemeral) {
        try {
            if (fs.existsSync(config.devicesFilePath)) {
                fs.writeFileSync(config.devicesFilePath, '{}', 'utf-8')
                console.info(chalk.yellow('[SECURITY] Wiped devices.json database because a new ephemeral JWT secret was generated.'))
            }
        } catch (err) {
            console.error('Failed to wipe devices.json on ephemeral key generation:', err)
        }
    }

    console.info("Initializing media backend...")
    createDirIfNotExists(config.storagePath)
    createDirIfNotExists(config.thumbnailPath)
    const usernames = checkUserFile(config.usersFilePath) || []

    const tagsDir = path.dirname(config.tagsFilePath)
    for (const username of usernames) {
        const userTagsPath = path.join(tagsDir, `tags_${username}.json`)
        checkUserTagsFile(userTagsPath, username)
    }

    // Build the tag cache in the background
    rebuildTagCache();
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

/**
 * First run only: creates an admin with a random password, printed once to the console.
 */
function createInitialAdmin(filePath: string) {
    const password = crypto.randomBytes(18).toString("base64url");
    const users = [{ name: "admin", password: bcrypt.hashSync(password, 12), isAdmin: true }];

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2), { encoding: "utf-8", mode: 0o600, flag: "wx" });

    console.info(chalk.yellow(`[SECURITY] Created ${filePath} with an initial admin account.`));
    console.info(chalk.yellow(`[SECURITY] Username: admin  Password: ${password}`));
    console.info(chalk.yellow(`[SECURITY] This password is only shown once. Change it after your first login.`));
}

export function checkUserFile(filePath: string) {
    try {
        if (!fs.existsSync(filePath)) {
            createInitialAdmin(filePath);
        }

        // Never overwrite a damaged users file: that would delete every account
        let users: { name: string; password: string }[];
        try {
            users = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        } catch (err) {
            console.error(`Fatal: Users file at ${filePath} is not valid JSON. Restore it from a backup or fix it by hand.`);
            process.exit(1);
        }

        if (!Array.isArray(users)) {
            console.error(`Fatal: Users file at ${filePath} is not an array. Restore it from a backup or fix it by hand.`);
            process.exit(1);
        }

        const invalidUsers = users.filter(u => {
            return !u.password || typeof u.password !== "string" || !BCRYPT_HASH_REGEX.test(u.password);
        });

        if (invalidUsers.length > 0) {
            console.error(`Fatal: Users file at ${filePath} has ${invalidUsers.length} user(s) with invalid password hashes. Restore it from a backup or fix it by hand.`);
            process.exit(1);
        }

        if (users.some(u => u.password === LEGACY_DEFAULT_ADMIN_HASH)) {
            console.warn(chalk.red(`[SECURITY] A user still has the password from the old example users.json, whose hash is public. Change it now.`));
        }

        const usernames = users.map(u => u.name);
        console.info("Existing users:", usernames.join(", "));
        return usernames;
    } catch (err) {
        console.error(`Error checking users file:`, err);
        process.exit(1);
    }
}

export function checkUserTagsFile(filePath: string, username: string) {
    const config = useRuntimeConfig();

    try {
        if (!fs.existsSync(filePath)) {
            console.info(`Tags file not found for user "${username}" at ${filePath}, copying example file...`);
            copyExampleFile("tags.json", filePath);
        }

        if (!fs.existsSync(filePath)) {
            console.error(`Error: Predefined tags file for user "${username}" could not be initialized at ${filePath}`);
            return;
        }

        let data = fs.readFileSync(filePath, "utf-8");
        let tagsObj: { tags: Tag[] };

        try {
            tagsObj = JSON.parse(data);
        } catch (err) {
            console.warn(`Tags file for user "${username}" at ${filePath} is invalid. Resetting...`);
            copyExampleFile("tags.json", filePath);
            data = fs.readFileSync(filePath, "utf-8");
            tagsObj = JSON.parse(data);
        }

        if (!tagsObj.tags || !Array.isArray(tagsObj.tags)) {
            console.warn(`Tags file for user "${username}" at ${filePath} does not contain a valid 'tags' array. Resetting...`);
            copyExampleFile("tags.json", filePath);
            data = fs.readFileSync(filePath, "utf-8");
            tagsObj = JSON.parse(data);
        }

        // File exists and is valid — print tags
        if (tagsObj.tags.length === 0) {
            console.info(`No tags found in the file for user "${username}".`);
        } else {
            console.info(`Existing tags for user "${username}":`);
            tagsObj.tags.forEach(tag => {
                console.log(chalk.hex(tag.color)(tag.name));
            });
        }

    } catch (err) {
        console.error(`Error checking tags file for user "${username}" at ${filePath}:`, err);
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