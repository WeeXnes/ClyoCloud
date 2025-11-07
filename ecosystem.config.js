export const apps = [
    {
        name: 'ClyoCloud',
        port: '6969',
        exec_mode: 'fork',
        instances: 1,
        script: './.output/server/index.mjs',
        env: {
            STORAGE_PATH: undefined,
            THUMBNAIL_PATH: undefined,
            USERS_FILE_PATH: undefined,
            TAGS_FILE_PATH: undefined,
        },
    }
];
