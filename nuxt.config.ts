import { fileURLToPath } from 'node:url'
import pkg from './package.json'

const pathEnvPreload = fileURLToPath(new URL('./server/pathEnv.preload.ts', import.meta.url))

export default defineNuxtConfig({
    compatibilityDate: '2024-11-01',
    devtools: { enabled: true },
    app: {
        head: {
            title: 'ClyoCloud',
            titleTemplate: '%s - ClyoCloud',
            htmlAttrs: {
                'data-theme': 'dark'
            },
            meta: [
                { name: 'theme-color', content: '#000000' }
            ],
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
        // Paths are resolved when the server starts, see server/pathEnv.ts.
        // Anything computed here would be baked into the build.
        storagePath: '',
        moviesPath: '',
        showsPath: '',
        thumbnailPath: '',
        previewPath: '',
        usersFilePath: '',
        tagsFilePath: '',
        devicesFilePath: '',

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
        cssPath: '~/assets/css/main.css',
    },
    build: {
        transpile: ['otplib']
    },
    nitro: {
      unenv: {
        polyfill: [pathEnvPreload]
      },
      moduleSideEffects: [pathEnvPreload],
      externals: {
        inline: ['otplib']
      }
    }
})
