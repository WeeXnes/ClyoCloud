<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'

useHead({
  title: 'Slideshow'
})
import type { SlideshowItem, File, Tag } from '~/types/File'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'

const route = useRoute()
const paths = ref<string[]>([])
const mediaItems = ref<SlideshowItem[]>([])
const currentIndex = ref(0)
const isLoading = ref(true)
const isPaused = ref(false)
const slideshowInterval = ref(5) // seconds
const isFullscreen = ref(false)
const timer = ref<any>(null)
const isMuted = ref(false)
const videoPlayer = ref<HTMLVideoElement | null>(null)

// Folder Picker State
const showPicker = ref(false)
const pickerCurrentPath = ref('')
const pickerFolders = ref<File[]>([])

const currentMedia = computed(() => mediaItems.value[currentIndex.value] || null)

const getImageUrl = (fullPath: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  return `${baseUrl}/file/${encodeURIComponent(fullPath)}`
}

const getStreamUrl = (fullPath: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  return `${baseUrl}/stream/${encodeURIComponent(fullPath)}`
}

const getThumbnailUrl = (fullPath: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  return `${baseUrl}/thumbnail/${encodeURIComponent(fullPath)}`
}

const getSourceType = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mov') return 'video/quicktime'
  if (ext === 'mkv') return 'video/x-matroska'
  return 'video/mp4'
}

const fetchMedia = async () => {
  if (paths.value.length === 0) return
  try {
    isLoading.value = true
    const response = await fetch(`/api/slideshow?paths=${encodeURIComponent(paths.value.join(','))}&shuffle=true`, { credentials: 'include' })
    if (!response.ok) throw new Error('Failed to fetch slideshow media')
    mediaItems.value = await response.json()
    currentIndex.value = 0
    startTimer()
  } catch (err) {
    console.error(err)
    createNotification('Failed to load slideshow content', NotificationType.ERROR)
  } finally {
    isLoading.value = false
  }
}

const nextMedia = () => {
  if (mediaItems.value.length === 0) return
  currentIndex.value = (currentIndex.value + 1) % mediaItems.value.length
  resetTimer()
}

const prevMedia = () => {
  if (mediaItems.value.length === 0) return
  currentIndex.value = (currentIndex.value - 1 + mediaItems.value.length) % mediaItems.value.length
  resetTimer()
}

const startTimer = () => {
  stopTimer()
  if (isPaused.value || !currentMedia.value) return

  if (currentMedia.value.type === 'image') {
    timer.value = setTimeout(() => {
      nextMedia()
    }, slideshowInterval.value * 1000)
  }
  // Videos handle their own "next" via @ended
}

const stopTimer = () => {
  if (timer.value) {
    clearTimeout(timer.value)
    timer.value = null
  }
}

const resetTimer = () => {
  stopTimer()
  startTimer()
}

const togglePlayPause = () => {
  isPaused.value = !isPaused.value
  if (isPaused.value) {
    stopTimer()
    if (videoPlayer.value) videoPlayer.value.pause()
  } else {
    startTimer()
    if (videoPlayer.value) videoPlayer.value.play()
  }
}

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement
}

// Picker Functions
const openPicker = async () => {
  pickerCurrentPath.value = ''
  await fetchPickerFolders('')
  showPicker.value = true
}

