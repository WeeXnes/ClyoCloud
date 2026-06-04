<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getIconForExtension } from '~/core/fileIcons'

definePageMeta({
  layout: false
})

const route = useRoute()
const username = route.params.username as string
const pathParam = Array.isArray(route.params.path) ? route.params.path.join('/') : route.params.path

const fileInfo = ref<any>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const fetchFileInfo = async () => {
  try {
    const response = await fetch(`/api/public/file-info?username=${encodeURIComponent(username)}&path=${encodeURIComponent(pathParam)}`)
    if (!response.ok) {
      throw new Error('File not found or not public')
    }
    fileInfo.value = await response.json()
  } catch (err: any) {
    error.value = err.message
  } finally {
    isLoading.value = false
  }
}

const getPublicFileUrl = () => {
  return `/p/file/${encodeURIComponent(username)}/${encodeURIComponent(pathParam)}`
}

const getPublicStreamUrl = () => {
  return `/p/stream/${encodeURIComponent(username)}/${encodeURIComponent(pathParam)}`
}

const formatFileSize = (size: number): string => {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`
}

const isVideoFile = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['mp4', 'webm'].includes(ext)
}

const isImageFile = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)
}

onMounted(fetchFileInfo)
</script>

<template>
  <div class="min-h-screen bg-base-200/50 font-sans flex flex-col">
    <!-- Compact Header -->
    <header class="w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/5 py-3 px-6 sticky top-0 z-50">
      <div class="max-w-3xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-md shadow-primary/20">
            <img src="/clyo.png" class="w-4 h-4 object-contain" alt="Clyo Logo" />
          </div>
          <div>
            <h1 class="font-black text-sm tracking-tight leading-none">ClyoCloud</h1>
            <span class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">Secure Share</span>
          </div>
        </div>
        
        <NuxtLink to="/login" class="btn btn-ghost btn-xs h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider">
          Sign In
        </NuxtLink>
      </div>
    </header>

    <main class="flex-1 max-w-3xl mx-auto w-full px-4 py-8 sm:py-12 flex flex-col items-center justify-center">
      
      <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col items-center gap-4">
        <div class="loading loading-spinner loading-md text-primary"></div>
        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30">Decrypting Link</p>
      </div>
      
      <!-- Error State -->
      <div v-else-if="error" class="w-full max-w-sm bg-base-100 rounded-3xl shadow-xl border border-base-content/5 p-8 text-center">
        <div class="bg-error/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5">
          <Icon name="mdi:alert-circle" class="w-8 h-8 text-error" />
        </div>
        <h2 class="text-xl font-black tracking-tight mb-2">Access Denied</h2>
        <p class="text-xs font-medium text-base-content/50 mb-6 leading-relaxed">{{ error }}</p>
        <NuxtLink to="/" class="btn btn-primary btn-sm btn-block rounded-xl h-11 shadow-lg">Return Home</NuxtLink>
      </div>

      <!-- Minimal Shared Card -->
      <div v-else-if="fileInfo" class="w-full bg-base-100 rounded-[1.5rem] shadow-2xl shadow-base-content/5 border border-base-content/5 overflow-hidden flex flex-col">
        
        <!-- Integrated Preview -->
        <div v-if="isImageFile(fileInfo.name) || isVideoFile(fileInfo.name)" class="w-full bg-black/5 border-b border-base-content/5">
           <div class="flex items-center justify-center bg-black/95">
              <img v-if="isImageFile(fileInfo.name)" :src="getPublicFileUrl()" class="max-h-[50vh] w-full object-contain" :alt="fileInfo.name" />
              <video v-else-if="isVideoFile(fileInfo.name)" controls class="w-full aspect-video">
                <source :src="getPublicStreamUrl()" type="video/mp4" />
              </video>
           </div>
        </div>

        <!-- Content Area -->
        <div class="p-6 sm:p-8">
          <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
            <div class="flex items-center gap-4 min-w-0">
              <div class="bg-base-200 w-16 h-16 rounded-2xl shadow-inner shrink-0 ring-1 ring-base-content/5 flex items-center justify-center">
                <Icon :name="fileInfo.isFolder ? 'vscode-icons:default-folder' : getIconForExtension(fileInfo.name)" class="w-9 h-9" />
              </div>
              <div class="min-w-0">
                <h2 class="text-lg font-black tracking-tight truncate leading-tight mb-0.5" :title="fileInfo.isFolder ? `${fileInfo.name}.zip` : fileInfo.name">
                  {{ fileInfo.isFolder ? `${fileInfo.name}.zip` : fileInfo.name }}
                </h2>
                <div class="flex items-center gap-3 text-[10px] font-bold text-base-content/40 uppercase tracking-widest">
                  <span>{{ formatFileSize(fileInfo.size) }}</span>
                  <span class="w-1 h-1 rounded-full bg-base-content/20"></span>
                  <span>{{ new Date(fileInfo.lastModified).toLocaleDateString() }}</span>
                  <span v-if="fileInfo.isFolder" class="badge badge-ghost badge-xs text-[9px] font-black tracking-widest py-2">Bundle</span>
                </div>
              </div>
            </div>

            <div class="shrink-0">
              <a :href="getPublicFileUrl()" download class="btn btn-primary rounded-xl px-6 h-12 shadow-lg shadow-primary/20 gap-2 w-full sm:w-auto">
                <Icon name="mdi:download" class="w-4 h-4" />
                <span class="font-bold text-xs uppercase tracking-wider">Download</span>
              </a>
            </div>
          </div>

          <!-- Tags -->
          <div v-if="fileInfo.meta?.tags?.length" class="flex flex-wrap gap-1.5 mt-6">
            <span v-for="tag in fileInfo.meta.tags" 
                  :key="tag.name" 
                  class="badge badge-xs border-none text-white font-bold py-2.5 px-3" 
                  :style="{ backgroundColor: tag.color }">
              {{ tag.name }}
            </span>
          </div>

          <!-- Description -->
          <div v-if="fileInfo.meta?.description" class="mt-6 bg-base-200/50 p-4 sm:p-5 rounded-2xl border border-base-content/5">
            <h3 class="text-[9px] font-black uppercase tracking-[0.2em] text-base-content/30 mb-2">Note from owner</h3>
            <p class="text-xs font-medium text-base-content/70 leading-relaxed whitespace-pre-line">
              {{ fileInfo.meta.description }}
            </p>
          </div>
        </div>

        <div class="bg-base-200/30 px-6 py-3 border-t border-base-content/5 flex items-center justify-between">
           <div class="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-base-content/30">
             <Icon name="mdi:shield-check" class="text-success w-3 h-3" />
             Verified Link
           </div>
           <span class="text-[9px] font-bold uppercase tracking-widest text-base-content/20">ClyoCloud Secure</span>
        </div>
      </div>

      <!-- Footer Info -->
      <p class="mt-8 text-[9px] font-bold uppercase tracking-[0.3em] text-base-content/20">ClyoCloud - v{{ useRuntimeConfig().public.version }}</p>
    </main>
  </div>
</template>

<style scoped>
.btn:focus-visible {
  outline: 2px solid hsl(var(--p));
  outline-offset: 2px;
}
</style>
