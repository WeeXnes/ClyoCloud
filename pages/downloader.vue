<template>
  <div class="min-h-screen bg-base-200/50 flex flex-col font-sans">
    <!-- Edge-to-Edge Sticky Header -->
    <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/5">
      <div class="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3">
          <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden">
            <Icon name="mdi:menu" class="w-5 h-5" />
          </label>
          <div>
            <h1 class="text-xl font-black tracking-tight flex items-center gap-2">
              <Icon name="mdi:cloud-download" class="text-primary w-6 h-6" />
              Downloader
            </h1>
            <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">Remote Fetching</p>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 p-4 sm:p-8">
      <div class="mt-8 p-6 bg-base-100 border border-base-content/5 rounded-3xl shadow-sm max-w-md mx-auto">
        <h3 class="text-lg font-black tracking-tight mb-4">Download Media</h3>
        <div class="flex flex-col gap-3">
          <input v-model="downloadUrl" type="text" placeholder="Enter URL" class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all" />
          <button @click="downloadMedia" class="btn btn-primary rounded-2xl gap-2 shadow-lg shadow-primary/20">
            <Icon name="mdi:download" class="w-5 h-5" />
            Download
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'

const downloadUrl = ref('');

async function downloadMedia() {
  if (!downloadUrl.value) return;
  try {
    const res = await $fetch('/api/download', {
      method: 'POST',
      body: { url: downloadUrl.value }
    });
    createNotification('Download started: ' + res.message, NotificationType.SUCCESS);
    downloadUrl.value = '';
  } catch (err: any) {
    const msg = err.data?.message || err.message || 'Unknown error';
    createNotification('Failed to start download: ' + msg, NotificationType.ERROR);
  }
}
</script>
