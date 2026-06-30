# 🛡 Security & Testing

This document details the security model, vulnerability prevention strategies, and verification test suites used in ClyoCloud.

---

## 1. Authentication & Session Management

ClyoCloud implements cookie-based JSON Web Tokens (JWT) for user sessions, managed by the global event interceptor middleware: [server/middleware/auth.ts](file:///home/weexnes/CurClyo/server/middleware/auth.ts).

### Deny-by-Default Design
All incoming requests are intercepted and verified against a list of public paths. If the requested URL is not on the public whitelist, a valid `token` cookie is strictly required. Non-authenticated requests are either:
*   Redirected to `/login` (for page/HTML requests).
*   Rejected with a `401 Unauthorized` status (for API/JSON requests).

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

---

## 2. Directory Traversal Prevention

When serving raw files or range streams, users specify file paths using dynamic route parameters (e.g. `/file/path/to/media.jpg`). Without strict checks, an attacker could traverse path boundaries (`../../etc/passwd`).

### Security Validation Code
All file paths are validated using `isPathWithin` in [server/utils/fileUtils.ts](file:///home/weexnes/CurClyo/server/utils/fileUtils.ts) before any read/write operations:

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

ClyoCloud contains a dedicated security regression test suite using Vitest, located in [tests/security.spec.ts](file:///home/weexnes/CurClyo/tests/security.spec.ts).

### What it Verifies
*   Attempts to access protected API endpoints without a token return `401`.
*   Attempts to access content delivery routes (like raw files, streams, or thumbnails) without credentials return `401`.
*   Attempts to access protected system pages (like settings, downloader, duplicates) without credentials return `401`.
*   An invalid or corrupted JWT token cookie returns `401`.
*   A request for an unknown/random route (not in the whitelist) is blocked by default (`Deny-by-Default`).
*   Whitelisted public routes (like login/assets/public share links) correctly bypass auth checks and return non-401 responses.

### Running Security Tests
To execute the security test suite, ensure the ClyoCloud server is running locally (default: `http://localhost:6969`) and execute the following command:

```bash
npm run test:security
```
