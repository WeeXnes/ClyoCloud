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
const hoveredVideo = ref<string | null>(null)
const visibleVideos = ref<Set<string>>(new Set())
const isMobile = ref(false)
const mobileAutoPreview = ref(true)
let touchTimer: any = null
let observer: IntersectionObserver | null = null

const fetchUserSettings = async () => {
  try {
    const response = await fetch('/api/user-settings', { credentials: 'include' })
    if (response.ok) {
      const data = await response.json()
      mobileAutoPreview.value = data.mobileAutoPreview ?? true
    }
  } catch (err) {
    console.error('Error fetching user settings:', err)
  }
}

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

const handleTouchStart = (path: string) => {
  if (isMobile.value && mobileAutoPreview.value) return
  if (touchTimer) clearTimeout(touchTimer)
  touchTimer = setTimeout(() => {
    hoveredVideo.value = path
  }, 200)
}

const handleTouchEnd = () => {
  if (isMobile.value && mobileAutoPreview.value) return
  if (touchTimer) clearTimeout(touchTimer)
  hoveredVideo.value = null
}

const setupObserver = () => {
  if (!mobileAutoPreview.value) {
    if (observer) observer.disconnect()
    visibleVideos.value.clear()
    return
  }

  if (observer) observer.disconnect()
  
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const videoPath = (entry.target as HTMLElement).dataset.videoPath
      if (!videoPath) return
      
      if (entry.isIntersecting) {
        visibleVideos.value.add(videoPath)
      } else {
        visibleVideos.value.delete(videoPath)
      }
    })
  }, { threshold: 0.5 })

  setTimeout(() => {
    const elements = document.querySelectorAll('.video-thumbnail-container')
    elements.forEach(el => observer?.observe(el))
  }, 100)
}

const totalVideosCount = ref(0)
const currentPage = ref(1)
const videosPerPage = 30

