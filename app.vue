<!-- app.vue -->
<template>
  <div class="min-h-screen bg-base-200" data-theme="onedev">
    <div v-if="user" class="drawer lg:drawer-open">
      <input id="sidebar-drawer" type="checkbox" class="drawer-toggle" />
      <div class="drawer-content flex flex-col">
        <div class="flex-1 p-4 lg:p-6">
          <NuxtPage />
        </div>
      </div>
      <div class="drawer-side">
        <label for="sidebar-drawer" class="drawer-overlay"></label>
        <div class="w-64 bg-base-100 shadow-xl h-full">
          <ul class="menu menu-compact flex flex-col p-4">
            <li>
              <NuxtLink to="/">
                <Icon name="ic:baseline-house" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" />
                Home
              </NuxtLink>
            </li>            <li>
              <NuxtLink to="/files">
                <Icon name="ic:round-folder" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" />
                Folders
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/media">
                <Icon name="material-symbols:video-library-rounded" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" />
                Media
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/downloader">
                <Icon name="material-symbols:download-rounded" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" />
                Downloader
              </NuxtLink>
            </li>
          </ul>
        </div>
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