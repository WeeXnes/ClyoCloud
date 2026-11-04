# Changelog

All notable changes to this project will be documented in this file.

## [2.21.0] - 2026-11-04

### Added
- **AI Wallpaper Pipeline (ComfyUI)**: Brought back the Wallpaper V2 pipeline from the `upscaling-pipeline` branch, rebuilt for the new design. ClyoCloud sends a JPG, PNG or WebP to a ComfyUI workstation, which outpaints it to 16:10, upscales it and keeps the original sharp in the centre. The 2880×1800 result is saved next to the source, tagged, and added to Wallpapers right away.
  - Uses the unchanged `wallpaper_v2_2880x1800` workflow (Realistic Vision V5.1 Inpainting, `SeamlessPadForOutpaint`, `ColorTransfer`, ESRGAN upscale, high-res centre composite) in `server/workflows/`.
  - Files: **Create Wallpaper (2880×1800)** in the context menu and file details; **Wallpaper** in the selection bar runs several images one at a time, with an option to apply the same settings to all remaining images, skip, and retry.
  - Scene presets (Indoor, Outdoor, Studio), selectable upscale model (read live from ComfyUI) and editable prompts.
  - **Settings → AI Wallpaper Pipeline**: ComfyUI URL with connection test (version, GPU), default model and scene. `COMFYUI_URL` sets a server-wide default.
  - API: `/api/pipeline/wallpaper-v2`, `/api/pipeline/status`, `/api/pipeline/models`, `/api/pipeline/test-connection`.
  - The `ComfyUI-EdgePad-Outpaint` custom node is bundled in `comfyui/custom_nodes/`, and the README explains the ComfyUI, model and network setup. `scripts/clyo_comfy_bridge.py` checks connectivity.

### Security
- The ComfyUI URL must be a plain `http(s)` address without credentials, query or fragment; redirects are not followed and error bodies are truncated.
- Source images must be inside the user's storage and outside the trash. Model names, scene presets and prompt lengths are validated on the server.
- One active job per user; outputs are size-limited, checked against the storage quota and disk headroom, and never overwrite an existing file.
- Job status is only visible to its owner (or an admin); other users get "not found".

## [2.20.0] - 2026-11-04

### Changed
- **Redesign**: The whole web interface follows a new monochrome design: a true black page, hairline dividers instead of shadows and boxes, white primary buttons, and colour only where it means something (status, tag colour, favourite). Applies to every page, including login, files, media, theatre, shorts, slideshow, collections, favorites, shared, trash, settings, admin, logs, downloader, duplicates, wallpapers and the public share page.
- **Themes**: There are now two themes, Dark (default) and Light, which is the same design inverted. The theme picker in Settings → Appearance has these two choices. Saved themes from earlier versions (`onedev`, `dracula`, …) show as Dark until you pick again.
- **Fonts**: Geist and Geist Mono are bundled with the app (`@fontsource-variable/geist`, `@fontsource-variable/geist-mono`), so the browser makes no outside font requests. Numbers use tabular figures so columns line up.
- **Navigation**: The sidebar is plain text with a ClyoCloud wordmark. Every page has the same 60px header and a centred content column up to 1120px wide.
- **Dashboard**: Storage, CPU and memory are shown as large numbers with hairlines between them. Drives, largest folders, shortcuts and recent activity are hairline lists.
- **Lists**: File lists, logs, shared files, collections, admin lists and duplicate groups use one bordered list with dividers between rows.
- **Tags**: Tags show as a small colour dot next to the name instead of a filled coloured pill.
- **Status**: Toasts, logs, the admin panel and the downloader show status as a small coloured dot next to text.
- **Admin charts**: The traffic chart, status-code chart and connection map use the theme colours and no longer animate.
- **Motion**: Transitions are 120ms fades on colour and opacity. Slide, scale and pulse effects are removed, and all motion is off when the system asks for reduced motion.
- **Accessibility**: Visible focus outline on every control, icon-only buttons have labels, and the dimmest text colour meets WCAG AA in both themes.

