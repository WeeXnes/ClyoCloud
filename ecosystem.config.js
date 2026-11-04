export const apps = [
    {
        name: 'ClyoCloud',
        port: '6969',
        exec_mode: 'fork',
        instances: 1,
        script: './.output/server/index.mjs',
        env: {
            // Read when the server starts. Unset paths default to ~/.clyo of the user running pm2.
            // STORAGE_PATH: '/var/lib/clyo/data',
            // MOVIES_PATH: '/var/lib/clyo/movies',
            // SHOWS_PATH: '/var/lib/clyo/shows',
            // THUMBNAIL_PATH: '/var/lib/clyo/thumbs',
            // PREVIEW_PATH: '/var/lib/clyo/previews',
            // USERS_FILE_PATH: '/var/lib/clyo/users.json',
            // TAGS_FILE_PATH: '/var/lib/clyo/tags.json',
            // DEVICES_FILE_PATH: '/var/lib/clyo/devices.json',
        },
    }
];
