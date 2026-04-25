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

const getPublicThumbnailUrl = () => {
  return `/p/thumbnail/${encodeURIComponent(username)}/${encodeURIComponent(pathParam)}`
}

const isVideoFile = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['mp4', 'webm'].includes(ext)
}

const isImageFile = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
}

onMounted(fetchFileInfo)
</script>

<template>
  <div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
    <div v-if="isLoading" class="loading loading-spinner loading-lg"></div>
    
    <div v-else-if="error" class="card w-full max-w-md bg-base-100 shadow-xl">
      <div class="card-body items-center text-center">
        <Icon name="mdi:alert-circle" class="w-16 h-16 text-error" />
        <h2 class="card-title text-error">Access Denied</h2>
        <p>{{ error }}</p>
        <div class="card-actions">
          <NuxtLink to="/login" class="btn btn-primary">Go to Login</NuxtLink>
        </div>
      </div>
    </div>

    <div v-else-if="fileInfo" class="card w-full max-w-2xl bg-base-100 shadow-xl overflow-hidden">
      <!-- Media Preview -->
      <figure v-if="isImageFile(fileInfo.name)" class="bg-base-300">
        <img :src="getPublicFileUrl()" class="max-h-[60vh] object-contain" :alt="fileInfo.name" />
      </figure>
      <figure v-else-if="isVideoFile(fileInfo.name)" class="bg-black aspect-video">
        <video controls class="w-full h-full">
          <source :src="getPublicStreamUrl()" type="video/mp4" />
        </video>
      </figure>

      <div class="card-body">
        <div class="flex items-center gap-4">
          <Icon :name="fileInfo.isFolder ? 'vscode-icons:default-folder' : getIconForExtension(fileInfo.name)" class="w-10 h-10 shrink-0" />
          <div class="overflow-hidden">
            <h2 class="card-title truncate" :title="fileInfo.isFolder ? `${fileInfo.name}.zip` : fileInfo.name">
              {{ fileInfo.isFolder ? `${fileInfo.name}.zip` : fileInfo.name }}
            </h2>
            <p class="text-sm text-base-content/70">
              <template v-if="!fileInfo.isFolder">
                {{ (fileInfo.size / 1024 / 1024).toFixed(2) }} MB • 
              </template>
              {{ new Date(fileInfo.lastModified).toLocaleDateString() }}
            </p>
          </div>
        </div>

        <div v-if="fileInfo.meta?.tags?.length" class="flex flex-wrap gap-2 mt-4">
          <span v-for="tag in fileInfo.meta.tags" 
                :key="tag.name" 
                class="badge text-white" 
                :style="{ backgroundColor: tag.color }">
            {{ tag.name }}
          </span>
        </div>

        <div v-if="fileInfo.meta?.description" class="mt-4 p-4 bg-base-200 rounded-lg text-sm">
          {{ fileInfo.meta.description }}
        </div>

        <div class="card-actions justify-end mt-6">
          <a :href="getPublicFileUrl()" download class="btn btn-primary">
            <Icon name="mdi:download" class="w-5 h-5 mr-1" />
            Download File
          </a>
        </div>
      </div>
      
      <div class="bg-base-300 p-2 text-center text-xs text-base-content/50">
        Shared via ClyoCloud
      </div>
    </div>
  </div>
</template>