### Fixed
- **Search fields**: The search icon no longer overlaps the placeholder text in page headers.
- **Recycle Bin**: The page now has the menu button on phones, like every other page.

## [2.19.2] - 2026-10-30

### Fixed
- **Runtime Paths**: `STORAGE_PATH`, `MOVIES_PATH`, `SHOWS_PATH`, `THUMBNAIL_PATH`, `PREVIEW_PATH`, `USERS_FILE_PATH`, `TAGS_FILE_PATH` and `DEVICES_FILE_PATH` are now read when the server starts, and defaults use the home directory of the user running it. The build no longer contains the builder's paths, which also fixes AUR packages built by a different user. `NUXT_*` overrides still work and take priority.
- **PM2**: Removed the `undefined` path entries from `ecosystem.config.js`, which made PM2 drop those variables even when they were set in the shell.

### Changed
- All eight paths are now printed at startup, before anything is written.

### Upgrade Note
- Path variables set during `npm run build`, including from a `.env` file, are no longer used. If you relied on this, set them when starting the server (for example `node --env-file=.env .output/server/index.mjs`). Otherwise the server starts on an empty `~/.clyo` with a new admin account. Your existing data isn't touched.

## [2.19.1] - 2026-10-30

### Security
- **Downloader**: Only `http` and `https` URLs are accepted, and the URL is always passed to `yt-dlp` after `--` so it can't be read as an option.
- **Download Path**: `downloadPath` must stay inside the user's storage, both when saved and when used.
- **Trash**: Receipts in `.trash/metadata.json` are validated on load, so stored names can't point outside the trash. The general file APIs can no longer write into `.trash`.
- **Rate Limiting**: `X-Forwarded-For` is only honored from trusted proxies (loopback, plus the new `TRUSTED_PROXIES` setting) and read from the right. Loopback is no longer exempt.
- **Login Limits**: Added per-account limits for password and 2FA attempts. A successful login no longer clears earlier failures from the same IP.
- **Default Admin Removed**: Removed the example `users.json`. First start now creates an admin with a random password, printed once. The server warns if an account still uses the old example password.
- **Corrupt Users File**: The server now refuses to start on a damaged `users.json` instead of replacing it, which deleted every account.
- **CI**: Builds only run on `master` (pull request and other branch builds are disabled), dependencies install with `npm ci` from a committed `package-lock.json`, and `vue` and `vue-router` are pinned.

### Fixed
- **Atomic Writes**: `users.json` and `devices.json` are written atomically and updated under a per-file lock, preventing corruption and lost updates.
- **Recovery Codes**: A recovery code can no longer be used twice by concurrent requests.
- **Change Password**: A wrong current password now returns 403 instead of 500.

### Changed
- `npm test` now runs in CI instead of only the security suite, and added `tests/hardening.spec.ts`.

## [2.19.0] - 2026-10-19

### Changed
- **Version Bump & Streamlined Architecture**:
  - Version bump to `2.19.0` due to removal of previous experimental features (such as Advanced Image Search and OPLNova PS2 Game Manager).
  - Raised version number to ensure repository workflows and downstream package maintainers (including AUR packages) receive an updated higher release.
  - Streamlined the architecture to the clean, performant, and hardened baseline with complete Recycle Bin management, two-phase SHA-256 duplicate verification, and full security protections intact.

## [2.15.0] - 2026-10-05

### Added
- **Recycle Bin Web UI & Batch Management**:
  - Added dedicated `/trash` route (`pages/trash.vue`) featuring live search, multi-select, batch restoration, batch permanent deletion, and empty trash confirmation modal.
  - Added direct sidebar navigation link to the Recycle Bin under Storage Management in `app.vue`.
  - Updated backend endpoints (`/api/trash.delete.ts`, `/api/trash-restore.post.ts`) to seamlessly support array-based batch operations as well as single-item IDs.
