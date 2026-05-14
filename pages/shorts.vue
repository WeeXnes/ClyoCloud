<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import type { Video, Tag } from '~/types/File'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'

const videos = ref<Video[]>([])
const currentVisibleVideo = ref<Video | null>(null)
const isLoading = ref(true)
const isMuted = ref(true)
const isPaused = ref(false)

const showTagModal = ref(false)
const selectedTags = ref<Tag[]>([])
const predefinedTags = ref<Tag[]>([])
const showNewTagForm = ref(true)
const newTagName = ref('')
const newTagColor = ref('#4B5EAA')

const observer = ref<IntersectionObserver | null>(null)
const containerRefs = ref<Map<string, HTMLElement>>(new Map())
const videoRefs = ref<Map<string, HTMLVideoElement>>(new Map())
const currentIndex = ref(0)

const supportedExtensions = ['.mp4', '.webm', '.mov', '.mkv']

const handleScroll = (event: Event) => {
  const container = event.target as HTMLElement
  const index = Math.round(container.scrollTop / container.clientHeight)
  if (currentIndex.value !== index) {
    currentIndex.value = index
  }
}

const fetchVideos = async () => {
  try {
    isLoading.value = true
    containerRefs.value.clear()
    videoRefs.value.clear()
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

const toggleMute = () => {
  isMuted.value = !isMuted.value
}

const togglePlayPause = () => {
  if (!currentVisibleVideo.value) return
  const activeVideo = videoRefs.value.get(currentVisibleVideo.value.fullPath)
  if (!activeVideo) return

  if (activeVideo.paused) {
    activeVideo.play()
    isPaused.value = false
  } else {
    activeVideo.pause()
    isPaused.value = true
  }
}

const toggleFavourite = async (video: Video) => {
  const isFavourite = !video.meta.isFavourite
  try {
    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullPath: video.fullPath,
        isFavourite,
      }),
    })

    if (!response.ok) throw new Error('Failed to update favorite status')

    video.meta.isFavourite = isFavourite
    createNotification(`Video ${isFavourite ? 'added to' : 'removed from'} favorites`, NotificationType.INFO)
  } catch (err) {
    console.error(err)
    createNotification('Failed to update favorite status', NotificationType.ERROR)
  }
}

const openTagModal = async () => {
  if (!currentVisibleVideo.value) return
  selectedTags.value = currentVisibleVideo.value.meta.tags ? [...currentVisibleVideo.value.meta.tags] : []
  showNewTagForm.value = false
  newTagName.value = ''
  newTagColor.value = '#4B5EAA'
  showTagModal.value = true
  await fetchPredefinedTags()
}

const closeTagModal = () => {
  showTagModal.value = false
}

const fetchPredefinedTags = async () => {
  try {
    const response = await fetch('/api/tags', { credentials: 'include' })
    if (!response.ok) throw new Error(`Failed to fetch tags: ${response.statusText}`)
    predefinedTags.value = await response.json()
  } catch (err) {
    console.error('Error fetching tags:', err)
  }
}

const toggleTagSelection = (tag: Tag) => {
  const index = selectedTags.value.findIndex(t => t.name === tag.name)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag)
  }
}

const isTagSelected = (tag: Tag) => {
  return selectedTags.value.some(t => t.name === tag.name)
}

const addTags = async () => {
  if (!currentVisibleVideo.value) return
  let tagsToAdd: Tag[] = []
  if (showNewTagForm.value) {
    if (!newTagName.value.trim()) {
      createNotification('Tag name is required', NotificationType.WARNING)
      return
    }
    tagsToAdd.push({ name: newTagName.value, color: newTagColor.value })
  } else {
    tagsToAdd = selectedTags.value
  }

  if (tagsToAdd.length === 0) {
    createNotification('Please select or create at least one tag', NotificationType.WARNING)
    return
  }

  try {
    const currentTags = currentVisibleVideo.value.meta.tags || []
    let updatedTags = []

    if (!showNewTagForm.value) {
      // For single video, sync tags exactly (allows removal)
      const isSame = currentTags.length === tagsToAdd.length && 
                    currentTags.every(ct => tagsToAdd.some(ta => ta.name === ct.name))

      if (isSame) {
        createNotification('Tags already up to date', NotificationType.INFO)
        closeTagModal()
        return
      }
      updatedTags = tagsToAdd
    } else {
      // For new tag, strictly additive
      const tagsToActuallyAdd = tagsToAdd.filter(newTag => 
        !currentTags.some(existingTag => existingTag.name.toLowerCase() === newTag.name.toLowerCase())
      )

      if (tagsToActuallyAdd.length === 0) {
        createNotification('Tags already exist', NotificationType.INFO)
        closeTagModal()
        return
      }

      updatedTags = [...currentTags, ...tagsToActuallyAdd]
    }

    const response = await fetch('/api/file-meta', {      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullPath: currentVisibleVideo.value.fullPath,
        tags: updatedTags,
      }),
    })

    if (!response.ok) throw new Error('Failed to add tags')

    currentVisibleVideo.value.meta.tags = updatedTags
    createNotification('Tags added successfully', NotificationType.SUCCESS)
    closeTagModal()
  } catch (err) {
    console.error('Error adding tags:', err)
    createNotification('Failed to add tags', NotificationType.ERROR)
  }
}

