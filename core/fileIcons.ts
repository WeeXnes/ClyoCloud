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
    ".env": "vscode-icons:file-type-dotenv",
    ".gitignore": "vscode-icons:file-type-git",
    ".gitattributes": "vscode-icons:file-type-git",
    ".dockerignore": "vscode-icons:file-type-docker",

    // Code
    "c": "vscode-icons:file-type-c",
    "cpp": "vscode-icons:file-type-cpp",
    "h": "vscode-icons:file-type-c",
    "hpp": "vscode-icons:file-type-cpp",
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
    "ps1": "vscode-icons:file-type-powershell",
    "bat": "vscode-icons:file-type-shell",
    "cmd": "vscode-icons:file-type-shell",
    "vue": "vscode-icons:file-type-vue",
    "v": "vscode-icons:file-type-vlang",

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
    "toml": "vscode-icons:file-type-toml",

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
    "ini": "vscode-icons:file-type-ini",
    "conf": "vscode-icons:file-type-config",

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
    "psd": "vscode-icons:file-type-photoshop",
    "ai": "vscode-icons:file-type-ai",
    "eps": "vscode-icons:file-type-image",

    // Video
    "mp4": "subway:media",
    "mkv": "subway:media",
    "mov": "subway:media",
    "avi": "subway:media",
    "webm": "subway:media",
    "flv": "subway:media",
    "wmv": "subway:media",
    "3gp": "subway:media",

    // Audio
    "mp3": "wpf:audio-wave",
    "wav": "wpf:audio-wave",
    "flac": "wpf:audio-wave",
    "ogg": "wpf:audio-wave",
    "m4a": "wpf:audio-wave",
    "aac": "wpf:audio-wave",

    // Archives
    "zip": "vscode-icons:file-type-zip",
    "rar": "vscode-icons:file-type-zip",
    "7z": "vscode-icons:file-type-zip",
    "tar": "vscode-icons:file-type-zip",
    "gz": "vscode-icons:file-type-zip",
    "iso": "fxemoji:opticaldisc",

    // Fonts
    "ttf": "vscode-icons:file-type-font",
    "otf": "vscode-icons:file-type-font",
    "woff": "vscode-icons:file-type-font",
    "woff2": "vscode-icons:file-type-font",

    // Database
    "sqlite": "vscode-icons:file-type-sqlite",
    "db": "vscode-icons:file-type-sql",
    "sql": "vscode-icons:file-type-sql",

    // Others
    "default": "vscode-icons:default-root",
    "log": "vscode-icons:file-type-log",
    "bak": "vscode-icons:file-type-binary",
    "exe": "vscode-icons:file-type-binary",
    "efi": "vscode-icons:file-type-binary",
    "elf": "vscode-icons:file-type-binary",
    "dll": "vscode-icons:file-type-binary",
    "msi": "vscode-icons:file-type-binary",
    "bin": "vscode-icons:file-type-binary",
    "AppImage": "simple-icons:appimage",
    "appimage": "simple-icons:appimage",
    "dmg": "ic:baseline-apple",
    "pkg": "vscode-icons:file-type-binary",
    "apk": "material-icon-theme:android",
    "deb": "vscode-icons:file-type-debian",
    "rpm": "logos:redhat-icon",
    "jar": "vscode-icons:file-type-jar",
    "war": "vscode-icons:file-type-jar",
};


export function getIconForExtension(input: string): string {
    const cleanInput = input.startsWith("*.") ? input.slice(2) : input;

    if (iconLookup[cleanInput]) return iconLookup[cleanInput];

    const match = cleanInput.match(/\.([a-zA-Z0-9]+)$/);
    const ext = match ? match[1].toLowerCase() : cleanInput.toLowerCase();

    return iconLookup[ext] ?? "vscode-icons:default-root";
}