- **HTTP Caching for Thumbnails & Animated Video Previews**:
  - Implemented centralized `handleHttpCache()` utility (`server/utils/httpCache.ts`) generating `ETag` (from file size and mtime) and `Last-Modified` timestamps.
  - Configured conditional `304 Not Modified` responses with `Cache-Control: public, max-age=86400, stale-while-revalidate=604800` across authenticated and public thumbnail/preview routes (`server/routes/thumbnail/[...path].ts`, `server/routes/preview/[...path].ts`, `server/routes/p/thumbnail/[username]/[...path].ts`, `server/routes/p/preview/[username]/[...path].ts`).
- **Photo Widgets Endpoint & Metadata Integration**:
  - Added `server/api/photo-widgets.get.ts` endpoint enabling native wallpaper/widget retrieval.
  - Extended `types/File.ts` and `server/api/file-meta.post.ts` to support reading and persisting `isPhotoWidget` metadata.

### Fixed
- **Variable Scoping in Wallpapers & Favorites APIs**:
  - Resolved `ReferenceError: baseName is not defined` and `dirName is not defined` in `server/api/wallpapers.get.ts` and `server/api/favorites.get.ts`.

### Security
- **Protected Endpoints Expansion**:
  - Added `/trash`, `/api/trash`, `/api/trash-restore`, and `/api/photo-widgets` to the automated endpoint security protection suite (`tests/security.spec.ts`).

## [2.14.0] - 2026-10-05

### Security
- **Two-Phase Duplicate File Verification**:
  - Replaced single-pass 64 KB MD5 checksums in duplicate scanner (`server/api/storage-duplicates.get.ts`) with a two-phase check: 64 KB quick-hash candidate filtering followed by full streaming SHA-256 verification of whole file contents, preventing false positives and data loss from files sharing identical headers or MD5 collisions.
- **Current Password Verification on Password Change**:
  - Updated `server/api/change-password.post.ts` to require and verify `currentPassword` against `bcrypt.compare()` before updating account passwords, preventing account takeover via active sessions. Added current password confirmation field to `pages/settings.vue`.
- **At-Rest 2FA Secret Encryption & Emergency Recovery Codes**:
  - Implemented AES-256-GCM encryption for TOTP secrets stored in `users.json` with backward-compatible legacy decryption (`server/utils/twoFactor.ts`).
  - Added generation and SHA-256 hashed storage of 8 single-use recovery scratch codes upon 2FA enrollment.
  - Added support for verifying and consuming recovery codes in `server/api/2fa/verify-login.post.ts` and `server/api/2fa/disable.post.ts`.
  - Added emergency recovery code login workflow to `pages/login.vue` and recovery codes copy modal in `pages/settings.vue`.
  - Removed plaintext secret logging from `server/api/2fa/setup.get.ts`.
- **Host Disk Headroom & Per-User Storage Quota Enforcement**:
  - Introduced `server/utils/storageQuota.ts` with host disk headroom checks via `fs.statfs()` and per-user storage quota enforcement.
  - Integrated headroom and quota verification into upload handling (`server/api/upload.post.ts`) and remote downloads (`server/api/download.post.ts`), preventing host disk exhaustion and system denial of service.

### Added
- **Recycle Bin & Soft-Delete Trash Mechanism**:
  - Implemented soft-delete mechanism in `server/utils/trash.ts` and `server/api/files.delete.ts`, safely moving deleted files and their `.cloudinfo` sidecars into `.trash/` with JSON metadata receipts.
  - Added `/api/trash` and `/api/trash-restore` endpoints for inspecting, restoring, permanently deleting, and emptying trash.
  - Added automatic background purging of trashed items older than 30 days.

### Fixed
- **.cloudinfo Filename Truncation Inconsistency**:
  - Standardized `.cloudinfo` lookup across reading endpoints (`files.get.ts`, `tagCache.ts`, `fileUtils.ts`, `favorites.get.ts`, `wallpapers.get.ts`) to use full file paths instead of truncating at 100 characters, preventing metadata loss and orphaned files for long filenames, while retaining legacy fallback.
