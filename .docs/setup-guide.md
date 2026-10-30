# Setup & Configuration Guide

This guide helps you set up a local development environment for ClyoCloud and configure it for production.

---

## Prerequisites

Ensure the following tools are installed on your host system:

*   **Node.js**: Version 18.0.0 or higher.
*   **ffmpeg & ffprobe**: Installed and available in the system execution `$PATH` (required for image/video thumbnail generation).
*   **yt-dlp**: Optional, but required if you want to use the background URL video downloader component.

---

## Installation

### Manual Installation

1.  **Clone the Repository**:
    ```bash
    git clone <repository-url>
    cd ClyoCloud
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    This starts the development server (default: `http://localhost:3000`).

4.  **Build and Run for Production**:
    ```bash
    # Build the production bundle
    npm run build

    # Start the server (runs on the configured PORT or defaults to 3000)
    node .output/server/index.mjs
    ```

### Arch Linux (AUR)

ClyoCloud can be installed on Arch Linux directly from the Arch User Repository (AUR):
*   **Stable builds**: Install the `clyocloud` package.
*   **Cutting-edge/development builds**: Install the `clyocloud-git` package.

Example using an AUR helper (such as `yay`):
```bash
# Stable version
yay -S clyocloud

# Cutting-edge (Git development branch) version
yay -S clyocloud-git
```


---

## Environment Variables

ClyoCloud uses environment variables for configuration. Create a `.env` file in the root directory:

```env
PORT=6969
STORAGE_PATH=/var/lib/clyo/data
THUMBNAIL_PATH=/var/lib/clyo/thumbs
USERS_FILE_PATH=/var/lib/clyo/users.json
TAGS_FILE_PATH=/var/lib/clyo/tags.json
JWT_SECRET=super_secret_session_token_key_here
```

### Full Configuration Reference

The variables map directly to the Nitro runtime configuration inside [nuxt.config.ts](file:///home/weexnes/CurClyo/nuxt.config.ts):

| Variable Name | Default Value (Fallback) | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port the Node.js/Nitro server listens on. |
| `STORAGE_PATH` | `~/.clyo/data` | Absolute path containing each user's file storage. |
| `THUMBNAIL_PATH`| `~/.clyo/thumbs` | Location where generated video/image thumbnails are saved. |
| `PREVIEW_PATH` | `~/.clyo/previews` | Location where larger previews are generated. |
| `USERS_FILE_PATH`| `~/.clyo/users.json` | Path to the JSON configuration containing hashed user credentials. |
| `TAGS_FILE_PATH` | `~/.clyo/tags.json` | Path to the JSON file managing available tags and their colors. |
| `JWT_SECRET` | Random, regenerated on every start | Key used to sign JWT session cookies. Set it to keep sessions and devices valid across restarts. |
| `TRUSTED_PROXIES` | Loopback only | Comma-separated IPs or CIDR ranges of reverse proxies allowed to set `X-Forwarded-For`. Set this if your proxy isn't on the same host (e.g. Docker: `172.16.0.0/12`), otherwise all clients share one rate limit. |

> [!IMPORTANT]
> The folders defined in `STORAGE_PATH` and `THUMBNAIL_PATH` must be writeable by the process running ClyoCloud. On server startup, ClyoCloud will attempt to create these directories automatically if they do not exist.

---

## CLI User Manager

Because ClyoCloud operates without a centralized SQL database, users are registered and managed via a JSON file (`users.json`). The project contains a CLI script to manage these accounts.

If `users.json` doesn't exist on first start, ClyoCloud creates an `admin` account with a random password and prints it once to the console. Change it after your first login. If the file exists but is damaged, the server refuses to start rather than overwriting it, so restore it from a backup or fix it by hand.

### Location
The script is located under [.usermanager/index.js](file:///home/weexnes/CurClyo/.usermanager/index.js).

### Commands

*   **Add a New User**:
    ```bash
    npm run user-manager add <username> <password>
    ```
    This hashes the password using `bcryptjs` (with a cost factor of `12`) and saves the profile to `users.json`.
    
    *Optional arguments*: Use `--path` or `-p` to specify a custom user JSON path.
    ```bash
    npm run user-manager add myuser securepass -p /custom/path/users.json
    ```

*   **List Registered Users**:
    ```bash
    npm run user-manager list
    ```
    Lists all user account names found in the configuration.
