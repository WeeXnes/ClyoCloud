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
    description?: string;
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


