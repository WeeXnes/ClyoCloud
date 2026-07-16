# Changelog

All notable changes to this project will be documented in this file.

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
