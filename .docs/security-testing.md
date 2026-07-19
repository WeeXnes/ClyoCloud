# Security & Testing

This document details the security model, vulnerability prevention strategies, and verification test suites used in ClyoCloud.

---

## 1. Authentication & Session Management

ClyoCloud implements cookie-based JSON Web Tokens (JWT) for user sessions, managed by the global event interceptor middleware: [server/middleware/auth.ts](file:///home/weexnes/ClyoWallpaper/ClyoCloud/server/middleware/auth.ts).

### Deny-by-Default Design
All incoming requests are intercepted and verified against a list of public paths. If the requested URL is not on the public whitelist, a valid `token` cookie or `Authorization: Bearer <token>` header is strictly required. Non-authenticated requests are either:
*   Redirected to `/login` (for page/HTML requests).
*   Rejected with a `401 Unauthorized` status (for API/JSON requests).

### Token Sources
The auth middleware and verify endpoint accept tokens from two sources (in priority order):
1.  **Cookie**: `token=<jwt>` — used by browser sessions.
2.  **Authorization Header**: `Authorization: Bearer <jwt>` — used by mobile apps. Parsed case-insensitively per RFC 7235 (e.g., `bearer`, `Bearer`, `BEARER` all work).

### Whitelisted Public Routes
```typescript
const publicPaths = [
    '/api/login', 
    '/api/logout', 
    '/login', 
    '/p/',                    // Public share links folder
    '/api/public',            // Public shared file/meta API
    '/api/2fa/verify-login',  // 2FA verification endpoint
    '/_nuxt',                 // Nuxt assets
    '/favicon.ico',
    '/robots.txt',
    '/clyo.png',
    '/wicon.png'
]
```

### Two-Factor Authentication (2FA) State Machine
If a user has 2FA enabled, ClyoCloud implements a secure two-step login process:
1.  **Step 1**: User submits correct credentials via `/api/login`. The server generates a temporary, **partial** JWT containing `isPartial: true`.
2.  **Step 2**: The client is restricted. If the global auth middleware detects `isPartial === true`, it blocks all normal API calls and page routes, only allowing `/api/2fa/verify-login`.
3.  **Step 3**: The user submits their TOTP token. Once verified, the server signs a full, standard JWT, overriding the partial cookie and enabling access to the system.

### Device-Bound App Tokens
When a user generates a QR code for mobile app login (`/api/user-qr`), the server creates a **device-specific JWT** containing a unique `deviceId` (UUID) instead of sharing the user's browser session token.

**Device Lifecycle:**
1.  **Registration**: A pending device entry is created in `devices.json` when the QR code is generated.
2.  **Activation**: When the mobile app scans the QR and calls `/api/verify?deviceModel=<model>`, the device entry is updated with the device model name (e.g., "Google Pixel 7 Pro").
3.  **Validation**: On every authenticated request, the auth middleware checks that the `deviceId` still exists in the device registry. If the device has been revoked, the request is rejected with `401`.
4.  **Revocation**: Users can revoke individual devices from the Settings page via `DELETE /api/devices`. Revoking removes the `deviceId` from the registry, instantly invalidating all requests using that device's JWT.
5.  **Last-Used Tracking**: Each successful authentication updates the device's `lastUsed` timestamp for visibility in the Settings UI.

The device registry is stored in a JSON file at the path configured by `DEVICES_FILE_PATH` (defaults to `~/.clyo/devices.json`), managed by [server/utils/deviceRegistry.ts](file:///home/weexnes/ClyoWallpaper/ClyoCloud/server/utils/deviceRegistry.ts).

---

## 2. Directory Traversal Prevention

When serving raw files or range streams, users specify file paths using dynamic route parameters (e.g. `/file/path/to/media.jpg`). Without strict checks, an attacker could traverse path boundaries (`../../etc/passwd`).

### Security Validation Code
All file paths are validated using `isPathWithin` in [server/utils/fileUtils.ts](file:///home/weexnes/ClyoWallpaper/ClyoCloud/server/utils/fileUtils.ts) before any read/write operations:

```typescript
export function isPathWithin(parentPath: string, childPath: string): boolean {
    const resolvedParent = path.resolve(parentPath)
    const resolvedChild = path.resolve(childPath)
    const relative = path.relative(resolvedParent, resolvedChild)
    return !relative.startsWith('..') && !path.isAbsolute(relative)
}
```

*   **`path.resolve`**: Fully resolves symlinks, absolute paths, and parent-directory traversals (`..`).
*   **Relative Prefix Check**: Validates that the child folder strictly resides inside the parent path hierarchy. If it tries to jump out, the request is terminated with `403 Forbidden` ("Access denied: Path outside user directory").

---

## 3. Automated Security Verification

ClyoCloud contains a dedicated security regression test suite using Vitest, located in [tests/security.spec.ts](file:///home/weexnes/ClyoWallpaper/ClyoCloud/tests/security.spec.ts).

### What it Verifies
*   Attempts to access protected API endpoints (including `/api/user-qr`, `/api/devices`, `/api/verify`) without a token return `401`.
*   Attempts to access content delivery routes (like raw files, streams, or thumbnails) without credentials return `401`.
*   Attempts to access protected system pages (like settings, downloader, duplicates) without credentials return `401`.
*   An invalid or corrupted JWT token cookie returns `401`.
*   A request for an unknown/random route (not in the whitelist) is blocked by default (`Deny-by-Default`).
*   Whitelisted public routes (like login/assets/public share links) correctly bypass auth checks and return non-401 responses.
*   **Bearer token authentication**: Invalid Bearer tokens, case-variant prefixes (`bearer`, `Bearer`), empty headers, and Bearer-with-no-value are all correctly rejected with `401`.

### Running Security Tests
To execute the security test suite, ensure the ClyoCloud server is running locally (default: `http://localhost:6969`) and execute the following command:

```bash
npm run test:security
```