- **Path Corruption Bug via Substring `.replace()`**:
  - Fixed path manipulation in `favorites.ts`, `wallpapers.ts`, and `tagCache.ts` to use exact prefix slicing (`newPath + path.slice(oldPath.length)`) instead of naive string `.replace()`, preventing corruption of folders that share names with parent directories.
- **Bulk Download Handling on Filenames Containing Commas**:
  - Updated `server/api/bulk-download.get.ts` to support JSON-encoded file lists and repeated query parameters with comma-split fallback.
  - Updated `pages/files/[...path].vue` to pass selected filenames as JSON arrays, preventing comma-containing filenames from being split into invalid fragments.

## [2.13.2] - 2026-08-16

### Fixed
- **Dashboard Initial Load & Responsiveness**:
  - Fixed syntax issue in template closing tags on the dashboard page (`pages/index.vue`).
  - Switched dashboard initial and background data retrieval (`/api/stats`, `/api/activity`, `/api/storage-map`) to resilient asynchronous resolution via `Promise.allSettled()`, preventing any delayed or failing sub-request from hanging or blocking UI interactivity and tab switching.

## [2.13.1] - 2026-07-22

### Changed
- **Mobile Responsive Wallpapers Layout & UI Refinements**:
  - Restructured `/wallpapers` header for seamless responsiveness on mobile screens (`flex-col md:flex-row`), avoiding squishing of search and control buttons.
  - Replaced the remove wallpaper icon badge with a clean `X` symbol (`mdi:close`).
  - Removed image viewer modal, allowing direct single-click navigation to the file's parent directory in My Files while retaining the open folder shortcut button.

## [2.13.0] - 2026-07-22

### Added
- **Exported Wallpapers Management View**: Added dedicated `/wallpapers` view allowing users to instantly view all exported wallpapers across their cloud storage with real-time searching and direct removal of wallpaper export status without deleting original image files.
- **Navigation Update**: Added "Wallpapers" quick link in the sidebar under Library section.

## [2.12.9] - 2026-07-20

### Fixed
- **JWT Secret Read-Only Config Error**: Resolved an `unhandledRejection TypeError: Cannot assign to read only property 'jwtSecret'` crash on every startup. Nuxt 3's `useRuntimeConfig()` returns a frozen (read-only) proxy in production builds, so the resolved JWT secret can no longer be written back to `config.jwtSecret`. Introduced `server/utils/jwtConfig.ts` — a module-level singleton with `setJwtSecret` / `getJwtSecret`. The `init.ts` plugin calls `setJwtSecret()` during startup, and all auth consumers (`auth.ts` middleware, `login.post.ts`, `verify.get.ts`, `user-qr.get.ts`, `2fa/verify-login.post.ts`) now call `getJwtSecret()` instead.

## [2.12.7] - 2026-07-20

### Fixed
- **Nuxt Environment Variable Compatibility**: Added explicit support for `NUXT_JWT_SECRET` alongside `JWT_SECRET` in `init.ts`, preserving complete compatibility with all Nuxt 3 environment variable override conventions.

## [2.12.6] - 2026-07-20

### Security
- **File-Based JWT Secret Support**: Added support for configuring a persistent custom JWT secret via a `jwt.secret` file inside the configuration directory (`~/.clyo/jwt.secret`). If present, the secret is loaded automatically, skipping ephemeral rolling and preserving device session records across server restarts.

## [2.12.5] - 2026-07-20

### Security
- **Device Database Cleanup**: Automatically clears the authorized devices database (`devices.json`) on server startup whenever a fresh ephemeral JWT secret is rolled. Since rolling a new secret invalidates all existing user/device tokens, clearing this file avoids leaving orphaned, inactive device session records.

## [2.12.4] - 2026-07-20

### Added
- **Security Console Logs**: Improved startup console logging in the init plugin to print distinct status indicators detailing whether a custom JWT secret or a secure randomly generated ephemeral key is being used.

## [2.12.3] - 2026-07-20

