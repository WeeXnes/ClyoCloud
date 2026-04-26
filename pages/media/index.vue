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

const displayedPages = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const delta = 2
  const pages = []

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
    return pages
  }

  // Always show first page
  pages.push(1)

  if (current > delta + 2) {
    pages.push('...')
  }

  const start = Math.max(2, current - delta)
  const end = Math.min(total - 1, current + delta)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < total - (delta + 1)) {
    pages.push('...')
  }

  // Always show last page
  pages.push(total)

  return pages
})

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function setPage(page: number | string) {
  if (typeof page === 'number') {
    currentPage.value = page
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-200/50">
    <!-- Edge-to-Edge Sticky Header -->
    <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/5">
      <div class="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            <div>
              <h1 class="text-xl font-black tracking-tight flex items-center gap-2">
                <Icon name="mdi:play-box-multiple-outline" class="text-primary w-6 h-6" />
                Media Library
              </h1>
              <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">{{ videos.length }} videos stored</p>
            </div>
          </div>

          <div class="relative w-full sm:max-w-xs lg:max-w-md">
            <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Icon name="mdi:magnify" class="w-5 h-5 text-base-content/40" />
            </div>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by name or tags..."
              class="input input-bordered w-full pl-10 bg-base-100/50 focus:bg-base-100 transition-all border-base-content/10"
            />
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <!-- Loading State -->
      <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <div v-for="i in 10" :key="i" class="flex flex-col gap-3">
          <div class="aspect-video w-full bg-base-300 animate-pulse rounded-xl"></div>
          <div class="h-4 w-3/4 bg-base-300 animate-pulse rounded"></div>
          <div class="h-3 w-1/2 bg-base-300 animate-pulse rounded"></div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="alert alert-error shadow-lg">
        <Icon name="mdi:alert-circle" class="w-6 h-6" />
        <span>{{ error }}</span>
      </div>

      <!-- Video Grid -->
      <div v-else-if="paginatedVideos.length" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-10">
        <div
          v-for="video in paginatedVideos"
          :key="video.fullPath"
          class="group relative flex flex-col gap-3"
        >
          <!-- Thumbnail Container -->
          <div 
            class="relative aspect-video overflow-hidden rounded-xl bg-base-300 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer group/thumb"
            @click="goToVideo(video.fullPath)"
          >
            <img
              v-if="hasThumbnail(video.name)"
              :src="getThumbnailUrl(video.fullPath)"
              class="h-full w-full object-cover transition-transform duration-500 group-hover/thumb:scale-110"
              alt=""
            />
            <div v-else class="flex h-full w-full items-center justify-center">
              <Icon name="mdi:video-off-outline" class="w-12 h-12 text-base-content/20" />
            </div>

            <!-- Overlays -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-300 flex items-end p-3">
               <button class="btn btn-circle btn-sm btn-primary shadow-lg scale-90 group-hover/thumb:scale-100 transition-transform">
                 <Icon name="mdi:play" class="w-5 h-5" />
               </button>
            </div>

            <!-- Shared Indicator (Top Right) -->
            <div v-if="video.meta.isPublic" 
                 class="absolute top-2 right-2 z-10 bg-success text-success-content w-8 h-8 flex items-center justify-center rounded-full shadow-lg backdrop-blur-md hover:scale-110 active:scale-95 transition-all" 
                 title="Copy Shared Link"
                 @click.stop="copyPublicLinkForVideo(video.fullPath)">
              <Icon name="mdi:share-variant" class="w-4 h-4" />
            </div>
          </div>

          <!-- Metadata -->
          <div class="flex flex-col gap-1 px-1">
            <h3 
              class="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors cursor-pointer"
              @click="goToVideo(video.fullPath)"
            >
              {{ video.name }}
            </h3>
            
            <div class="flex items-center gap-2 text-[11px] text-base-content/50 font-medium uppercase tracking-wider">
              <span>{{ formatFileSize(video.size) }}</span>
              <span class="w-1 h-1 rounded-full bg-base-content/20"></span>
              <span>{{ formatDate(video.lastModified) }}</span>
            </div>

            <!-- Tags -->
            <div v-if="video.meta.tags?.length" class="flex flex-wrap gap-1 mt-1">
              <span
                v-for="tag in video.meta.tags.slice(0, 3)"
                :key="tag.name"
                class="badge badge-xs border-none text-[10px] font-bold py-2"
                :style="{ backgroundColor: tag.color, color: 'white' }"
              >
                {{ tag.name }}
              </span>
              <span v-if="video.meta.tags.length > 3" class="text-[10px] text-base-content/40 font-bold self-center">
                +{{ video.meta.tags.length - 3 }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="flex flex-col items-center justify-center py-24 text-center">
        <div class="bg-base-300/50 p-6 rounded-full mb-4">
          <Icon name="mdi:video-plus-outline" class="w-16 h-16 text-base-content/20" />
        </div>
        <h3 class="text-xl font-bold">No videos found</h3>
        <p class="text-base-content/60 max-w-xs mt-2">Try adjusting your search or upload some new content to get started.</p>
        <NuxtLink to="/files" class="btn btn-primary mt-6">Upload Videos</NuxtLink>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-center items-center mt-16 gap-4">
        <button
          @click="prevPage"
          :disabled="currentPage === 1"
          class="btn btn-outline btn-sm sm:btn-md gap-2"
        >
          <Icon name="mdi:chevron-left" class="w-5 h-5" />
          Previous
        </button>
        
        <div class="join hidden sm:flex">
          <button 
            v-for="(page, idx) in displayedPages" 
            :key="idx"
            class="join-item btn btn-sm"
            :class="{ 
              'btn-active btn-primary': currentPage === page,
              'btn-disabled': page === '...'
            }"
            @click="setPage(page)"
          >
            {{ page }}
          </button>
        </div>
        <span class="sm:hidden text-sm font-medium">Page {{ currentPage }} / {{ totalPages }}</span>

        <button
          @click="nextPage"
          :disabled="currentPage === totalPages"
          class="btn btn-outline btn-sm sm:btn-md gap-2"
        >
          Next
          <Icon name="mdi:chevron-right" class="w-5 h-5" />
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
