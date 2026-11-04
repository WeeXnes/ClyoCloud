import path from 'path'

// Runtime config key -> documented variable and default location under ~/.clyo
const PATH_VARS: Record<string, string> = {
    STORAGE_PATH: 'data',
    MOVIES_PATH: 'movies',
    SHOWS_PATH: 'shows',
    THUMBNAIL_PATH: 'thumbs',
    PREVIEW_PATH: 'previews',
    USERS_FILE_PATH: 'users.json',
    TAGS_FILE_PATH: 'tags.json',
    DEVICES_FILE_PATH: 'devices.json',
}

/**
 * Fills in NUXT_<NAME> for every path variable, which is what Nitro reads into runtimeConfig.
 * Order: NUXT_<NAME>, then <NAME>, then ~/.clyo. getHomeDir is only called when a default is needed.
 */
export function applyPathEnv(env: Record<string, string | undefined>, getHomeDir: () => string) {
    for (const [name, defaultName] of Object.entries(PATH_VARS)) {
        env[`NUXT_${name}`] = env[`NUXT_${name}`] || env[name] || path.join(getHomeDir(), '.clyo', defaultName)
    }
}
