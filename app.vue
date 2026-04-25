<!-- app.vue -->
<template>
  <div class="min-h-screen bg-base-200 font-sans" data-theme="onedev">
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
        
        <aside class="w-72 bg-base-100 h-full border-r border-base-content/5 flex flex-col shadow-2xl lg:shadow-none">
          <!-- Sidebar Header -->
          <div class="p-6 flex items-center gap-3">
            <div class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
              <img src="/clyo.png" class="w-6 h-6 object-contain" alt="Clyo Logo" />
            </div>
            <div>
              <h2 class="font-black text-lg tracking-tight leading-none">ClyoCloud</h2>
              <span class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">Personal Storage</span>
            </div>
          </div>

          <!-- Navigation -->
          <nav class="flex-1 px-4 py-4 overflow-y-auto custom-scrollbar">
            <div class="mb-8">
              <h3 class="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30 mb-4">Library</h3>
              <ul class="space-y-1.5">
                <li>
                  <NuxtLink to="/" class="nav-link" active-class="active">
                    <Icon name="mdi:home-variant" class="w-5 h-5" />
                    <span>Dashboard</span>
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink to="/files" class="nav-link" active-class="active">
                    <Icon name="mdi:folder-multiple" class="w-5 h-5" />
                    <span>My Files</span>
                  </NuxtLink>
                </li>
                <li>
                  <NuxtLink to="/media" class="nav-link" active-class="active">
                    <Icon name="mdi:video-library" class="w-5 h-5" />
                    <span>Media Tab</span>
                  </NuxtLink>
                </li>
              </ul>
            </div>

            <div class="mb-8">
              <h3 class="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30 mb-4">Tools</h3>
              <ul class="space-y-1.5">
                <li>
                  <NuxtLink to="/downloader" class="nav-link" active-class="active">
                    <Icon name="mdi:cloud-download" class="w-5 h-5" />
                    <span>Downloader</span>
                  </NuxtLink>
                </li>
              </ul>
            </div>

            <div>
              <h3 class="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30 mb-4">Account</h3>
              <ul class="space-y-1.5">
                <li>
                  <NuxtLink to="/settings" class="nav-link" active-class="active">
                    <Icon name="mdi:cog" class="w-5 h-5" />
                    <span>Settings</span>
                  </NuxtLink>
                </li>
              </ul>
            </div>
          </nav>

          <!-- Sidebar Footer / User -->
          <div class="p-4 border-t border-base-content/5 bg-base-200/30">
            <div class="flex items-center gap-3 p-2 rounded-2xl bg-base-100 ring-1 ring-base-content/5 shadow-sm">
              <div class="avatar placeholder">
                <div class="bg-primary/10 text-primary rounded-xl w-10">
                  <span class="text-sm font-black">{{ user.name.charAt(0).toUpperCase() }}</span>
                </div>
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-black truncate">{{ user.name }}</p>
                <p class="text-[10px] font-bold text-success uppercase tracking-wider">Online</p>
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
import { useState } from 'nuxt/app'
const user = useState<{ name: string } | null>('user')
</script>

<style scoped>
.nav-link {
  @apply flex items-center gap-4 px-4 py-3 rounded-2xl font-bold text-sm text-base-content/60 transition-all duration-200 hover:bg-primary/5 hover:text-primary;
}

.nav-link.active {
  @apply bg-primary text-primary-content shadow-lg shadow-primary/20 hover:bg-primary hover:text-primary-content;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 10px;
}
</style>
