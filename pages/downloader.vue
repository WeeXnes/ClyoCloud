<template>
  <div>
    <div class="flex justify-between items-center mb-4 lg:mb-6">
      <div class="flex items-center gap-2">
        <label for="sidebar-drawer" class="btn btn-ghost btn-circle lg:hidden">
          <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
          </svg>
        </label>
        <h2 class="text-lg lg:text-xl font-semibold">Downloader</h2>
      </div>
    </div>

    <div class="mt-8 p-4 border rounded shadow-sm max-w-md mx-auto">
      <h3 class="text-lg font-semibold mb-2">Download Media</h3>
      <div class="flex gap-2">
        <input v-model="downloadUrl" type="text" placeholder="Enter URL" class="input input-bordered w-full" />
        <button @click="downloadMedia" class="btn btn-primary">Download</button>
      </div>
    </div>
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