const fetchPickerFolders = async (path: string) => {
  try {
    const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`, { credentials: 'include' })
    if (!response.ok) throw new Error('Failed to fetch folders')
    const allItems: File[] = await response.json()
    pickerFolders.value = allItems.filter(item => item.isFolder)
    pickerCurrentPath.value = path
  } catch (err) {
    console.error(err)
    createNotification('Failed to load folders', NotificationType.ERROR)
  }
}

const navigatePicker = (folderName: string) => {
  const newPath = pickerCurrentPath.value ? `${pickerCurrentPath.value}/${folderName}` : folderName
  fetchPickerFolders(newPath)
}

const navigatePickerUp = () => {
  if (!pickerCurrentPath.value) return
  const parts = pickerCurrentPath.value.split('/')
  parts.pop()
  fetchPickerFolders(parts.join('/'))
}

const addFolderToPlaylist = () => {
  if (!paths.value.includes(pickerCurrentPath.value)) {
    paths.value.push(pickerCurrentPath.value)
    fetchMedia()
  }
  showPicker.value = false
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'ArrowRight' || e.key === ' ') nextMedia()
  if (e.key === 'ArrowLeft') prevMedia()
  if (e.key === 'f') toggleFullscreen()
}

onMounted(() => {
  const initialPaths = route.query.paths as string
  if (initialPaths) {
    paths.value = initialPaths.split(',')
    fetchMedia()
  } else {
    isLoading.value = false
  }
  
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  stopTimer()
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  window.removeEventListener('keydown', handleKeydown)
})

watch(currentMedia, () => {
  resetTimer()
})
</script>

<template>
  <div class="h-screen w-screen bg-black overflow-hidden relative flex items-center justify-center group">
    <!-- Back Button -->
    <button 
      @click="navigateTo('/files')" 
      class="absolute top-6 left-6 z-50 btn btn-circle btn-ghost bg-black/20 backdrop-blur-md text-white border-white/10 hover:bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <Icon name="mdi:arrow-left" class="w-6 h-6" />
    </button>

    <!-- Controls Overlay -->
    <div class="absolute top-6 right-6 z-50 flex flex-col gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
      <button 
        @click="openPicker" 
        class="btn btn-circle btn-ghost bg-black/20 backdrop-blur-md text-white border-white/10"
        title="Add Folder"
      >
        <Icon name="mdi:folder-plus" class="w-6 h-6" />
      </button>
      <button 
        @click="toggleFullscreen" 
        class="btn btn-circle btn-ghost bg-black/20 backdrop-blur-md text-white border-white/10"
      >
        <Icon :name="isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'" class="w-6 h-6" />
      </button>
      <button 
        @click="isMuted = !isMuted" 
        class="btn btn-circle btn-ghost bg-black/20 backdrop-blur-md text-white border-white/10"
      >
        <Icon :name="isMuted ? 'mdi:volume-off' : 'mdi:volume-high'" class="w-6 h-6" />
      </button>

    </div>

    <!-- Media Content -->
    <div v-if="isLoading" class="flex flex-col items-center gap-4 text-white">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <p class="text-[10px] font-bold uppercase tracking-widest opacity-50">Calibrating Projection...</p>
    </div>

    <div v-else-if="currentMedia" class="w-full h-full flex items-center justify-center">
      <transition name="fade" mode="out-in">
        <div :key="currentMedia.fullPath" class="w-full h-full flex items-center justify-center">
          <img 
            v-if="currentMedia.type === 'image'" 
            :src="getImageUrl(currentMedia.fullPath)" 
            class="max-w-full max-h-full object-contain shadow-2xl"
          />
          <video 
            v-else-if="currentMedia.type === 'video'" 
            ref="videoPlayer"
            :src="getStreamUrl(currentMedia.fullPath)" 
            class="max-w-full max-h-full object-contain"
            :autoplay="!isPaused"
            :muted="isMuted"
            @ended="nextMedia"
            playsinline
          />
        </div>
      </transition>
    </div>

    <div v-else class="text-white text-center space-y-6">
      <Icon name="mdi:image-multiple-outline" class="w-24 h-24 opacity-10" />
      <div>
        <h2 class="text-xl font-bold uppercase tracking-widest">No Content Loaded</h2>
        <p class="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-2">Add folders to start the sequence</p>
      </div>
      <button @click="openPicker" class="btn btn-primary btn-sm rounded-lg px-8 font-bold uppercase text-[10px] tracking-widest">Add Folders</button>
    </div>

    <!-- Bottom Navigation Bar -->
    <div class="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 px-8 py-3.5 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-[50]">
      <button @click="prevMedia" class="btn btn-ghost btn-circle text-white hover:bg-white/10 btn-sm md:btn-md">
        <Icon name="mdi:skip-previous" class="w-6 h-6 md:w-8 md:h-8" />
      </button>
      <button @click="togglePlayPause" class="btn btn-circle btn-primary shadow-lg shadow-primary/20 btn-sm md:btn-md">
        <Icon :name="isPaused ? 'mdi:play' : 'mdi:pause'" class="w-6 h-6 md:w-8 md:h-8" />
      </button>
      <button @click="nextMedia" class="btn btn-ghost btn-circle text-white hover:bg-white/10 btn-sm md:btn-md">
        <Icon name="mdi:skip-next" class="w-6 h-6 md:w-8 md:h-8" />
      </button>
      
      <div class="h-8 w-px bg-white/10"></div>
      
      <!-- Slide Duration Slider -->
      <div class="flex items-center gap-3">
         <Icon name="mdi:timer-outline" class="w-5 h-5 text-white/50" title="Slide Duration" />
         <input 
           type="range" 
           min="2" 
           max="30" 
           v-model.number="slideshowInterval" 
           class="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer focus:outline-none" 
           style="accent-color: var(--p);"
           @input="resetTimer"
         />
         <span class="text-[9px] font-bold text-white/50 w-6 uppercase tracking-widest">{{ slideshowInterval }}s</span>
      </div>

      <div class="h-8 w-px bg-white/10"></div>
      
      <div class="text-white text-[10px] font-bold uppercase tracking-widest tabular-nums">
        {{ currentIndex + 1 }} / {{ mediaItems.length }}
      </div>
    </div>

    <!-- Info Box -->
    <div class="absolute bottom-6 left-6 z-[40] max-w-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
      <h3 class="text-white font-bold text-sm tracking-tight truncate drop-shadow-lg">{{ currentMedia?.name }}</h3>
      <div class="flex gap-2 mt-2">
        <span v-for="tag in currentMedia?.meta.tags" :key="tag.name" class="badge badge-xs border-none text-white font-bold py-2" :style="{ backgroundColor: tag.color }">
          {{ tag.name }}
        </span>
      </div>
    </div>

    <!-- Folder Picker Modal -->
    <div class="modal backdrop-blur-md" :class="{ 'modal-open': showPicker }">
      <div class="modal-box rounded-xl bg-[#0d1117] text-white border border-white/10 p-0 max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        <div class="p-6 border-b border-white/10 shrink-0">
          <h3 class="font-bold text-base tracking-tight">Add Folder to Playlist</h3>
          <p class="text-[9px] font-bold text-white/40 uppercase tracking-widest mt-1">Select a directory to include in the slideshow</p>
        </div>

        <div class="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <!-- Breadcrumbs -->
          <div class="flex items-center gap-1.5 mb-4 text-[9px] font-bold uppercase tracking-widest text-white/30 overflow-x-auto no-scrollbar whitespace-nowrap">
            <span class="cursor-pointer hover:text-primary" @click="fetchPickerFolders('')">Root</span>
            <template v-for="(part, idx) in pickerCurrentPath.split('/')" :key="idx">
              <span v-if="part">
                <Icon name="mdi:chevron-right" class="w-3 h-3 mx-1" />
                <span class="cursor-pointer hover:text-primary" @click="fetchPickerFolders(pickerCurrentPath.split('/').slice(0, idx + 1).join('/'))">{{ part }}</span>
              </span>
            </template>
          </div>

          <div class="space-y-1">
            <div v-if="pickerCurrentPath" @click="navigatePickerUp" class="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
              <Icon name="mdi:folder-upload-outline" class="w-5 h-5 text-primary/60 group-hover:text-primary" />
              <span class="text-xs font-bold uppercase tracking-widest">.. Back</span>
            </div>
            <div v-for="folder in pickerFolders" :key="folder.name" @click="navigatePicker(folder.name)" class="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors group">
              <Icon name="vscode-icons:default-folder" class="w-5 h-5" />
              <span class="text-xs font-bold truncate group-hover:text-primary">{{ folder.name }}</span>
            </div>
            <div v-if="pickerFolders.length === 0" class="py-12 text-center opacity-30">
               <Icon name="mdi:folder-outline" class="w-12 h-12 mx-auto mb-2" />
               <p class="text-[9px] font-bold uppercase tracking-widest">No subfolders found</p>
            </div>
          </div>
        </div>

        <div class="p-6 bg-white/5 border-t border-white/10 shrink-0 flex gap-3">
          <button @click="showPicker = false" class="btn btn-ghost flex-1 h-11 rounded-lg font-bold text-[10px] uppercase tracking-widest">Cancel</button>
          <button @click="addFolderToPlaylist" class="btn btn-primary flex-1 h-11 rounded-lg shadow-sm font-bold text-[10px] uppercase tracking-widest">Add Selected</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
