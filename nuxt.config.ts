// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxt/icon', '@nuxtjs/sitemap'],
  site: {
    url: 'https://weexnes.dev',
  },
  runtimeConfig: {
    storagePath: process.env.STORAGE_PATH,
    thumbnailPath: process.env.THUMBNAIL_PATH,
    maxFileSize: 500 * 1024 * 1024,
    jwtSecret: "jei0ghjesi0ogj8ie0jg8093jg8390"
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
})