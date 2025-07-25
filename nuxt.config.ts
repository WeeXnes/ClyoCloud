// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@nuxt/icon', '@nuxtjs/sitemap'],
  site: {
    url: 'https://weexnes.dev',
  },
  runtimeConfig: {
    storagePath: process.env.STORAGE_PATH
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