### Security
- **Auto-Generated JWT Secret**: Implemented automatic generation of a secure random 32-character JWT secret in memory if none is set in the environment or config. The secret is rolled fresh on every server startup, ensuring absolute security by default out of the box.

## [2.12.2] - 2026-07-20

### Fixed
- **Mobile Responsive Donut Chart**: Redesigned the Status Code Donut Chart container and legend elements inside the Admin Panel to stack vertically on mobile layouts and line up legend items horizontally, preventing card overflow.

## [2.12.1] - 2026-07-20

### Fixed
- **Activity Log Persistence**: Relocated user activity log storage path from user media storage folders (`.clyo/data/<username>/.activity.json`) to the central configuration directory (`.clyo/activity_<username>.json`). This prevents logs from being wiped by external media sync tools, cron cleanups, or backup scripts that target and clean up hidden files.

## [2.12.0] - 2026-07-20

### Added
- **IP Traffic Inspector**: Multi-dimensional inspector sub-page for client IP addresses, showing geolocation, traffic share, block status, and a real-time HTTP request log.
- **Solid Vector World Map**: Replaced dotted map representation with stylized solid vector continents, dynamic latitude/longitude grids, and pulsating client geolocation markers.
- **Secure Traffic Indicators**: Implemented `isAuth` indicator logs to highlight authenticated requests inside the IP inspector table with a lock icon.

## [2.11.0] - 2026-07-20

### Added
- **Admin Dashboard** (`/admin`): Premium admin-only control panel with real-time traffic charts, rate limit status, user management, device overview, security event log, and server diagnostics.
- **Admin Role System**: Users can now be designated as administrators via `isAdmin: true` in `users.json`. The admin flag is propagated through the auth middleware and sidebar navigation.
- **Rate Limiting**: In-memory sliding-window rate limiter protecting sensitive endpoints:
  - Login + 2FA: 5 attempts per 15 minutes, 15-minute block on exceeded
  - QR Code generation: 10 attempts per 5 minutes
  - General API: 200 requests per minute per IP
- **Traffic Tracking**: Real-time in-memory traffic metrics collector tracking requests per minute, status code distribution, top endpoints, and top client IPs.
- Added `/api/admin/stats` and `/api/admin/activity` admin-only API endpoints.
- Activity logging for QR code generation (`QR_GENERATE`), device registration (`DEVICE_REGISTER`), and device revocation (`DEVICE_REVOKE`).

### Security
- All rate-limited endpoints return `429 Too Many Requests` with human-readable retry-after messages.
- Admin API endpoints are guarded by `isAdmin` check — non-admin users receive `403 Forbidden`.
- Rate limiters automatically reset on successful authentication to avoid penalizing legitimate users.
- Stale rate limit entries are automatically cleaned up every 5 minutes to prevent memory leaks.
- Added admin endpoints to security regression test suite.

---

## [2.10.0] - 2026-07-20

### Added
- Implemented Device-Specific Session Revocation for companion mobile applications. QR code logins now issue distinct JWT tokens linked to a unique device session in `devices.json`.
- Added support for displaying device models (e.g. Pixel 7 Pro) and audit metrics on the web dashboard settings page.
- Added `/api/devices` GET and DELETE endpoints to review and revoke mobile client sessions.
- Integrated `X-Device-Model` client headers in companion applications `ClyoWallpaper` and `ClyoCloudAndroid`.

### Security
- Hardened token authorization checks in both server middleware and `/api/verify` to ensure active device sessions still exist, automatically blocking revoked tokens.
- Restructured `/api/verify` token validation to enforce user account existence checks and reject incomplete 2FA login steps (`isPartial` tokens).
- Upgraded the security middleware and token parser to support case-insensitive HTTP Bearer authentication headers.

---

## [2.9.0] - 2026-07-19

### Added
- Implemented App Quick Login QR Code flow. Logged-in users can generate a QR code containing server URL, username, and token settings.
- Added `/api/user-qr` endpoint to generate app quick connection QR codes.
- Updated `/api/verify` endpoint to accept JWT authentication token via HTTP `Authorization: Bearer <token>` header.

