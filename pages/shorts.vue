<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import type { Video } from '~/types/File'

const videos = ref<Video[]>([])
const isLoading = ref(true)
const isMuted = ref(true)
const observer = ref<IntersectionObserver | null>(null)
const videoRefs = ref<HTMLVideoElement[]>([])

const supportedExtensions = ['.mp4', '.webm', '.mov', '.mkv']

const fetchVideos = async () => {
  try {
    isLoading.value = true
    const response = await fetch('/api/videos', { credentials: 'include' })
    if (!response.ok) throw new Error('Failed to fetch videos')
    const allVideos: Video[] = await response.json()
    
    // Filter for supported videos and shuffle
    videos.value = allVideos
      .filter(v => supportedExtensions.some(ext => v.name.toLowerCase().endsWith(ext)))
      .sort(() => Math.random() - 0.5)
  } catch (err) {
    console.error('Error fetching videos for shorts:', err)
  } finally {
    isLoading.value = false
  }
}

const getStreamUrl = (fullPath: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  return `${baseUrl}/stream/${encodeURIComponent(fullPath)}`
}

const getSourceType = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mov') return 'video/quicktime'
  if (ext === 'mkv') return 'video/x-matroska'
  return 'video/mp4'
}

const toggleMute = () => {
  isMuted.value = !isMuted.value
  videoRefs.value.forEach(video => {
    if (video) video.muted = isMuted.value
  })
}

const setVideoRef = (el: any) => {
  if (el && !videoRefs.value.includes(el)) {
    videoRefs.value.push(el)
  }
}

onMounted(async () => {
  await fetchVideos()

  observer.value = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const video = entry.target as HTMLVideoElement
      if (entry.isIntersecting) {
        video.currentTime = 0
        video.play().catch(e => console.warn('Autoplay prevented:', e))
      } else {
        video.pause()
      }
    })
  }, {
    threshold: 0.8 // Trigger when 80% of the video is visible
  })

  // Watch for video elements being added to DOM
  nextTick(() => {
    videoRefs.value.forEach(video => {
      if (video && observer.value) {
        observer.value.observe(video)
      }
    })
  })
})

onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect()
  }
})

// Refresh/Shuffle
const refresh = () => {
  window.location.reload()
}
</script>

<template>
  <div class="h-[100dvh] w-full bg-black overflow-hidden relative">
    <!-- Back Button -->
    <button 
      @click="navigateTo('/')" 
      class="absolute top-6 left-6 z-50 btn btn-circle btn-ghost bg-black/20 backdrop-blur-md text-white border-white/10 hover:bg-black/40"
    >
      <Icon name="mdi:arrow-left" class="w-6 h-6" />
    </button>

    <!-- Controls -->
    <div class="absolute top-6 right-6 z-50 flex flex-col gap-4">
      <button 
        @click="toggleMute" 
        class="btn btn-circle btn-ghost bg-black/20 backdrop-blur-md text-white border-white/10"
      >
        <Icon :name="isMuted ? 'mdi:volume-off' : 'mdi:volume-high'" class="w-6 h-6" />
      </button>
      <button 
        @click="refresh" 
        class="btn btn-circle btn-ghost bg-black/20 backdrop-blur-md text-white border-white/10"
      >
        <Icon name="mdi:refresh" class="w-6 h-6" />
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="h-full w-full flex flex-col items-center justify-center text-white gap-4">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <p class="font-black uppercase tracking-[0.2em] text-[10px] opacity-50">Preparing your feed...</p>
    </div>

    <!-- Video Feed -->
    <div 
      v-else-if="videos.length" 
      class="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
    >
      <div 
        v-for="video in videos" 
        :key="video.fullPath" 
        class="h-[100dvh] w-full snap-center relative flex items-center justify-center bg-black"
      >
        <video
          :ref="setVideoRef"
          class="h-full w-full object-contain"
          loop
          playsinline
          :muted="isMuted"
        >
          <source :src="getStreamUrl(video.fullPath)" :type="getSourceType(video.name)" />
        </video>

        <!-- Video Info Overlay -->
        <div class="absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
          <div class="max-w-md">
            <h2 class="text-white font-black text-xl tracking-tight mb-2 drop-shadow-lg">
              {{ video.name }}
            </h2>
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="tag in video.meta.tags" 
                :key="tag.name"
                class="badge badge-sm border-none text-white font-bold"
                :style="{ backgroundColor: tag.color }"
              >
                {{ tag.name }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="h-full w-full flex flex-col items-center justify-center text-white p-8 text-center">
      <div class="bg-white/5 p-8 rounded-full mb-6">
        <Icon name="mdi:video-off-outline" class="w-16 h-16 opacity-20" />
      </div>
      <h3 class="text-xl font-black mb-2">No videos found</h3>
      <p class="text-white/50 text-sm max-w-xs mb-8">Upload some MP4 files to your cloud to see them here.</p>
      <NuxtLink to="/files" class="btn btn-primary rounded-xl px-8 shadow-lg">Go to Files</NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

video::-webkit-media-controls {
  display: none !important;
}
</style>
