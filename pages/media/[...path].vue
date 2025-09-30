<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { Video, FileMeta } from '~/types/File'

const route = useRoute()
const videos = ref<Video[]>([])
const currentVideo = ref<Video | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const showTagModal = ref(false)
const tagName = ref('')
const tagColor = ref('#4B5EAA') // Default to DaisyUI primary blue

const getStreamUrl = () => {
  const url = useRequestURL()
  const baseUrl = url.origin
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
  const segments = fullPath.split('/')
  const encodedPath = segments.map(segment => encodeURIComponent(segment)).join('/')
  navigateTo(`/media/${encodedPath}`)
}

const openTagModal = () => {
  tagName.value = ''
  tagColor.value = '#4B5EAA'
  showTagModal.value = true
}

const closeTagModal = () => {
  showTagModal.value = false
  tagName.value = ''
  tagColor.value = '#4B5EAA'
}

const addTag = async () => {
  if (!tagName.value.trim()) {
    alert('Tag name is required')
    return
  }
  if (!currentVideo.value) {
    alert('No video selected')
    return
  }
  try {
    const response = await fetch('/api/video-tag', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        fullPath: currentVideo.value.fullPath,
        tagName: tagName.value.trim(),
        tagColor: tagColor.value,
      }),
    })
    if (!response.ok) {
      throw new Error(`Failed to add tag: ${response.statusText}`)
    }
    await fetchVideos() // Refresh video list
    closeTagModal()
  } catch (err) {
    console.error('Error adding tag:', err)
    alert('Failed to add tag. Please try again.')
  }
}

const recommendedVideos = computed(() => {
  if (!currentVideo.value || !currentVideo.value.meta.tags.length) {
    // If no current video or no tags, return videos excluding current, unsorted
    return videos.value.filter(v => v.fullPath !== currentVideo.value?.fullPath)
  }

  const currentTags = new Set(currentVideo.value.meta.tags.map(tag => tag.name.toLowerCase()))

  // Map videos to their shared tag count and original video
  const videosWithTagCount = videos.value
      .filter(v => v.fullPath !== currentVideo.value?.fullPath) // Exclude current video
      .map(video => {
        const sharedTagCount = video.meta.tags.filter(tag =>
            currentTags.has(tag.name.toLowerCase())
        ).length
        return { video, sharedTagCount }
      })

  // Sort by shared tag count in descending order
  return videosWithTagCount
      .sort((a, b) => b.sharedTagCount - a.sharedTagCount)
      .map(item => item.video)
})

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
          <div class="flex flex-wrap gap-2 mb-4">
            <span
                v-for="tag in currentVideo.meta.tags"
                :key="tag.name"
                class="badge"
                :style="{ backgroundColor: tag.color }"
            >
              {{ tag.name }}
            </span>
            <button
                class="btn btn-secondary btn-sm"
                @click="openTagModal"
            >
              Add Tag
            </button>
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
                v-for="video in recommendedVideos"
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

      <!-- Tag Modal -->
      <div v-if="showTagModal" class="modal modal-open">
        <div class="modal-box">
          <h3 class="font-bold text-lg">Add Tag to Video</h3>
          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">Tag Name</span>
            </label>
            <input
                v-model="tagName"
                type="text"
                placeholder="Enter tag name"
                class="input input-bordered w-full"
            />
          </div>
          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">Tag Color</span>
            </label>
            <input
                v-model="tagColor"
                type="color"
                class="input input-bordered w-full"
            />
          </div>
          <div class="modal-action">
            <button class="btn btn-primary" @click="addTag">Add Tag</button>
            <button class="btn btn-ghost" @click="closeTagModal">Cancel</button>
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