---

## [2.8.2] - 2026-07-19

### Fixed
- Fixed backend shorts feed generation on the `/api/videos` endpoint to perform properly random shuffling of the source video and slideshow directories.

---

## [2.8.1] - 2026-07-17

### Added
- Added server initialization log to print when a custom JWT secret is configured, showcasing the start of the secret as a confirmation teaser.

---

## [2.8.0] - 2026-07-17

### Added
- Implemented Wallpapers Integration allowing users to mark image files as wallpapers for fetching directly by mobile clients/Android app.
- Added `/api/wallpapers` endpoint to retrieve all marked wallpapers.
- Integrated wallpaper toggle controls into files explorer list, grid, context menus, and favorites page sidebar.

### Security
- Protected `/api/wallpapers` with JWT token authorization middleware and verified access control in security integration tests.

---

## [2.7.3] - 2026-07-16

### Fixed
- Fixed layout clipping and right-overflow in the Media player page under the Media tab on mobile screens by making the action buttons container flex-wrap.

---

## [2.7.2] - 2026-07-16

### Fixed
- Fixed mobile tags drawer rendering glitch by separating the backdrop overlay as a sibling, avoiding CSS containing block issues on transform.
- Fixed scrolling height bug where the drawer tags list did not scroll to the bottom immediately by applying `flex-1 min-h-0` to the scrollable container.

---

## [2.7.1] - 2026-07-16

### Fixed
- Fixed mobile tags drawer rendering corners issue by separating scrollable overflow from outer rounded wrapper.
- Repositioned tags drawer container to reside directly in the outer modal container, preventing container flex-alignment clipping.
- Enhanced glassy appearance of the tags drawer with a semi-translucent backdrop style (`bg-slate-950/40` and `backdrop-blur-2xl`).

---

## [2.7.0] - 2026-07-16

### Added
- Added a gesture-driven mobile tags drawer menu in the media viewer (slide up to open, slide down or click backdrop to close).
- Added a clickable Tag icon button in the desktop/mobile media viewer header for direct, tap-based tags drawer management.

---

## [2.6.0] - 2026-07-16

### Added
- Added "Image Viewer Mobile Fullscreen" option in the settings.
- Automatically request fullscreen when opening a file in the new media viewer on mobile viewports.
- Automatically exit fullscreen when leaving/closing the media viewer on mobile viewports.

---

## [2.5.2] - 2026-07-16

### Fixed
- Redesigned the primary page header navigation to dynamically stack into a clean vertical list on mobile viewports, preventing search fields and quick actions from clipping out of the screen.
- Compacted the image/media viewer header overlay controls, padding, and labels on mobile to prevent clipping and improve usability on small devices.

---

## [2.5.1] - 2026-07-16

### Fixed
- Fixed mobile image viewer size boundaries to fit strictly within the viewport width and height (`100dvw` / `100dvh`), preventing it from expanding the viewport or clipping elements off-screen.
- Added smooth horizontal slide transitions when cycling through files using swipe gestures or navigation controls.

---

## [2.5.0] - 2026-07-16

### Added
- Implemented a fully functional Media Viewer supporting images, animated GIFs, and inline video playback, replacing the simple image lightbox.
- Added desktop keyboard controls (left/right arrows) and mobile swipe gestures (left/right) to cycle through media files in the current folder.
- Integrated quick actions to favorite/unstar and download files directly from the viewer overlay, alongside a parent-folder tracking sub-label.
- Enabled thumbnail rendering support for GIF files in the file explorer list and grid views.

---

## [2.4.8] - 2026-07-16

### Changed
- Standardized all internal page headers to match the dashboard and settings design system, featuring a visually matching icon wrapper with a subtle border and secondary typography alignment.
- Removed tech-heavy terms ("tachy speech") across the application, changing "URL integrations" to "Web Downloads" on the dashboard, and simplifying "Compiler Task Feeds", "Previews compilation", etc. in the Settings page to more user-friendly terminology.

---

## [2.4.7] - 2026-07-16

