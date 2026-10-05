<!-- app.vue -->
<template>
  <div class="min-h-screen bg-base-200 font-sans" :data-theme="currentTheme">
    <NotificationManager />
    
    <div v-if="user" class="drawer lg:drawer-open">
      <input id="sidebar-drawer" type="checkbox" class="drawer-toggle" />
      
      <div class="drawer-content flex flex-col min-h-screen">
        <main class="flex-1">
          <NuxtPage />
        </main>
      </div>

      <div class="drawer-side z-50">
        <label for="sidebar-drawer" class="drawer-overlay"></label>
        
        <aside class="w-72 bg-base-100 h-full border-r border-base-content/10 flex flex-col lg:shadow-none">
          <!-- Sidebar Header -->
          <div class="p-6 flex items-center gap-3">
            <div class="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <img src="/clyo.png" class="w-6 h-6 object-contain" alt="Clyo Logo" />
            </div>
            <div>
              <h2 class="font-bold text-lg tracking-tight leading-none text-base-content">ClyoCloud</h2>
              <span class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">Personal Storage</span>
            </div>
          </div>

          <!-- Navigation -->
          <nav class="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar">
            <div class="mb-6">
              <h3 class="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/30 mb-3">Library</h3>
              <ul class="space-y-1">
                <li>
                  <NuxtLink to="/" :class="['nav-link', { active: isLinkActive('/') }]">
                    <Icon name="mdi:home-variant" class="w-5 h-5" />
                    <span>Dashboard</span>
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink to="/files" :class="['nav-link', { active: isLinkActive('/files') }]">
                    <Icon name="mdi:folder-multiple" class="w-5 h-5" />
                    <span>My Files</span>
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink to="/shared" :class="['nav-link', { active: isLinkActive('/shared') }]">
                    <Icon name="mdi:share-variant" class="w-5 h-5" />
                    <span>Shared</span>
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink to="/wallpapers" :class="['nav-link', { active: isLinkActive('/wallpapers') }]">
                    <Icon name="mdi:wallpaper" class="w-5 h-5" />
                    <span>Wallpapers</span>
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink to="/favorites" :class="['nav-link', { active: isLinkActive('/favorites') }]">
                    <Icon name="mdi:star" class="w-5 h-5" />
                    <span>Favorites</span>
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink to="/media" :class="['nav-link', { active: isLinkActive('/media') }]">
                    <Icon name="mdi:play-box-multiple-outline" class="w-5 h-5" />
                    <span>Media</span>
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink to="/theatre" :class="['nav-link', { active: isLinkActive('/theatre') }]">
                    <Icon name="mdi:theater" class="w-5 h-5" />
                    <span>Theatre</span>
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink to="/collections" :class="['nav-link', { active: isLinkActive('/collections') }]">
                    <Icon name="mdi:tag-multiple" class="w-5 h-5" />
                    <span>Collections</span>
                  </NuxtLink>
                </li>

                <li>
                  <NuxtLink to="/shorts" :class="['nav-link', { active: isLinkActive('/shorts') }]">
                    <Icon name="mdi:play-box-outline" class="w-5 h-5" />
                    <span>Shorts</span>
                  </NuxtLink>
                </li>
              </ul>
            </div>

            <div class="mb-6">
              <h3 class="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/30 mb-3">Tools</h3>
              <ul class="space-y-1">
                <li>
                  <NuxtLink to="/downloader" :class="['nav-link', { active: isLinkActive('/downloader') }]">
                    <Icon name="mdi:cloud-download" class="w-5 h-5" />
                    <span>Downloader</span>
                  </NuxtLink>
                </li>
              </ul>
            </div>

            <div class="mb-6">
              <h3 class="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/30 mb-3">Storage Management</h3>
              <ul class="space-y-1">
                <li>
                  <NuxtLink to="/duplicates" :class="['nav-link', { active: isLinkActive('/duplicates') }]">
                    <Icon name="mdi:content-copy" class="w-5 h-5" />
                    <span>Duplicates</span>
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink to="/trash" :class="['nav-link', { active: isLinkActive('/trash') }]">
                    <Icon name="mdi:trash-can-outline" class="w-5 h-5" />
                    <span>Recycle Bin</span>
                  </NuxtLink>
                </li>
              </ul>
            </div>

            <div v-if="user && user.isAdmin" class="mb-6">
              <h3 class="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-error/40 mb-3">Administration</h3>
              <ul class="space-y-1">
                <li>
                  <NuxtLink to="/admin" :class="['nav-link', { active: isLinkActive('/admin') }]">
                    <Icon name="mdi:shield-crown" class="w-5 h-5" />
                    <span>Admin Panel</span>
                  </NuxtLink>
                </li>
              </ul>
            </div>

            <div>
              <h3 class="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/30 mb-3">Account</h3>
              <ul class="space-y-1">
                <li>
                  <NuxtLink to="/settings" :class="['nav-link', { active: isLinkActive('/settings') }]">
                    <Icon name="mdi:cog" class="w-5 h-5" />
                    <span>Settings</span>
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink to="/logs" :class="['nav-link', { active: isLinkActive('/logs') }]">
                    <Icon name="mdi:history" class="w-5 h-5" />
                    <span>Logs</span>
                  </NuxtLink>
                </li>
              </ul>
            </div>
          </nav>

          <!-- Sidebar Footer / User -->
          <div class="p-4 border-t border-base-content/10 bg-base-100">
            <div class="flex items-center gap-3 p-2 rounded-lg bg-base-200/50 border border-base-content/5">
              <div class="avatar placeholder">
                <div class="bg-primary/10 text-primary rounded-md w-9">
                  <span class="text-sm font-bold">{{ user.name.charAt(0).toUpperCase() }}</span>
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-bold truncate text-base-content">{{ user.name }}</p>
                <p class="text-[9px] font-bold text-success uppercase tracking-wider">Online</p>
              </div>
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
import { useState, useCookie, useRoute } from 'nuxt/app'
import { onMounted, watch, computed } from 'vue'

const route = useRoute()
const user = useState<{ name: string; isAdmin?: boolean } | null>('user')
const themeCookie = useCookie('theme', { default: () => 'onedev' })
const currentTheme = useState<string>('currentTheme', () => themeCookie.value)
const userSettings = useState<any>('userSettings', () => null)



const isLinkActive = (path: string) => {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

watch(currentTheme, (newTheme) => {
  themeCookie.value = newTheme
})

async function refreshUserSettings() {
  if (!user.value) return
  try {
    const data: any = await $fetch('/api/user-settings')
    userSettings.value = data
    if (data.theme) {
      currentTheme.value = data.theme
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
  @apply flex items-center gap-3 px-4 py-2.5 rounded-lg font-bold text-xs text-base-content/60 transition-all duration-200 hover:bg-base-content/5 hover:text-base-content;
}

.nav-link.active {
  @apply bg-primary text-primary-content shadow-sm hover:bg-primary/90;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}
</style>
