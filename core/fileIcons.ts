const iconLookup: Record<string, string> = {
    // Build / Config
    "cmake": "vscode-icons:file-type-cmake",
    "CMakeLists.txt": "vscode-icons:file-type-cmake",
    "Makefile": "vscode-icons:file-type-makefile",
    "Dockerfile": "vscode-icons:file-type-docker",
    "package.json": "vscode-icons:file-type-npm",
    "yarn.lock": "vscode-icons:file-type-yarn",
    "vite.config.ts": "vscode-icons:file-type-vite",
    "webpack.config.js": "vscode-icons:file-type-webpack",
    "tsconfig.json": "vscode-icons:file-type-typescript-official",

    // Code
    "c": "file-icons:c",
    "cpp": "file-icons:c",
    "h": "file-icons:h",
    "hpp": "file-icons:h",
    "ts": "vscode-icons:file-type-typescript-official",
    "tsx": "vscode-icons:file-type-reactts",
    "js": "vscode-icons:file-type-js-official",
    "jsx": "vscode-icons:file-type-reactjs",
    "py": "vscode-icons:file-type-python",
    "java": "vscode-icons:file-type-java",
    "rb": "vscode-icons:file-type-ruby",
    "go": "vscode-icons:file-type-go",
    "rs": "vscode-icons:file-type-rust",
    "php": "vscode-icons:file-type-php",
    "cs": "vscode-icons:file-type-csharp",
    "swift": "vscode-icons:file-type-swift",
    "kt": "vscode-icons:file-type-kotlin",
    "sh": "vscode-icons:file-type-shell",

    // Web
    "html": "vscode-icons:file-type-html",
    "css": "vscode-icons:file-type-css",
    "scss": "vscode-icons:file-type-scss",
    "less": "vscode-icons:file-type-less",
    "json": "vscode-icons:file-type-json",
    "xml": "vscode-icons:file-type-xml",
    "yaml": "vscode-icons:file-type-yaml",
    "yml": "vscode-icons:file-type-yaml",
    "md": "vscode-icons:file-type-markdown",

    // Documents
    "txt": "vscode-icons:file-type-text",
    "pdf": "vscode-icons:file-type-pdf2",
    "doc": "vscode-icons:file-type-word",
    "docx": "vscode-icons:file-type-word",
    "xls": "vscode-icons:file-type-excel",
    "xlsx": "vscode-icons:file-type-excel",
    "csv": "vscode-icons:file-type-excel",
    "ppt": "vscode-icons:file-type-powerpoint",
    "pptx": "vscode-icons:file-type-powerpoint",

    // Images
    "png": "vscode-icons:file-type-image",
    "jpg": "vscode-icons:file-type-image",
    "jpeg": "vscode-icons:file-type-image",
    "gif": "vscode-icons:file-type-image",
    "bmp": "vscode-icons:file-type-image",
    "svg": "vscode-icons:file-type-svg",
    "webp": "vscode-icons:file-type-image",
    "ico": "vscode-icons:file-type-image",
    "heic": "vscode-icons:file-type-image",

    // Video
    "mp4": "vscode-icons:file-type-video",
    "mkv": "vscode-icons:file-type-video",
    "mov": "vscode-icons:file-type-video",
    "avi": "vscode-icons:file-type-video",
    "webm": "vscode-icons:file-type-video",
    "flv": "vscode-icons:file-type-video",

    // Audio
    "mp3": "vscode-icons:file-type-audio",
    "wav": "vscode-icons:file-type-audio",
    "flac": "vscode-icons:file-type-audio",
    "ogg": "vscode-icons:file-type-audio",

    // Archives
    "zip": "vscode-icons:file-type-zip",
    "rar": "vscode-icons:file-type-zip",
    "7z": "vscode-icons:file-type-zip",
    "tar": "vscode-icons:file-type-zip",
    "gz": "vscode-icons:file-type-zip",

    // Fonts
    "ttf": "vscode-icons:file-type-font",
    "otf": "vscode-icons:file-type-font",
    "woff": "vscode-icons:file-type-font",
    "woff2": "vscode-icons:file-type-font",

    // Database
    "sqlite": "vscode-icons:file-type-sqlite",
    "db": "vscode-icons:file-type-database",
    "sql": "vscode-icons:file-type-sql",

    // Others
    "log": "vscode-icons:file-type-log",
    "bak": "vscode-icons:file-type-binary",
    "exe": "vscode-icons:file-type-binary",
    "efi": "vscode-icons:file-type-binary",
    "elf": "vscode-icons:file-type-binary",
    "dll": "vscode-icons:file-type-binary",
    "msi": "vscode-icons:file-type-binary",
};


export function getIconForExtension(input: string): string {
    const cleanInput = input.startsWith("*.") ? input.slice(2) : input;

    if (iconLookup[cleanInput]) return iconLookup[cleanInput];

    const match = cleanInput.match(/\.([a-zA-Z0-9]+)$/);
    const ext = match ? match[1].toLowerCase() : cleanInput.toLowerCase();

    return iconLookup[ext] ?? "file-icons:default";
}