async function fetchVideos() {
  try {
    isLoading.value = true
    error.value = null
    
    const params = new URLSearchParams()
    params.append('page', currentPage.value.toString())
    params.append('limit', videosPerPage.toString())
    if (searchQuery.value.trim()) {
      params.append('search', searchQuery.value.trim())
    }

    const response = await fetch(`/api/videos?${params.toString()}`, {
      credentials: 'include',
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch videos: ${response.statusText}`)
    }
    
    const data = await response.json()
    if (data && typeof data === 'object' && 'items' in data) {
      videos.value = data.items
      totalVideosCount.value = data.total
    } else {
      videos.value = data
      totalVideosCount.value = data.length
    }
  } catch (err) {
    console.error('Error fetching videos:', err)
    error.value = 'Failed to load videos. Please try again.'
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await fetchVideos()
  await fetchUserSettings()
  checkMobile()
  if (isMobile.value && mobileAutoPreview.value) setupObserver()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  if (observer) observer.disconnect()
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
  return ['mp4', 'webm', 'mov', 'mkv'].includes(ext)
}

const getThumbnailUrl = (fullPath: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  return `${baseUrl}/thumbnail/${encodeURIComponent(fullPath)}`
}

const getPreviewUrl = (fullPath: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  return `${baseUrl}/preview/${encodeURIComponent(fullPath)}`
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

const debounceFetch = (() => {
  let timer: any
  return () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      currentPage.value = 1
      fetchVideos()
    }, 500)
  }
})()

watch(searchQuery, debounceFetch)
watch(currentPage, fetchVideos)

const paginatedVideos = computed(() => videos.value)

watch(paginatedVideos, () => {
  if (isMobile.value) {
    setupObserver()
  }
}, { deep: true })

const totalPages = computed(() => {
  return Math.ceil(totalVideosCount.value / videosPerPage)
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
  <div class="min-h-screen bg-base-200/50 flex flex-col font-sans">
    <!-- Edge-to-Edge Sticky Header -->
    <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/10">
      <div class="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            <div>
              <h1 class="text-lg font-bold tracking-tight flex items-center gap-2 text-base-content">
                <Icon name="mdi:play-box-multiple-outline" class="text-primary w-5 h-5" />
                Media Library
              </h1>
              <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest pl-1">{{ totalVideosCount }} media files</p>
            </div>
          </div>

          <div class="relative w-full sm:max-w-xs lg:max-w-md">
            <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Icon name="mdi:magnify" class="w-4 h-4 text-base-content/30" />
            </div>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search media..."
              class="input input-sm input-bordered w-full pl-9 bg-base-100/50 focus:bg-base-100 transition-all border-base-content/10 font-bold text-xs rounded-lg"
            />
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-1 w-full">
      <!-- Loading State -->
      <div v-if="isLoading" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <div v-for="i in 10" :key="i" class="flex flex-col gap-3">
          <div class="aspect-video w-full bg-base-300 animate-pulse rounded-lg"></div>
          <div class="h-3.5 w-3/4 bg-base-300 animate-pulse rounded"></div>
          <div class="h-2.5 w-1/2 bg-base-300 animate-pulse rounded"></div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="alert alert-error py-3 rounded-lg text-xs font-bold text-white shadow-sm border-none">
        <Icon name="mdi:alert-circle" class="w-5 h-5" />
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
            class="relative aspect-video overflow-hidden rounded-lg bg-base-300 border border-base-content/5 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 cursor-pointer group/thumb video-thumbnail-container"
            :data-video-path="video.fullPath"
            @click="goToVideo(video.fullPath)"
            @mouseenter="hoveredVideo = video.fullPath"
            @mouseleave="hoveredVideo = null"
            @touchstart.passive="handleTouchStart(video.fullPath)"
            @touchend="handleTouchEnd"
            @touchmove="handleTouchEnd"
          >
            <img
              v-if="hasThumbnail(video.name)"
              :src="getThumbnailUrl(video.fullPath)"
              class="h-full w-full object-cover transition-transform duration-500 group-hover/thumb:scale-105"
              alt=""
              loading="lazy"
            />
            <div v-else class="flex h-full w-full items-center justify-center">
              <Icon name="mdi:video-off-outline" class="w-10 h-10 text-base-content/10" />
            </div>

            <!-- Video Preview Overlay -->
            <div v-if="hoveredVideo === video.fullPath || (isMobile && visibleVideos.has(video.fullPath))" 
                 class="absolute inset-0 z-10 animate-in fade-in duration-200">
              <img :src="getPreviewUrl(video.fullPath)" 
                   class="w-full h-full object-cover opacity-0 transition-opacity duration-300" 
                   @load="$event.target.classList.remove('opacity-0')"
                   alt="Preview" />
            </div>

            <!-- Overlays -->
            <div class="absolute inset-0 z-20 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-300 flex items-center justify-center">
               <div class="bg-primary/90 p-2.5 rounded-lg text-primary-content shadow-lg scale-90 group-hover/thumb:scale-100 transition-transform">
                 <Icon name="mdi:play" class="w-6 h-6" />
               </div>
            </div>

            <!-- Shared Indicator -->
            <div v-if="video.meta.isPublic" 
                 class="absolute top-2 right-2 z-20 bg-success text-success-content w-6 h-6 flex items-center justify-center rounded shadow-sm backdrop-blur-md hover:scale-105 transition-all" 
                 title="Copy Shared Link"
                 @click.stop="copyPublicLinkForVideo(video.fullPath)">
              <Icon name="mdi:share-variant" class="w-3.5 h-3.5" />
            </div>
          </div>

          <!-- Metadata -->
          <div class="flex flex-col gap-1 px-1">
            <h3 
              class="font-bold text-xs leading-snug line-clamp-2 group-hover:text-primary transition-colors cursor-pointer text-base-content"
              @click="goToVideo(video.fullPath)"
            >
              {{ video.name }}
            </h3>
            
            <div class="flex items-center gap-2 text-[9px] text-base-content/40 font-bold uppercase tracking-widest">
              <span>{{ formatFileSize(video.size) }}</span>
              <span class="w-0.5 h-0.5 rounded-full bg-base-content/20"></span>
              <span>{{ formatDate(video.lastModified) }}</span>
            </div>

            <!-- Tags -->
            <div v-if="video.meta.tags?.length" class="flex flex-wrap gap-1 mt-1.5">
              <span
                v-for="tag in video.meta.tags.slice(0, 3)"
                :key="tag.name"
                class="badge badge-xs border-none text-[8px] font-bold py-2 rounded-sm text-white"
                :style="{ backgroundColor: tag.color }"
              >
                {{ tag.name }}
              </span>
              <span v-if="video.meta.tags.length > 3" class="text-[8px] text-base-content/30 font-bold self-center uppercase tracking-tighter">
                +{{ video.meta.tags.length - 3 }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="flex flex-col items-center justify-center py-24 text-center">
        <div class="bg-base-200/50 p-6 rounded-xl mb-6">
          <Icon name="mdi:video-plus-outline" class="w-16 h-16 text-base-content/10" />
        </div>
        <h3 class="text-xl font-bold tracking-tight text-base-content">No media identified</h3>
        <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">Adjust your filter parameters or populate your cloud with video content to begin playback.</p>
        <NuxtLink to="/files" class="btn btn-primary btn-sm mt-8 px-8 rounded-lg shadow-sm font-bold uppercase tracking-widest text-[10px]">Upload Content</NuxtLink>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-center items-center mt-16 gap-3">
        <button
          @click="prevPage"
          :disabled="currentPage === 1"
          class="btn btn-ghost btn-sm border border-base-content/10 bg-base-100/50 rounded-lg gap-2 font-bold text-[10px] uppercase tracking-widest"
        >
          <Icon name="mdi:chevron-left" class="w-4 h-4" />
          Prev
        </button>
        
        <div class="flex gap-1.5 hidden sm:flex">
          <button 
            v-for="(page, idx) in displayedPages" 
            :key="idx"
            class="btn btn-sm w-9 h-9 p-0 rounded-lg font-bold text-[10px]"
            :class="[
              currentPage === page ? 'btn-primary text-primary-content shadow-sm' : 'btn-ghost border border-base-content/5 bg-base-100/50',
              page === '...' ? 'btn-disabled opacity-30 border-none' : ''
            ]"
            @click="setPage(page)"
          >
            {{ page }}
          </button>
        </div>
        <span class="sm:hidden text-[10px] font-bold uppercase tracking-widest text-base-content/40">Page {{ currentPage }} of {{ totalPages }}</span>

        <button
          @click="nextPage"
          :disabled="currentPage === totalPages"
          class="btn btn-ghost btn-sm border border-base-content/10 bg-base-100/50 rounded-lg gap-2 font-bold text-[10px] uppercase tracking-widest"
        >
          Next
          <Icon name="mdi:chevron-right" class="w-4 h-4" />
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
