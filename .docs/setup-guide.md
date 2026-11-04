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

    # Start the server, loading settings from .env (runs on the configured PORT or defaults to 3000)
    node --env-file=.env .output/server/index.mjs
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

ClyoCloud reads its configuration from environment variables when the server starts, so one build can be used on any machine or by any user. Create a `.env` file in the root directory:

```env
PORT=6969
STORAGE_PATH=/var/lib/clyo/data
THUMBNAIL_PATH=/var/lib/clyo/thumbs
USERS_FILE_PATH=/var/lib/clyo/users.json
TAGS_FILE_PATH=/var/lib/clyo/tags.json
JWT_SECRET=super_secret_session_token_key_here
```

How the variables reach the server depends on how you start it:

*   **`npm run dev`** loads `.env` automatically.
*   **`node .output/server/index.mjs`** does not read `.env`. Use `node --env-file=.env .output/server/index.mjs` (Node.js 20.6 or higher) or export the variables yourself.
*   **PM2** uses the `env` block in `ecosystem.config.js`, plus whatever is set in the shell that first starts the app. Don't list a variable there as `undefined`, because PM2 then drops it from the shell's values too.
*   **systemd** uses `Environment=` or `EnvironmentFile=` in the service unit.

Setting a path variable during `npm run build` has no effect, and neither does a `.env` file that is only present at build time.

### Full Configuration Reference

`~` is the home directory of the user running the server, not the user who built it. Each path variable can also be set with a `NUXT_` prefix (such as `NUXT_STORAGE_PATH`), which takes priority over the unprefixed name. The server prints every path it uses when it starts.

| Variable Name | Default Value (Fallback) | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port the Node.js/Nitro server listens on. |
| `STORAGE_PATH` | `~/.clyo/data` | Absolute path containing each user's file storage. |
| `MOVIES_PATH` | `~/.clyo/movies` | Location of the Theatre movie library. |
| `SHOWS_PATH` | `~/.clyo/shows` | Location of the Theatre TV show library. |
| `THUMBNAIL_PATH`| `~/.clyo/thumbs` | Location where generated video/image thumbnails are saved. |
| `PREVIEW_PATH` | `~/.clyo/previews` | Location where larger previews are generated. |
| `USERS_FILE_PATH`| `~/.clyo/users.json` | Path to the JSON configuration containing hashed user credentials. The server also keeps `jwt.secret`, the 2FA key and activity logs in this folder. |
| `TAGS_FILE_PATH` | `~/.clyo/tags.json` | Path to the JSON file managing available tags and their colors. Per-user tag files are kept in the same folder. |
| `DEVICES_FILE_PATH` | `~/.clyo/devices.json` | Path to the JSON file listing authorized devices. |
| `JWT_SECRET` | Random, regenerated on every start | Key used to sign JWT session cookies. Set it to keep sessions and devices valid across restarts. |
| `TRUSTED_PROXIES` | Loopback only | Comma-separated IPs or CIDR ranges of reverse proxies allowed to set `X-Forwarded-For`. Set this if your proxy isn't on the same host (e.g. Docker: `172.16.0.0/12`), otherwise all clients share one rate limit. |
| `COMFYUI_URL` | `http://localhost:8188` | Default ComfyUI endpoint for the AI Wallpaper Pipeline. A URL saved in a user's settings takes precedence. See the README section "ComfyUI Wallpaper Pipeline". |
| `CLYO_WATCH_STORAGE` | `true` | Watch the storage folder so changes made outside ClyoCloud (SMB, file managers, rsync) update sizes, tags, wallpapers and favourites within seconds. Set to `false` to rely on the periodic rescan only. Large trees need enough inotify watches (`fs.inotify.max_user_watches`, one per folder). |
| `CLYO_RESCAN_MINUTES` | `60` (`10` when not watching) | How often the full metadata rescan runs as a safety net. |

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
    
    *Optional arguments*: Use `--path` or `-p` to specify a custom user JSON path. The script doesn't read `USERS_FILE_PATH`, so pass the same path here if you set it for the server.
    ```bash
    npm run user-manager add myuser securepass -p /custom/path/users.json
    ```

*   **List Registered Users**:
    ```bash
    npm run user-manager list
    ```
    Lists all user account names found in the configuration.
