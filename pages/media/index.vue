<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import type { Video, FileMeta, Tag } from '~/types/File'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'
import { copyToClipboard } from '~/core/clipboard'

const videos = ref<Video[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')

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

const getThumbnailUrl = (fullPath: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  return `${baseUrl}/thumbnail/${encodeURIComponent(fullPath)}`
}

const getVideoUrl = (fullPath: string) => {
  const segments = fullPath.split('/')
  const encodedPath = segments.map(segment => encodeURIComponent(segment)).join('/')
  return `/media/${encodedPath}`
}

const goToVideo = (fullPath: string) => {
  navigateTo(getVideoUrl(fullPath))
}

const copyPublicLinkForVideo = async (fullPath: string) => {
  const user = useState<any>('user')
  const username = user.value?.name
  if (!username) return

  const url = useRequestURL()
  const publicUrl = `${url.origin}/p/${username}/${encodeURIComponent(fullPath)}`
  
  const success = await copyToClipboard(publicUrl)
  if (success) {
    createNotification('Public link copied to clipboard!', NotificationType.SUCCESS)
  } else {
    createNotification('Failed to copy link', NotificationType.ERROR)
  }
}

watch(searchQuery, () => {
  currentPage.value = 1
})

const filteredVideos = computed(() => {
  if (!searchQuery.value.trim()) {
    return videos.value
  }
  const query = searchQuery.value.trim().toLowerCase()
  return videos.value.filter(video => {
    const nameMatch = video.name.toLowerCase().includes(query)
    const tagMatch = video.meta.tags.some(tag => tag.name.toLowerCase().includes(query))
    return nameMatch || tagMatch
  })
})

const currentPage = ref(1)
const videosPerPage = 30

const paginatedVideos = computed(() => {
  const start = (currentPage.value - 1) * videosPerPage
  const end = start + videosPerPage
  return filteredVideos.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredVideos.value.length / videosPerPage)
})

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}
</script>

<template>
  <div class="container mx-auto p-4 sm:p-6 lg:p-8">
    <div class="flex items-center gap-2 mb-6">
      <label for="sidebar-drawer" class="btn btn-ghost btn-circle lg:hidden">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
        </svg>
      </label>
      <h2 class="text-lg lg:text-xl font-semibold">Media</h2>
    </div>

    <!-- Search Bar -->
    <div class="mb-6">
      <input
          v-model="searchQuery"
          type="text"
          placeholder="Search videos by name or tag..."
          class="input input-bordered input-primary w-full max-w-md"
      />
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center items-center h-64">
      <div class="loading loading-spinner loading-lg"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error">
      <span>{{ error }}</span>
    </div>

    <!-- Video Grid -->
    <div v-else-if="paginatedVideos.length" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <a
          v-for="video in paginatedVideos"
          :key="video.fullPath"
          class="card bg-base-100 shadow-xl cursor-pointer hover:bg-base-300"
          :href="getVideoUrl(video.fullPath)"
          @click.prevent="goToVideo(video.fullPath)"
      >
        <figure class="relative">
          <div v-if="video.meta.isPublic" 
               class="absolute top-2 right-2 z-10 bg-success text-success-content w-7 h-7 flex items-center justify-center rounded-full shadow-sm hover:scale-110 active:scale-95 transition-transform" 
               title="Copy Shared Link"
               @click.stop="copyPublicLinkForVideo(video.fullPath)">
            <Icon name="mdi:share-variant" class="w-4 h-4" />
          </div>
          <img
              v-if="hasThumbnail(video.name)"
              :src="getThumbnailUrl(video.fullPath)"
              class="w-full h-48 object-cover rounded-t-lg"
              alt="Video thumbnail"
              style="aspect-ratio: 16 / 9;"
          />
          <div v-else class="w-full h-48 bg-gray-200 flex items-center justify-center">
            <span class="text-gray-500">No Thumbnail</span>
          </div>
        </figure>
        <div class="card-body p-4">
          <h2 class="card-title text-base line-clamp-2">{{ video.name }}</h2>
          <p class="text-sm text-gray-500">
            {{ formatFileSize(video.size) }} • {{ formatDate(video.lastModified) }}
          </p>
          <div class="flex flex-wrap gap-2 mt-2">
            <span
                v-for="tag in video.meta.tags"
                :key="tag.name"
                class="badge"
                :style="{ backgroundColor: tag.color }"
            >
              {{ tag.name }}
            </span>
          </div>
        </div>
      </a>
    </div>

    <!-- Pagination Controls -->
    <div v-if="totalPages > 1" class="flex justify-center items-center mt-8">
      <button
          @click="prevPage"
          :disabled="currentPage === 1"
          class="btn btn-primary mr-4"
      >
        Previous
      </button>
      <span class="text-lg">{{ currentPage }} / {{ totalPages }}</span>
      <button
          @click="nextPage"
          :disabled="currentPage === totalPages"
          class="btn btn-primary ml-4"
      >
        Next
      </button>
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