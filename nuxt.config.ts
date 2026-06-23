import * as path from 'path'
import * as os from "node:os";
import pkg from './package.json'

export default defineNuxtConfig({
    compatibilityDate: '2024-11-01',
    devtools: { enabled: true },
    app: {
        head: {
            title: 'ClyoCloud',
            titleTemplate: '%s - ClyoCloud',
            link: [
                { rel: 'icon', type: 'image/png', href: '/clyo.png' }
            ]
        }
    },
    modules: ['@nuxtjs/tailwindcss', '@nuxt/icon', '@nuxtjs/sitemap'],
    site: {
      url: 'https://weexnes.dev',
    },
    runtimeConfig: {
        public: {
            version: pkg.version || '1.0.0'
        },
        storagePath:
            process.env.STORAGE_PATH ||
            path.join(os.homedir(), '.clyo', 'data'),

        thumbnailPath:
            process.env.THUMBNAIL_PATH ||
            path.join(os.homedir(), '.clyo', 'thumbs'),

        previewPath:
            process.env.PREVIEW_PATH ||
            path.join(os.homedir(), '.clyo', 'previews'),

        usersFilePath:
            process.env.USERS_FILE_PATH ||
            path.join(os.homedir(), '.clyo', 'users.json'),

        tagsFilePath:
            process.env.TAGS_FILE_PATH ||
            path.join(os.homedir(), '.clyo', 'tags.json'),

        maxFileSize: 100 * 1024  * 1024 * 1024,
        jwtSecret: 'jei0ghjesi0ogj8ie0jg8093jg8390',
    },
    router: {
      options: {
          hashMode: false
      }
      },
    ssr: true,
    tailwindcss: {
        viewer: false,
    },
    build: {
        transpile: ['otplib']
    },
    nitro: {
      externals: {
        inline: ['otplib']
      }
    }
})
