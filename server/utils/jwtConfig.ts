/**
 * JWT secret singleton.
 *
 * Nuxt 3's useRuntimeConfig() returns a read-only (frozen) proxy at runtime,
 * so we cannot write the resolved/generated secret back to `config.jwtSecret`.
 * Instead, the init plugin calls `setJwtSecret()` once at startup, and every
 * API handler / middleware calls `getJwtSecret()` to read it.
 */

let _jwtSecret: string | null = null;

/**
 * Store the resolved JWT secret. Called once by the server init plugin.
 */
export function setJwtSecret(secret: string): void {
    _jwtSecret = secret;
}

/**
 * Retrieve the resolved JWT secret.
 * Throws if called before the init plugin has run.
 */
export function getJwtSecret(): string {
    if (!_jwtSecret) {
        throw new Error('[SECURITY] JWT secret has not been initialized yet. Ensure the init plugin runs before any auth handlers.');
    }
    return _jwtSecret;
}
