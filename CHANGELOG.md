# Changelog

All notable changes to the **ClyoCloud** project are documented below.

---

## [2.3.0] - 2026-07-03

### Added
- Added custom folder icon support: users can now set any image as a folder's custom cover/preview icon via the context menu.
- Added option to reset custom folder icons to their default look.
- Added folder indicator overlay in the corner when a custom preview image is present.
- Added audit logging activity tracking when folder icons are changed.

---

## [2.2.3] - 2026-07-03

### Changed
- Bumped version to 2.2.3 (Version bump for bug fixes or AUR package rebuild).

---

## [2.2.2] - 2026-07-02

### Changed
- Bumped version to 2.2.2 (Version bump for bug fixes or AUR package rebuild).

---

## [2.2.1] - 2026-07-01

### Security
- Patched a security vulnerability and hardened core APIs.

---

## [2.2.0] - 2026-06-30

### Added
- Added support for specifying excluded directory paths in the media tab to filter out unwanted folders.

---

## [2.1.1] - 2026-06-30

### Fixed
- Fixed a bug affecting the media tab visibility and list behavior.

---

## [2.1.0] - 2026-06-30

### Fixed
- Resolved interactive behaviors and playback quirks in the Shorts video player.

---

## [2.0.4] - 2026-06-30

### Fixed
- Fixed alignment and scrolling behaviors for Shorts content.

---

## [2.0.3] - 2026-06-30

### Fixed
- Quick hotfix addressing miscellaneous runtime issues.

---

## [2.0.2] - 2026-06-30

### Added
- Added project documentation assets and guides.

### Changed
- Tweaked tag metadata management and behaviors in the shorts viewer.

---

## [2.0.1] - 2026-06-29

### Added
- Added capability to generate static thumbnails in bulk video preview generation tasks.

---

## [2.0.0] - 2026-06-28

### Changed
- **First Stable Release**: Promoted the codebase status and bumped version to 2.0.0 for production readiness.

---

## [1.0.0] - 2026-06-28

### Added
- **Initial Release** introducing the core features of ClyoCloud:
- **Root Delete Protection**: Prevented accidental deletion of vital storage roots alongside comprehensive testing.
- **Media Management**: Custom video previews, bulk thumbnail generation, tagging, and collection caching.
- **Shorts Player**: Vertical scrolling short-form video mode.
- **Performance & UI**: Complete UI overhaul, performance optimizations (specifically for iOS browsers), and theme corrections.
- **CI/CD Integration**: Added OneDev automation specs and build/release triggers.

---

## [ae6f049] - 2026-06-28

### Added
- Implemented Theatre Mode for an immersive media viewing experience.

---

## [86a67fe] - 2026-06-24

### Added
- Configured dynamic Nuxt page meta configuration.

---

## [be45b9f] - 2026-06-23

### Security
- Hardened server route handlers and validation methods.

---

## [da79887] - 2026-06-15

### Added
- Added Collections support to organize files into virtual groups.
- Added caching support for Collections to optimize retrieval speed.

---

## [eb9e81c] - 2026-06-15

### Added
- Added custom tagging functionality for files.

---

## [bcea3ca] - 2026-06-12

### Added
- Introduced ProgressManager to track ongoing background operations and thumbnail generation tasks.

---

## [7793aac] - 2026-05-21

### Added
- Added video preview generation features.
- Added support for bulk/batch preview generation to speed up library loading.

---

## [76e76c5] - 2026-05-22

### Changed
- Implemented frontend list performance optimizations.

---

## [9777b28] - 2026-05-14

### Added
- Implemented experimental TV layout mode for large-screen media navigation.

---

## [b254029] - 2026-05-13

### Added
- Added capability to move/rename files and directories from the browser.

---

## [a8e32ac] - 2026-05-13

### Added
- Initial implementation of the vertical-scrolling Shorts video player.

---

## [e8fbdad] - 2026-05-13

### Changed
- Optimized folder rendering and preloading logic in the file browser.

---

## [b8fb87c] - 2026-05-12

### Added
- Added Shared and Favorites views to the user interface.

---

## [316b896] - 2026-05-12

### Changed
- Extended valid authentication session token lifetime to 30 days.

---

## [5be6f23] - 2026-04-27

### Added
- Added OneDev CI/CD automation configuration buildspec file.

---

## [08d811e] - 2026-04-27

### Security
- Added automated endpoint security traversal testing.

---

## [05d488b] - 2026-04-27

### Added
- Added script to manage users via command-line interface.

---

## [74e9d4d] - 2026-04-26

### Changed
- Completed visual redesign and user interface overhaul.

---

## [d7d542e] - 2026-04-26

### Added
- Integrated system hardware status displays (CPU and RAM indicators).

---

## [d319bb6] - 2026-04-26

### Changed
- Reworked background downloader process with configurable paths in system settings.

---

## [284fd21] - 2026-04-24

### Added
- Added support for adding and displaying text descriptions on files.

---

## [6b6019d] - 2026-04-24

### Changed
- Migrated metadata storage to new `.cloudinfo` sidecar format.

---

## [18b98af] - 2026-04-24

### Added
- Completed initial notification system engine.

---

## [dcd479b] - 2026-04-24

### Added
- Implemented public sharing functionality to generate secure, unauthenticated URLs.

---

## [b5206b4] - 2026-04-24

### Added
- Integrated metadata tagging options directly within the file browser view.

---

## [448e24d] - 2026-04-23

### Added
- Integrated gallery-dl tools to handle batch photo downloads.

---

## [9b50b0d] - 2025-11-12

### Added
- Designed and added the lightbox image viewer modal component.

---

## [8dd0f0c] - 2025-11-13

### Added
- Added browser-side file deletion actions.

---

## [8fd5b9a] - 2025-11-06

### Added
- Added basic file tagging.

---

## [7283d1d] - 2025-10-27

### Added
- Created dedicated pages for Media Mode.

---

## [1f39dd7] - 2025-10-01

### Added
- Added search capabilities to the file browser.

---

## [d593d5e] - 2025-10-01

### Added
- Initialized media browser view.

---

## [2065d88] - 2025-08-05

### Added
- Implemented user-specific workspace directories.

---

## [ec9e957] - 2025-08-05

### Added
- Implemented JSON Web Token (JWT) based API authentication flow.

---

## [9b9412e] - 2025-07-26

### Added
- Added functional file uploading logic.

---

## [90634ac] - 2025-07-26

### Added
- Added range-aware video streaming support.

---

## [3e565f6] - 2025-07-26

### Added
- Implemented image and video thumbnail generation APIs.

---

## [c11a644] - 2025-07-25

### Added
- Initialized project documentation structure.

---

## [7474c0e] - 2025-07-25

### Added
- Repository initialization.