const setVideoRef = (el: any, video: Video) => {
  if (el) {
    videoRefs.value.set(video.fullPath, el)
  } else {
    videoRefs.value.delete(video.fullPath)
  }
}

const setContainerRef = (el: any, video: Video) => {
  if (el) {
    el._videoData = video
    containerRefs.value.set(video.fullPath, el)
    if (observer.value) {
      observer.value.observe(el)
    }
  } else {
    containerRefs.value.delete(video.fullPath)
  }
}

const isVideoVisible = (index: number) => {
  return Math.abs(index - currentIndex.value) <= 1
}

onMounted(async () => {
  await fetchVideos()

  observer.value = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const container = entry.target as any
      const video = container.querySelector('video')
      if (entry.isIntersecting) {
        currentVisibleVideo.value = container._videoData
        isPaused.value = false
        if (video) {
          if (video.paused) {
            const playPromise = video.play()
            if (playPromise !== undefined) {
              playPromise.catch((e: any) => {
                // Ignore AbortError which is common when scrolling fast
                if (e.name === 'AbortError') return
                console.warn('Playback prevented:', e)
              })
            }
          }
        }
      } else {
        if (video) {
          video.pause()
        }
      }
    })
  }, {
    threshold: 0.3 // Much lower threshold for faster video switching on iOS
  })

  // Watch for container elements being added to DOM
  nextTick(() => {
    containerRefs.value.forEach(container => {
      if (container && observer.value) {
        observer.value.observe(container)
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
        v-if="currentVisibleVideo"
        @click="toggleFavourite(currentVisibleVideo)" 
        class="btn btn-circle btn-ghost bg-black/20 backdrop-blur-md text-white border-white/10"
        :class="{ 'text-orange-500': currentVisibleVideo.meta.isFavourite }"
      >
        <Icon :name="currentVisibleVideo.meta.isFavourite ? 'mdi:star' : 'mdi:star-outline'" class="w-6 h-6" />
      </button>
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
      @scroll.passive="handleScroll"
    >
      <div 
        v-for="(video, index) in videos" 
        :key="video.fullPath" 
        :ref="el => setContainerRef(el, video)"
        class="h-[100dvh] w-full snap-center relative flex items-center justify-center bg-black cursor-pointer"
        @click="togglePlayPause"
      >
        <template v-if="isVideoVisible(index)">
          <video
            :ref="el => setVideoRef(el, video)"
            class="h-full w-full object-contain"
            loop
            playsinline
            :muted="isMuted"
            :poster="getThumbnailUrl(video.fullPath)"
          >
            <source :src="getStreamUrl(video.fullPath)" :type="getSourceType(video.name)" />
          </video>
        </template>
        
        <!-- Placeholder for non-rendered videos -->
        <div v-else class="h-full w-full flex items-center justify-center bg-black">
          <span class="loading loading-spinner loading-md text-white/20"></span>
        </div>

        <!-- Pause Overlay -->
        <transition name="fade">
          <div v-if="isPaused && currentVisibleVideo?.fullPath === video.fullPath" class="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div class="bg-black/40 p-6 rounded-full backdrop-blur-sm">
              <Icon name="mdi:play" class="w-16 h-16 text-white opacity-80" />
            </div>
          </div>
        </transition>

        <!-- Video Info Overlay -->
        <div class="absolute bottom-0 left-0 right-0 p-8 pt-24 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none">
          <div class="max-w-md pointer-events-auto">
            <h2 class="text-white font-black text-xl tracking-tight mb-3 drop-shadow-lg">
              {{ video.name }}
            </h2>
            <div class="flex flex-wrap items-center gap-2">
              <span 
                v-for="tag in video.meta.tags.slice(0, 3)" 
                :key="tag.name"
                class="badge badge-md border-none text-white font-bold py-3.5 shadow-sm"
                :style="{ backgroundColor: tag.color }"
              >
                {{ tag.name }}
              </span>
              <span v-if="video.meta.tags.length > 3" class="text-[10px] text-white/60 font-bold self-center">
                +{{ video.meta.tags.length - 3 }}
              </span>
              <button
                class="btn btn-ghost btn-xs bg-white/10 hover:bg-white/20 border border-white/10 rounded-full px-3 text-white transition-all ml-1"
                @click="openTagModal"
              >
                <Icon name="mdi:tag-plus-outline" class="w-3.5 h-3.5 mr-1" /> 
                <span class="font-bold text-[10px] uppercase tracking-wide">Add Tag</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tag Modal (Overhauled - matches File Browser) -->
    <div v-if="showTagModal" class="modal modal-open backdrop-blur-md z-[60]">
      <div class="modal-box rounded-3xl shadow-2xl p-8 max-w-lg border border-white/10 bg-base-900 text-white">
        <div class="flex items-center gap-3 mb-8">
          <div class="bg-primary/20 p-3 rounded-2xl">
            <Icon name="mdi:tag-multiple" class="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 class="font-black text-xl tracking-tight">Manage Tags</h3>
            <p class="text-[11px] font-bold opacity-40 uppercase tracking-widest">Label your content for quick discovery</p>
          </div>
        </div>

        <div v-if="showNewTagForm" class="space-y-6">
          <div class="form-control">
            <label class="label mb-1">
              <span class="label-text font-black text-[10px] uppercase tracking-widest opacity-50 text-white">Tag Name</span>
            </label>
            <input
              v-model="newTagName"
              type="text"
              placeholder="Work, Personal, Invoices..."
              class="input input-bordered w-full bg-white/5 focus:bg-white/10 transition-all font-bold text-sm h-12 rounded-xl border-white/10 text-white"
            />
          </div>
          <div class="form-control">
            <label class="label mb-1">
              <span class="label-text font-black text-[10px] uppercase tracking-widest opacity-50 text-white">Color Identity</span>
            </label>
            <div class="flex gap-4 items-center">
              <input
                v-model="newTagColor"
                type="color"
                class="w-16 h-12 rounded-xl cursor-pointer border-none bg-white/5"
              />
              <div class="flex-grow h-12 rounded-xl flex items-center px-4 font-bold text-sm bg-white/5 border border-dashed border-white/20" :style="{ color: newTagColor }">
                 Preview Style
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-3 mt-10">
            <button class="btn btn-primary h-12 rounded-xl shadow-lg" @click="addTags">Create & Apply</button>
            <button class="btn btn-ghost h-12 rounded-xl" @click="showNewTagForm = false">Use Existing</button>
            <button class="btn btn-ghost h-12 rounded-xl text-error/60" @click="closeTagModal">Cancel</button>
          </div>
        </div>

        <div v-else class="space-y-6">
          <div class="form-control">
            <label class="label mb-3">
              <span class="label-text font-black text-[10px] uppercase tracking-widest opacity-50 text-white">Select Existing Tags</span>
            </label>
            <div class="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar no-scrollbar">
              <div
                v-for="tag in predefinedTags"
                :key="tag.name"
                class="p-4 rounded-xl cursor-pointer text-center font-bold text-xs transition-all border-2"
                :style="{ 
                  borderColor: tag.color,
                  backgroundColor: isTagSelected(tag) ? tag.color : 'transparent', 
                  color: isTagSelected(tag) ? 'white' : tag.color
                }"
                @click="toggleTagSelection(tag)"
              >
                {{ tag.name }}
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-3 mt-10">
            <button class="btn btn-primary h-12 rounded-xl shadow-lg" @click="addTags">Apply Selection</button>
            <button class="btn btn-ghost h-12 rounded-xl" @click="showNewTagForm = true">New Identity</button>
            <button class="btn btn-ghost h-12 rounded-xl text-error/60" @click="closeTagModal">Cancel</button>
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
  /* Hardware acceleration for smooth scrolling on iOS */
  -webkit-overflow-scrolling: touch;
  will-change: scroll-position;
}

video {
  /* Force GPU acceleration */
  transform: translateZ(0);
  will-change: transform;
}

video::-webkit-media-controls {
  display: none !important;
}

@media (max-width: 768px) {
  /* Backdrop filters are extremely expensive on mobile WebKit */
  .backdrop-blur-md,
  .backdrop-blur-sm,
  .backdrop-blur {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    background-color: rgba(0, 0, 0, 0.8) !important;
  }
}
</style>
