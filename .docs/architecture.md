# Architecture & Design

This document details the internal systems, modules, and processes that power ClyoCloud.

---

## 1. Zero-Database Metadata Storage (Sidecars)

ClyoCloud does not use a SQL or NoSQL database engine. Instead, metadata is stored in **sidecar `.cloudinfo` JSON files** located directly adjacent to the resources.

### File Definitions
The interfaces are defined in [types/File.ts](file:///home/weexnes/CurClyo/types/File.ts):

*   **File Metadata (`FileMeta`)**:
    ```typescript
    export interface FileMeta {
        tags: Tag[];            // Array of Tag objects { name, color }
        description?: string;   // User description
        isPublic?: boolean;     // Whether sharing is enabled
        isFavourite?: boolean;  // Starred items
    }
    ```

### Sidecar Location Logic
*   **For Files**: If a file is named `photo.jpg`, its metadata is written to `photo.cloudinfo` in the same directory. To avoid extremely long file names, the file name is capped: `${filename.substring(0, 100)}.cloudinfo`.
*   **For Folders**: If a directory is named `Holiday`, its metadata is written to `Holiday.cloudinfo` in its parent directory.

---

## 2. In-Memory Caching

Because reading and parsing hundreds of `.cloudinfo` JSON files from disk would bottleneck search queries and lists, ClyoCloud implements double-layered in-memory caching.

### A. Tag Cache Manager
Managed inside [server/utils/tagCache.ts](file:///home/weexnes/CurClyo/server/utils/tagCache.ts):

*   **Structure**: `Map<Username, Map<TagName, File[]>>`
*   **Initialization**: Rebuilt on server boot by reading all user directories (`rebuildTagCache()` in `server/utils/tagCache.ts` called by `server/plugins/init.ts`).
*   **Real-time Synchronization**:
    Instead of rescanning directories on mutations, API handlers trigger specific cache updates:
    *   `updateFileInCache(username, path, meta)`: Refreshes a file's tags.
    *   `removeFileFromCache(username, path)`: Evicts a file or directory tree.
    *   `moveFileInCache(username, oldPath, newPath)`: Modifies paths of renamed/moved resources.

### B. Directory Size Cache
Managed inside [server/utils/fileUtils.ts](file:///home/weexnes/CurClyo/server/utils/fileUtils.ts):

*   **Structure**: `Map<DirPath, { size, timestamp }>`
*   **TTL (Time-To-Live)**: 30 minutes.
*   **Invalidation**: When operations (uploads, moves, deletions) alter files, `clearSizeCache(dirPath)` is called. It recursively invalidates the size cache of the directory and all parent directories up to the root.

---

## 3. Media Processing (FFmpeg / FFprobe)

ClyoCloud uses `ffmpeg` and `ffprobe` to automatically generate thumbnails and previews for images and videos in the background.

### Workflow & Logic
Managed in [server/api/thumbnails-generate.post.ts](file:///home/weexnes/CurClyo/server/api/thumbnails-generate.post.ts):

1.  **Scanner**: Recursively finds image (`.png`, `.jpg`, `.jpeg`, `.gif`) and video (`.mp4`, `.webm`, `.mov`, `.mkv`) formats inside storage paths.
2.  **Workers**: Launches parallel workers matching the user's `maxConcurrentPreviews` configuration (defaults to `3`).
3.  **Image Resize**:
    *   If dimensions are already under `320x180` (verified via `ffprobe`), the file is copied directly to save CPU.
    *   Otherwise, it resizes the image applying a blur-padding filter to center the image on a standard `320x180` background.
4.  **Video Extraction**:
    *   Extracts a single video frame at `10%` of the video's duration (falls back to `50%` if duration is unreadable or extraction fails).
    *   Applies a complex filtergraph to crop, scale, and add a blurred background backdrop:
        `[0:v]scale=320:180:force_original_aspect_ratio=increase,crop=320:180,boxblur=15:1[bg];[0:v]scale=-1:180[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`
5.  **Task Status**: Tracks results in a global `Map` (via `server/utils/previewTask.ts`) exposing progress status (generated, skipped, errors) to the client dashboard in real-time.

---

## 4. Content Delivery & Range Streaming

*   **Raw File serving**: [server/routes/file/[...path].ts](file:///home/weexnes/CurClyo/server/routes/file/[...path].ts) checks permissions, resolves paths safely, logs the activity, and streams files with `createReadStream(resolvedPath)`. Renders inline for web-viewable mime-types (`image/`, `video/mp4`), else forces download headers.
*   **HTTP Range video streaming**: [server/routes/stream/[...path].ts](file:///home/weexnes/CurClyo/server/routes/stream/[...path].ts) handles range requests to support scrubbing and seek actions in web players:
    *   Looks up the incoming HTTP `Range` header (e.g., `bytes=20000-`).
    *   Calculates start/end byte coordinates.
    *   Replies with a `206 Partial Content` status.
    *   Returns only the sliced byte range stream: `createReadStream(resolvedPath, { start, end })`.

---

## 5. Background Task Runners

All tasks run asynchronously, returning a status handle to prevent blocking the HTTP server threat.

### A. Media Downloader (`yt-dlp`)
Managed in [server/utils/downloadManager.ts](file:///home/weexnes/CurClyo/server/utils/downloadManager.ts):
*   Spawns `yt-dlp` child processes in the background with detached states.
*   Configures `--progress-template` to extract download percentage, speed, and ETA from the command output.
*   Pipes stdout and stderr logs to an in-memory `Map` keyed by user, allowing clients to poll live console output.

### B. Duplicate Scanner
Managed in [server/api/storage-duplicates.get.ts](file:///home/weexnes/CurClyo/server/api/storage-duplicates.get.ts):
*   **Phase 1 (Indexing)**: Groups all user storage files by exact file size.
*   **Phase 2 (Hashing)**: Files sharing the same size are flagged as collision candidates. To optimize performance, the scanner avoids computing a full file hash. Instead, it reads and hashes only the first **64 KB** (`QUICK_HASH_SIZE`) using `MD5`.
*   **Phase 3 (Sorting)**: Colliding files are sorted by redundant space (e.g., `fileSize * (occurrenceCount - 1)`) and returned to the dashboard.

### C. Cleanable Space Finder
Managed in [server/api/storage-clean.get.ts](file:///home/weexnes/CurClyo/server/api/storage-clean.get.ts):
*   Iterates through user storage to locate:
    *   **Large Files**: Files larger than 500 MB (`LARGE_FILE_THRESHOLD`).
    *   **Old Files**: Files that have not been modified for over 180 days (`OLD_FILE_THRESHOLD`).
