<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Video, FileMeta } from '~/types/File'

const route = useRoute()
const videos = ref<Video[]>([])
const currentVideo = ref<Video | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

const getStreamUrl = () => {
  const url = useRequestURL()
  const baseUrl = url.origin
  // Join path segments without encoding slashes
  const subpath = Array.isArray(route.params.path) ? route.params.path.join('/') : route.params.path || ''
  return `${baseUrl}/stream/${encodeURIComponent(subpath)}`
}

const hasThumbnail = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['mp4'].includes(ext)
}

const getThumbnailUrl = (fullPath: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  return `${baseUrl}/thumbnail/${encodeURIComponent(fullPath)}`
}

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
    // Decode the route path to match video.fullPath
    const subpath = Array.isArray(route.params.path) ? route.params.path.map(decodeURIComponent).join('/') : decodeURIComponent(route.params.path || '')
    currentVideo.value = videos.value.find(video => video.fullPath === subpath) || null
  } catch (err) {
    console.error('Error fetching videos:', err)
    error.value = 'Failed to load video data. Please try again.'
  } finally {
    isLoading.value = false
  }
}

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

const goToVideo = (fullPath: string) => {
  // Encode segments individually to preserve slashes
  const segments = fullPath.split('/')
  const encodedPath = segments.map(segment => encodeURIComponent(segment)).join('/')
  navigateTo(`/media/${encodedPath}`)
}

onMounted(() => {
  fetchVideos()
})
</script>

<template>
  <div class="max-w-screen-xl mx-auto px-4 py-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center items-center h-64">
      <div class="loading loading-spinner loading-lg"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error">
      <span>{{ error }}</span>
    </div>

    <!-- Video Player and Info -->
    <div v-else-if="currentVideo">
      <!-- Video Player -->
      <div class="w-full">
        <video
            id="previewVideo"
            controls
            class="w-full rounded-lg aspect-video bg-black"
        >
          <source :src="getStreamUrl()" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      <!-- Video Info and Sidebar -->
      <div class="mt-6 flex flex-col lg:flex-row gap-8">
        <!-- Left: Video Title & Metadata -->
        <div class="flex-1">
          <!-- Title -->
          <h1 class="text-2xl font-bold mb-2">
            {{ currentVideo.name }}
          </h1>

          <!-- Metadata -->
          <div class="text-sm text-gray-500 mb-4">
            {{ formatFileSize(currentVideo.size) }} • {{ formatDate(currentVideo.lastModified) }}
          </div>

          <!-- Tags -->
          <div v-if="currentVideo.meta.tags.length" class="flex flex-wrap gap-2 mb-4">
            <span
                v-for="tag in currentVideo.meta.tags"
                :key="tag.name"
                class="badge"
                :style="{ backgroundColor: tag.color }"
            >
              {{ tag.name }}
            </span>
          </div>

          <!-- Description -->
          <div
              v-if="currentVideo.meta.description"
              class="bg-gray-100 p-4 rounded-lg text-sm text-gray-700 whitespace-pre-line"
          >
            {{ currentVideo.meta.description }}
          </div>
          <div v-else class="bg-base-300 p-4 rounded-lg text-sm text-gray-700">
            No description available.
          </div>
        </div>

        <!-- Right: Recommended Videos -->
        <div class="w-full lg:w-80">
          <h2 class="text-lg font-semibold mb-4">Recommended Videos</h2>
          <div class="space-y-4">
            <div
                v-for="video in videos.filter(v => v.fullPath !== currentVideo.fullPath)"
                :key="video.fullPath"
                class="flex gap-3 hover:bg-base-300 p-2 rounded-lg cursor-pointer"
                @click="goToVideo(video.fullPath)"
            >
              <img
                  v-if="hasThumbnail(video.name)"
                  :src="getThumbnailUrl(video.fullPath)"
                  alt="Thumbnail"
                  class="w-32 h-auto rounded"
                  style="aspect-ratio: 16 / 9;"
              />
              <div v-else class="w-32 h-18 bg-gray-200 flex items-center justify-center rounded">
                <span class="text-gray-500 text-xs">No Thumbnail</span>
              </div>
              <div class="flex flex-col">
                <p class="font-medium line-clamp-2">{{ video.name }}</p>
                <span class="text-sm text-gray-500">
                  {{ formatFileSize(video.size) }} • {{ formatDate(video.lastModified) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Not Found State -->
    <div v-else class="text-center py-12">
      <p class="text-xl text-gray-500">Video not found.</p>
    </div>
  </div>
</template>

<style scoped>
/* Tailwind handles most styling. Additional tweaks below. */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>