### Added
- Cached host CPU cores and dynamic concurrency max limit calculations at the server module level so that resource checks are computed once on server startup rather than on every endpoint execution.
- Added a sleek loading skeleton to the Settings Media Processing submenu to eliminate any layout shifting while user settings are loading.

---

## [2.4.6] - 2026-07-16

### Fixed
- Fixed concurrency thread slider max limit dynamically matching the host OS hardware capacity (cores count and safety ceilings), removing the need for manual experimental configuration toggle.

---

## [2.4.5] - 2026-07-16

### Added
- Implemented dynamic concurrency scaling based on the system's actual CPU core count (using `Math.min(Math.max(cores * 2, 4), 32)`) to safely maximize processing throughput without exceeding OS process/file descriptor limits.

---

## [2.4.4] - 2026-07-16

### Fixed
- Fixed high CPU load and website unresponsiveness during bulk thumbnail/preview generation by running ffmpeg and ffprobe sub-processes with low process priority (`nice -n 19` on UNIX/Linux systems).
- Enforced a safe maximum server-side concurrency limit of 8 for both preview and thumbnail background tasks to prevent disk I/O thrashing and memory exhaustion.

---

## [2.4.3] - 2026-07-16

### Added
- Persisted settings sub-category navigation state in URL query parameters (`?cat=`) to prevent reloading from resetting the navigation back to the main menu.

---

## [2.4.2] - 2026-07-16

### Fixed
- Fixed a rendering crash on the System Status dashboard for users with empty storage (no uploaded files).
- Fixed a username load flicker in the welcome banner by loading user data from global state during page hydration instead of waiting for the stats API.

### Optimized
- Optimized cold start response time and polling overhead by caching dynamic hardware stats (CPU, RAM, mounted drives) and pre-warming the cache on startup.
- Implemented a real-time invalidation mechanism that immediately updates dashboard size stats and storage map allocations upon file uploads, deletions, renames, moves, folder creations, and remote downloads.

---

## [2.4.0] - 2026-07-10

### Changed
- Redesigned the System Status Dashboard to include interactive SVG radial progress gauges, circular CPU/RAM dials, and a console-like activity timeline.
- Redesigned the user Settings page into a list-styled category navigation view with unified menu hierarchy and back headers on both desktop and mobile.

### Added
- Added a user-configurable Duplicate Scan Limit setting (10 to 1000 range) in System settings to control backend duplicates query slice bounds dynamically.

---

## [2.3.0] - 2026-07-03

### Added
- Added custom folder icon support, allowing users to designate any image file as a folder's cover or preview thumbnail.
- Added a folder symbol overlay on custom folder icons to distinguish folders from individual images.
- Added a "Reset Folder Icon" context menu option to restore default folder styling.
- Added directory monitoring and audit trail logs tracking custom folder icon changes.

---

## [2.2.1] - 2026-07-01

### Security
- Improved token authentication middleware to verify that user accounts still exist in `users.json` prior to granting API access.

---

## [2.2.0] - 2026-06-30

### Added
- Added a path exclusion list in user settings to hide specific directories and their contents from appearing in the Media tab.
- Added an "Exclude Folder" option directly inside the media view header.

---

## [2.1.1] - 2026-06-30

### Fixed
- Fixed an indexing and display bug inside the media tab view.

---

## [2.1.0] - 2026-06-30

### Fixed
- Fixed interactive behaviors, autoplay configurations, and state transitions in the Shorts player.

---

## [2.0.4] - 2026-06-30

### Fixed
- Fixed playback glitches and layout alignment errors in the Shorts view.

---

## [2.0.3] - 2026-06-30

### Fixed
- Fixed minor runtime errors.

---

## [2.0.2] - 2026-06-30

### Added
- Added foundational user and developer documentation.

### Changed
- Improved video tagging options and metadata handling inside the Shorts feed.

---

## [2.0.1] - 2026-06-29

### Added
- Added support for generating static fallback thumbnails during bulk video preview generation.

---

## [2.0.0] - 2026-06-28

