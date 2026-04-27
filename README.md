# ClyoCloud

ClyoCloud is a personal, self-hosted cloud storage and media management application built for privacy and efficiency. It allows you to store, organize, stream, and share your files effortlessly from your own hardware.

## Features

- **Personal Cloud Storage**: Host your files securely on your own server.
- **Two-Factor Authentication (2FA)**: Secure your account with TOTP-based 2FA (e.g., Google Authenticator).
- **Favourites**: Star important files and folders for quick access in a dedicated view.
- **Activity Log**: Keep track of recent file operations directly from your dashboard.
- **Media Management**: Automatic thumbnail generation, metadata tagging, and description management for your media collection.
- **Video Streaming**: Built-in, range-aware video streaming with support for seamless playback.
- **Sharing**: Easily mark files as public to generate shareable, unauthenticated links.
- **Intuitive UI**: A clean, responsive interface inspired by modern cloud storage services.
- **File Organization**: Bulk operations, folder creation, and folder zipping for efficient management.
- **Integrated Feedback**: Real-time notifications for all file operations.

## Technologies

- **Frontend**: Nuxt 3 (Vue 3 Composition API), Tailwind CSS, DaisyUI.
- **Backend**: Nitro (H3/Node.js).
- **Media Processing**: ffmpeg/ffprobe for thumbnail generation.
- **Metadata**: Lightweight, sidecar-based (`.cloudinfo`) JSON metadata storage.

## Getting Started

### Prerequisites

- Node.js (v18+)
- ffmpeg (required for thumbnail generation)

### Configuration

ClyoCloud uses environment variables to manage your setup. Create a `.env` file in the project root:

```bash
STORAGE_PATH=/path/to/your/storage
THUMBNAIL_PATH=/path/to/your/thumbnails
JWT_SECRET=your_secure_random_string
```

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ClyoCloud
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run dev
   ```

4. Build and run in production:
   ```bash
   npm run build
   node .output/server/index.mjs
   ```

## Key Capabilities

### Public Sharing
Easily share files without requiring recipients to have an account. Simply open a file's information modal, toggle "Public Access", and share the generated link.

### Media Enhancements
Manage your media library with tags and descriptions. All metadata is stored as sidecar JSON files, making your data portable and easy to manage.

### File Operations
- **Bulk Actions**: Delete or download multiple items at once.
- **Renaming**: Context-menu driven renaming for files and folders.
- **Drag & Drop**: Intuitive drag-and-drop file uploading.

---

*ClyoCloud is designed to be a lightweight, privacy-focused alternative to mainstream cloud storage providers.*
