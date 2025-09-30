<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Video, FileMeta } from '~/types/File'

const videos = ref<Video[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)

async function fetchVideos() {
  try {
    isLoading.value = true
    const response = await fetch('/api/videos', {
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch videos: ${response.statusText}`)
    }
    videos.value = await response.json()
  } catch (err) {
    console.error('Error fetching videos:', err)
    error.value = 'Failed to load videos. Please try again.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchVideos()
})

function formatFileSize(size: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const hasThumbnail = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['mp4'].includes(ext)
}

const getThumbnailUrl = (filename: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  return `${baseUrl}/thumbnail/${encodeURIComponent(filename)}`
}
</script>

<template>
  <div class="container mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">Browse Videos</h1>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center items-center h-64">
      <div class="loading loading-spinner loading-lg"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error">
      <span>{{ error }}</span>
    </div>

    <!-- Video Grid -->
    <div v-else-if="videos.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <div v-for="video in videos" :key="video.fullPath" class="card bg-base-100 shadow-xl">
        <figure>
          <img
              v-if="hasThumbnail(video.name)"
              :src="getThumbnailUrl(video.name)"
              class="w-full h-48 object-cover rounded-t-lg"
              alt="Video thumbnail"
              style="aspect-ratio: 16 / 9;"
          />
          <div v-else class="w-full h-48 bg-gray-200 flex items-center justify-center">
            <span class="text-gray-500">No Thumbnail</span>
          </div>
        </figure>
        <div class="card-body">
          <h2 class="card-title text-lg line-clamp-2">{{ video.name }}</h2>
          <p class="text-sm text-gray-500">
            {{ formatFileSize(video.size) }} • {{ formatDate(video.lastModified) }}
          </p>
          <div v-if="video.meta.tags.length" class="flex flex-wrap gap-2 mt-2">
            <span
                v-for="tag in video.meta.tags"
                :key="tag.name"
                class="badge"
                :style="{ backgroundColor: tag.color }"
            >
              {{ tag.name }}
            </span>
          </div>
          <div class="card-actions justify-end mt-4">
            <button class="btn btn-primary btn-sm">Play</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12">
      <p class="text-xl text-gray-500">No videos found.</p>
    </div>
  </div>
</template>

<style scoped>
/* Ensure long titles don't overflow */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>