### Changed
- First stable release.

---

## [1.0.0] - 2026-06-28

### Added
- Added root directory delete protection to prevent accidental removal of storage mount points.
- Added automated tests for storage validation.
- Added CI/CD release triggers on build completion.

---

## [ae6f049] - 2026-06-28

### Added
- Added Theatre Mode, providing an experimental, Jellyfin-inspired media interface designed for watching movies.
- Added responsive layout enhancements for media previews.

---

## [86a67fe] - 2026-06-24

### Added
- Added dynamic Nuxt page meta configuration.

### Fixed
- Fixed minor layout and visual rendering issues in navigation components.

---

## [be45b9f] - 2026-06-23

### Security
- Improved server route parameters to protect against directory traversal vectors.

---

## [da79887] - 2026-06-15

### Added
- Added custom tagging capabilities for all items.
- Added Collections support to group assets.
- Added client-side caching for collections to reduce fetch overhead.

---

## [bcea3ca] - 2026-06-12

### Added
- Added ProgressManager to track ongoing background tasks.

### Changed
- Improved vertical video navigation and looping logic in the Shorts tab.

---

## [cc78c6f] - 2026-06-04

### Changed
- Changed user interface layout, redesigning headers, side panels, and responsive breakpoints.

### Improved
- Improved application themes and CSS styles.
- Improved Vitest unit test suite.

---

## [76e76c5] - 2026-05-22

### Changed
- Improved list rendering and performance for large directories.

---

## [7793aac] - 2026-05-21

### Added
- Added hovering video preview generation.
- Added asynchronous bulk preview generation.

---

## [9777b28] - 2026-05-14

### Added
- Added experimental TV layout mode supporting larger grid views and simplified keyboard-friendly navigation.

### Changed
- Improved rendering performance on iOS devices.

---

## [b254029] - 2026-05-13

### Added
- Added file move and copy functionality directly inside the file browser.
- Added vertical video feed Shorts browser.
- Added browser file list caching and folder preloading.

---

## [b8fb87c] - 2026-05-12

### Added
- Added dedicated tabs for Shared files and Favorite items.

### Changed
- Changed JWT session duration to 30 days for persistent logins.

---

## [08d811e] - 2026-04-27

### Added
- Added automated build specifications for CI pipelines.
- Added API validation test cases covering directory traversal and authorization breaches.

---

## [74e9d4d] - 2026-04-26

### Added
- Added System Info and hardware monitor widgets displaying host CPU and RAM utilization.

### Changed
- Changed user interface design with a visual overhaul.
- Changed background downloader process settings.

---

## [6b6019d] - 2026-04-24

### Added
- Added support for adding editable text descriptions to files.
- Added notification system.

### Changed
- Changed metadata management to portable .cloudinfo sidecar files stored adjacent to media files.

---

## [448e24d] - 2026-04-23

### Added
- Added gallery-dl backend support for batch image downloads.
- Added option to bundle directories into dynamic ZIP archives for bulk downloads.
- Added file deletion endpoints.
- Added image viewer lightbox supporting zoom and modal slideshow.

---

## [9b50b0d] - 2025-11-12

### Added
- Added directory creation options.
- Added simple tag metadata indicators.

---

## [7283d1d] - 2025-10-27

### Added
- Added file layout preferences (grid vs list toggle) persisting via browser cookies.
- Added dedicated page routing structures for Media Mode.

---

## [d593d5e] - 2025-10-01

### Added
- Added Media Browser module.
- Added basic tag filtering and textual file search functionality.

---

## [ec9e957] - 2025-08-05

### Added
- Added JWT token-based API authentication.
- Added multi-user support with separated workspaces and user-specific home storage mounts.

---

## [bb9d2f3] - 2025-07-26

### Added
- Added range-aware video streaming support.
- Added asynchronous thumbnail extraction using ffmpeg and ffprobe.
- Added file upload endpoints and client-side UI handlers.

---

## [7474c0e] - 2025-07-25

### Added
- Added initial project repository structure.
