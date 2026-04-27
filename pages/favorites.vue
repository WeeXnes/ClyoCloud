<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getIconForExtension } from '~/core/fileIcons'
import type { File } from '~/types/File'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'

const files = ref<File[]>([])
const isLoading = ref(true)
const searchQuery = ref('')

const fetchFavorites = async () => {
  isLoading.value = true
  try {
    const data = await $fetch<File[]>('/api/favorites')
    files.value = data
  } catch (err) {
    console.error('Failed to fetch favorites:', err)
    createNotification('Failed to load favorites', NotificationType.ERROR)
  } finally {
    isLoading.value = false
  }
}

const filteredFiles = computed(() => {
  if (!searchQuery.value.trim()) return files.value
  const query = searchQuery.value.toLowerCase().trim()
  return files.value.filter(file => file.name.toLowerCase().includes(query))
})

const onFileClick = (file: File) => {
  // Navigate to the folder containing the file or the file itself
  const path = file.name
  const segments = path.split('/')
  if (file.isFolder) {
    navigateTo(`/files/${segments.map(encodeURIComponent).join('/')}`)
  } else {
    // Navigate to parent folder
    const parentPath = segments.slice(0, -1).map(encodeURIComponent).join('/')
    navigateTo(`/files/${parentPath}`)
  }
}

const toggleFavourite = async (file: File) => {
  try {
    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullPath: file.name, isFavourite: false }),
    })
    
    if (!response.ok) throw new Error('Failed to update favorite status')
    
    files.value = files.value.filter(f => f.name !== file.name)
    createNotification('Removed from favorites', NotificationType.INFO)
    
  } catch (err) {
    console.error(err)
    createNotification('Failed to update favorite status', NotificationType.ERROR)
  }
}

onMounted(fetchFavorites)
</script>

<template>
  <div class="min-h-screen bg-base-200/50">
    <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/5">
      <div class="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 class="text-xl font-black tracking-tight flex items-center gap-2">
              <Icon name="mdi:star" class="text-orange-500 w-6 h-6" />
              Favorites
            </h1>
            <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">Quick access to your pinned items</p>
          </div>

          <div class="relative w-full md:w-64">
            <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Icon name="mdi:magnify" class="w-4 h-4 text-base-content/30" />
            </div>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search favorites..."
              class="input input-sm input-bordered w-full pl-9 bg-base-100/50 focus:bg-base-100 transition-all border-base-content/10 font-medium"
            />
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div v-if="isLoading" class="flex flex-col gap-3">
        <div v-for="i in 5" :key="i" class="h-16 rounded-xl bg-base-300 animate-pulse"></div>
      </div>

      <div v-else-if="filteredFiles.length" class="flex flex-col gap-3">
        <div 
          v-for="file in filteredFiles" 
          :key="file.name"
          class="flex items-center gap-4 p-3 bg-base-100 rounded-xl border border-base-content/5 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer group"
          @click="onFileClick(file)"
        >
          <div class="flex items-center justify-center shrink-0 w-8 h-8">
            <Icon class="w-6 h-6" :name="file.isFolder ? 'vscode-icons:default-folder' : getIconForExtension(file.name)" />
          </div>

          <div class="flex-grow min-w-0">
            <h3 class="text-sm font-bold truncate group-hover:text-primary transition-colors">{{ file.name }}</h3>
            <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">
              {{ file.isFolder ? 'Folder' : (file.size / 1024 / 1024).toFixed(2) + ' MB' }}
            </p>
          </div>

          <button 
            class="btn btn-ghost btn-sm btn-circle text-orange-500"
            @click.stop="toggleFavourite(file)"
          >
            <Icon name="mdi:star" class="w-5 h-5" />
          </button>
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-32 text-center">
        <div class="bg-base-200/50 p-8 rounded-full mb-6">
          <Icon name="mdi:star-outline" class="w-20 h-20 text-base-content/10" />
        </div>
        <h3 class="text-2xl font-black tracking-tight">No favorites yet</h3>
        <p class="text-base-content/50 max-w-xs mt-2 font-medium">Items you star will appear here for quick access.</p>
        <NuxtLink to="/files" class="btn btn-primary mt-8 px-8 rounded-full shadow-lg shadow-primary/20">
          Go to Files
        </NuxtLink>
      </div>
    </main>
  </div>
</template>
