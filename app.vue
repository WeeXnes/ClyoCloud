<!-- app.vue -->
<template>
  <div class="min-h-screen bg-base-100 text-fg-2 font-sans" :data-theme="currentTheme">
    <NotificationManager />

    <div v-if="user" class="drawer lg:drawer-open">
      <input id="sidebar-drawer" type="checkbox" class="drawer-toggle" />

      <div class="drawer-content flex flex-col min-h-screen min-w-0">
        <main class="flex-1 min-w-0">
          <NuxtPage />
        </main>
      </div>

      <div class="drawer-side z-50">
        <label for="sidebar-drawer" class="drawer-overlay" aria-label="Close navigation"></label>

        <aside class="w-60 bg-base-100 h-full border-r border-line flex flex-col">
          <!-- Wordmark -->
          <div class="h-header shrink-0 flex items-center px-5 border-b border-line">
            <NuxtLink to="/" class="text-[15px] leading-none whitespace-nowrap">
              <span class="font-semibold text-fg tracking-section">ClyoCloud</span>
            </NuxtLink>
          </div>

          <!-- Navigation -->
          <nav class="flex-1 px-3 py-5 overflow-y-auto" aria-label="Main">
            <div v-for="group in visibleNavGroups" :key="group.label" class="mb-6 last:mb-0">
              <h3 class="micro px-2 mb-2">{{ group.label }}</h3>
              <ul>
                <li v-for="item in group.items" :key="item.to">
                  <NuxtLink
                    :to="item.to"
                    :class="['nav-link', { active: isLinkActive(item.to) }]"
                    :aria-current="isLinkActive(item.to) ? 'page' : undefined"
                  >
                    <Icon :name="item.icon" class="w-4 h-4 shrink-0" />
                    <span>{{ item.label }}</span>
                  </NuxtLink>
                </li>
              </ul>
            </div>
          </nav>

          <!-- Signed-in user -->
          <div class="shrink-0 px-5 py-4 border-t border-line flex items-center gap-3">
            <div class="w-8 h-8 rounded-full border border-line-strong flex items-center justify-center text-[13px] font-medium text-fg shrink-0">
              {{ user.name.charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[13px] font-medium truncate text-fg leading-tight">{{ user.name }}</p>
              <p class="text-[12px] text-fg-3 leading-tight flex items-center gap-1.5 mt-0.5">
                <span class="dot text-success"></span>Signed in
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <div v-else class="min-h-screen">
      <NuxtPage />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useState, useCookie, useRoute, useHead } from 'nuxt/app'
import { onMounted, watch, computed } from 'vue'

const route = useRoute()
const user = useState<{ name: string; isAdmin?: boolean } | null>('user')

// Only Dark and Light exist. Older saved themes (onedev, dracula, ...) fall back to Dark.
const normalizeTheme = (theme?: string | null) => (theme === 'light' ? 'light' : 'dark')

const themeCookie = useCookie('theme', { default: () => 'dark' })
const currentTheme = useState<string>('currentTheme', () => normalizeTheme(themeCookie.value))
const userSettings = useState<any>('userSettings', () => null)

useHead({
  htmlAttrs: { 'data-theme': computed(() => normalizeTheme(currentTheme.value)) }
})

const navGroups = [
  {
    label: 'Library',
    items: [
      { to: '/', label: 'Dashboard', icon: 'mdi:home-variant-outline' },
      { to: '/files', label: 'My Files', icon: 'mdi:folder-outline' },
      { to: '/shared', label: 'Shared', icon: 'mdi:share-variant-outline' },
      { to: '/wallpapers', label: 'Wallpapers', icon: 'mdi:wallpaper' },
      { to: '/favorites', label: 'Favorites', icon: 'mdi:star-outline' },
      { to: '/media', label: 'Media', icon: 'mdi:play-box-multiple-outline' },
      { to: '/theatre', label: 'Theatre', icon: 'mdi:theater' },
      { to: '/collections', label: 'Collections', icon: 'mdi:tag-multiple-outline' },
      { to: '/shorts', label: 'Shorts', icon: 'mdi:play-box-outline' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/downloader', label: 'Downloader', icon: 'mdi:cloud-download-outline' },
    ],
  },
  {
    label: 'Storage',
    items: [
      { to: '/duplicates', label: 'Duplicates', icon: 'mdi:content-copy' },
      { to: '/trash', label: 'Recycle Bin', icon: 'mdi:trash-can-outline' },
    ],
  },
  {
    label: 'Administration',
    adminOnly: true,
    items: [
      { to: '/admin', label: 'Admin Panel', icon: 'mdi:shield-account-outline' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/settings', label: 'Settings', icon: 'mdi:cog-outline' },
      { to: '/logs', label: 'Logs', icon: 'mdi:history' },
    ],
  },
]

const visibleNavGroups = computed(() => navGroups.filter(g => !g.adminOnly || user.value?.isAdmin))

const isLinkActive = (path: string) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

watch(currentTheme, (newTheme) => {
  const normalized = normalizeTheme(newTheme)
  if (normalized !== newTheme) {
    currentTheme.value = normalized
    return
  }
  themeCookie.value = normalized
})

async function refreshUserSettings() {
  if (!user.value) return
  try {
    const data: any = await $fetch('/api/user-settings')
    userSettings.value = data
    if (data.theme) {
      currentTheme.value = normalizeTheme(data.theme)
    }
  } catch (err) {
    console.error('Failed to fetch settings:', err)
  }
}

onMounted(() => {
  if (user.value) {
    refreshUserSettings()
  }
})

watch(user, (newUser) => {
  if (newUser) {
    refreshUserSettings()
  } else {
    userSettings.value = null
  }
})
</script>

<style scoped>
.nav-link {
  @apply flex items-center gap-3 px-2 h-8 rounded-md text-[14px] text-fg-2 transition-colors duration-[120ms] hover:text-fg;
}

.nav-link.active {
  @apply text-fg font-medium;
}

.nav-link.active :deep(svg) {
  @apply text-fg;
}
</style>
