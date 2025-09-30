import fs from "fs/promises";
import path from "path";

export interface File {
    name: string;
    size: number;
    type: string;
    meta: FileMeta;
    lastModified: number;
    isFolder: boolean;
}

export interface FileMeta {
    tags: Tag[];
}

export interface Tag {
    name: string;
    color: string;
}


export interface Video {
    name: string;
    meta: FileMeta;
    size: number;
    lastModified: number;
    fullPath: string;
}

/**
 * Recommends files based on shared tags with the input file
 * @param inputFile - The file to base recommendations on
 * @param allFiles - Array of files to compare against
 * @param count - Number of recommendations to return
 * @returns Array of recommended files sorted by tag similarity
 */
export function recommendFiles(inputFile: File, allFiles: File[], count: number): File[] {
    // Filter out the input file from recommendations and folders
    const validFiles = allFiles.filter(file =>
        file.name !== inputFile.name && !file.isFolder
    );

    // Get input file tag names
    const inputTags = new Set(inputFile.meta.tags.map(tag => tag.name));

    // Calculate similarity scores based on shared tags
    const scoredFiles = validFiles.map(file => {
        const fileTags = new Set(file.meta.tags.map(tag => tag.name));
        const sharedTags = [...inputTags].filter(tag => fileTags.has(tag)).length;
        return { file, score: sharedTags };
    });

    // Sort by score (descending) and limit to requested count
    return scoredFiles
        .sort((a, b) => b.score - a.score)
        .slice(0, count)
        .map(item => item.file);
}


/**
 * Generates a random 20-character string
 * @returns A 20-character random string
 */
function generateRandomString(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 20; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}


/**
 * Recursively scans a directory for MP4 files and returns a HashMap of UUID to File objects
 * @param directoryPath - The root directory to scan
 * @returns Promise<Map<string, File>> - HashMap with UUID keys and File objects
 */
export async function scanMp4Files(directoryPath: string): Promise<Map<string, Video>> {
    const fileMap = new Map<string, Video>();

    async function scanDir(currentPath: string): Promise<void> {
        try {
            const entries = await fs.readdir(currentPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);

                if (entry.isDirectory()) {
                    // Recursively scan subdirectories
                    await scanDir(fullPath);
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.mp4')) {
                    // Process MP4 files
                    const stats = await fs.stat(fullPath);
                    const file: Video = {
                        name: entry.name,
                        size: stats.size,
                        meta: { tags: [] }, // Initialize with empty tags
                        lastModified: stats.mtimeMs,
                        fullPath: fullPath
                    };
                    fileMap.set(generateRandomString(), file);
                }
            }
        } catch (error) {
            console.error(`Error scanning ${currentPath}:`, error);
        }
    }

    await scanDir(directoryPath);
    return fileMap;
}