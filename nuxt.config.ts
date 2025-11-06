import path from "path";

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
      usersFilePath: process.env.USERS_FILE_PATH || path.join(process.env.HOME || process.env.USERPROFILE || '/default/path', '.clyo', 'users.json'),
      tagsFilePath: process.env.TAGS_FILE_PATH || path.join(process.env.HOME || process.env.USERPROFILE || '/default/path', '.clyo', 'tags.json'),
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