<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue'
import type { Video, Tag, ShortMedia, SlideshowMedia } from '~/types/File'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'

const mediaItems = ref<ShortMedia[]>([])
const currentVisibleMedia = ref<ShortMedia | null>(null)
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
const feedContainerRef = ref<HTMLElement | null>(null)
const currentIndex = ref(0)
const isAutoscrollEnabled = ref(false)

const handleScroll = (event: Event) => {
  const container = event.target as HTMLElement
  const index = Math.round(container.scrollTop / container.clientHeight)
  if (currentIndex.value !== index) {
    currentIndex.value = index
  }
}

const scrollToNextMedia = () => {
  if (!isAutoscrollEnabled.value || !feedContainerRef.value) return
  
  const nextIndex = currentIndex.value + 1
  if (nextIndex < mediaItems.value.length) {
    feedContainerRef.value.scrollTo({
      top: nextIndex * feedContainerRef.value.clientHeight,
      behavior: 'smooth'
    })
  }
}

const toggleAutoscroll = () => {
  isAutoscrollEnabled.value = !isAutoscrollEnabled.value
  createNotification(`Autoscroll ${isAutoscrollEnabled.value ? 'enabled' : 'disabled'}`, NotificationType.INFO)
}

const fetchShorts = async () => {
  try {
    isLoading.value = true
    containerRefs.value.clear()
    videoRefs.value.clear()
    // Fetch random media for the shorts feed
    const response = await fetch('/api/videos?shuffle=true&limit=200&page=1', { credentials: 'include' })
    if (!response.ok) throw new Error('Failed to fetch media')
    const data = await response.json()
    mediaItems.value = data.items || data
  } catch (err) {
    console.error('Error fetching media for shorts:', err)
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
  if (!currentVisibleMedia.value || currentVisibleMedia.value.type === 'slideshow') return
  const activeVideo = videoRefs.value.get(currentVisibleMedia.value.fullPath)
  if (!activeVideo) return

  if (activeVideo.paused) {
    activeVideo.play()
    isPaused.value = false
  } else {
    activeVideo.pause()
    isPaused.value = true
  }
}

const toggleFavourite = async (media: ShortMedia) => {
  const isFavourite = !media.meta.isFavourite
  try {
    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullPath: media.fullPath,
        isFavourite,
      }),
    })

    if (!response.ok) throw new Error('Failed to update favorite status')

    media.meta.isFavourite = isFavourite
    createNotification(`${media.type === 'video' ? 'Video' : 'Slideshow'} ${isFavourite ? 'added to' : 'removed from'} favorites`, NotificationType.INFO)
  } catch (err) {
    console.error(err)
    createNotification('Failed to update favorite status', NotificationType.ERROR)
  }
}

const openTagModal = async () => {
  if (!currentVisibleMedia.value) return
  selectedTags.value = currentVisibleMedia.value.meta.tags ? [...currentVisibleMedia.value.meta.tags] : []
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
  if (!currentVisibleMedia.value) return
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
    const currentTags = currentVisibleMedia.value.meta.tags || []
    let updatedTags = []

    if (!showNewTagForm.value) {
      // For single item, sync tags exactly (allows removal)
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
        fullPath: currentVisibleMedia.value.fullPath,
        tags: updatedTags,
      }),
    })

    if (!response.ok) throw new Error('Failed to add tags')

    currentVisibleMedia.value.meta.tags = updatedTags

    // Automatically add new tag to predefined tags
    if (showNewTagForm.value) {
      const newTag = tagsToAdd[0];
      const exists = predefinedTags.value.some(t => t.name.toLowerCase() === newTag.name.toLowerCase());
      if (!exists) {
        try {
          const updatedPredefinedTags = [...predefinedTags.value, newTag];
          await fetch('/api/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: updatedPredefinedTags }),
          });
          await fetchPredefinedTags();
        } catch (tagErr) {
          console.error('Failed to update predefined tags:', tagErr);
        }
      }
    }

    createNotification('Tags added successfully', NotificationType.SUCCESS)
    closeTagModal()
  } catch (err) {
    console.error('Error adding tags:', err)
    createNotification('Failed to add tags', NotificationType.ERROR)
  }
}

const setVideoRef = (el: any, media: Video) => {
  if (el) {
    videoRefs.value.set(media.fullPath, el)
  } else {
    videoRefs.value.delete(media.fullPath)
  }
}

const setContainerRef = (el: any, media: ShortMedia) => {
  if (el) {
    el._mediaData = media
    containerRefs.value.set(media.fullPath, el)
    if (observer.value) {
      observer.value.observe(el)
    }
  } else {
    containerRefs.value.delete(media.fullPath)
  }
}

const isMediaVisible = (index: number) => {
  return Math.abs(index - currentIndex.value) <= 1
}

onMounted(async () => {
  await fetchShorts()

  observer.value = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const container = entry.target as any
      const media = container._mediaData as ShortMedia
      const video = container.querySelector('video')
      
      if (entry.isIntersecting) {
        currentVisibleMedia.value = media
        isPaused.value = false
        if (video) {
          if (video.paused) {
            const playPromise = video.play()
            if (playPromise !== undefined) {
              playPromise.catch((e: any) => {
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
    threshold: 0.3
  })

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
        v-if="currentVisibleMedia"
        @click="toggleFavourite(currentVisibleMedia)" 
        class="btn btn-circle btn-ghost bg-black/20 backdrop-blur-md text-white border-white/10"
        :class="{ 'text-orange-500': currentVisibleMedia.meta.isFavourite }"
      >
        <Icon :name="currentVisibleMedia.meta.isFavourite ? 'mdi:star' : 'mdi:star-outline'" class="w-6 h-6" />
      </button>
      <button 
        @click="toggleAutoscroll" 
        class="btn btn-circle btn-ghost bg-black/20 backdrop-blur-md text-white border-white/10"
        :class="{ 'text-primary': isAutoscrollEnabled }"
        title="Toggle Autoscroll"
      >
        <Icon :name="isAutoscrollEnabled ? 'mdi:play-pause' : 'mdi:play-box-multiple-outline'" class="w-6 h-6" />
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
      <p class="font-bold uppercase tracking-[0.2em] text-[10px] opacity-50">Syncing Media Cluster...</p>
    </div>

    <!-- Media Feed -->
    <div 
      v-else-if="mediaItems.length" 
      ref="feedContainerRef"
      class="h-full w-full overflow-y-scroll overflow-x-hidden snap-y snap-mandatory no-scrollbar"
      @scroll.passive="handleScroll"
    >
      <div 
        v-for="(media, index) in mediaItems" 
        :key="media.fullPath" 
        :ref="el => setContainerRef(el, media)"
        class="h-[100dvh] w-full max-w-[100vw] snap-center relative flex items-center justify-center bg-black cursor-pointer overflow-hidden"
        @click="media.type === 'video' ? togglePlayPause() : null"
      >
        <template v-if="isMediaVisible(index)">
          <!-- Video Type -->
          <video
            v-if="media.type === 'video'"
            :ref="el => setVideoRef(el, media)"
            class="h-full w-full object-contain"
            :loop="!isAutoscrollEnabled"
            playsinline
            :muted="isMuted"
            :poster="getThumbnailUrl(media.fullPath)"
            @ended="scrollToNextMedia"
          >
            <source :src="getStreamUrl(media.fullPath)" :type="getSourceType(media.name)" />
          </video>

          <!-- Slideshow Type -->
          <SlideshowMedia
            v-else-if="media.type === 'slideshow'"
            :media="media"
            :isActive="currentVisibleMedia?.fullPath === media.fullPath"
            :isAutoscrollEnabled="isAutoscrollEnabled"
            @completed="scrollToNextMedia"
          />
        </template>
        
        <!-- Placeholder -->
        <div v-else class="h-full w-full flex items-center justify-center bg-black">
          <span class="loading loading-spinner loading-md text-white/10"></span>
        </div>

        <!-- Pause Overlay (Videos Only) -->
        <transition name="fade">
          <div v-if="media.type === 'video' && isPaused && currentVisibleMedia?.fullPath === media.fullPath" class="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <div class="bg-black/40 p-5 rounded-full backdrop-blur-md border border-white/10">
              <Icon name="mdi:play" class="w-12 h-12 text-white opacity-80" />
            </div>
          </div>
        </transition>

        <!-- Media Info Overlay -->
        <div class="absolute bottom-0 left-0 right-0 p-8 pt-24 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none z-20">
          <div class="max-w-md pointer-events-auto">
            <h2 class="text-white font-bold text-lg tracking-tight mb-4 drop-shadow-md">
              {{ media.name }}
            </h2>
            <div class="flex flex-wrap items-center gap-2">
              <span 
                v-for="tag in media.meta.tags.slice(0, 3)" 
                :key="tag.name"
                class="badge badge-sm border-none text-white font-bold py-2.5 px-3 rounded shadow-sm"
                :style="{ backgroundColor: tag.color }"
              >
                {{ tag.name }}
              </span>
              <span v-if="media.meta.tags.length > 3" class="text-[9px] text-white/50 font-bold self-center uppercase tracking-widest">
                +{{ media.meta.tags.length - 3 }} more
              </span>
              <button
                class="btn btn-ghost btn-xs bg-white/10 hover:bg-white/20 border border-white/10 rounded-md px-3 h-7 text-white transition-all ml-1 font-bold text-[9px] uppercase tracking-widest"
                @click="openTagModal"
              >
                <Icon name="mdi:tag-plus-outline" class="w-3.5 h-3.5 mr-1" /> 
                Tags
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tag Modal -->
    <div v-if="showTagModal" class="modal modal-open backdrop-blur-md z-[60]">
      <div class="modal-box rounded-xl shadow-xl p-8 max-w-sm border border-white/10 bg-[#0d1117] text-white">
        <div class="flex items-center gap-3 mb-8">
          <div class="bg-primary/10 p-2.5 rounded-lg border border-primary/10 text-primary">
            <Icon name="mdi:tag-multiple" class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-bold text-base tracking-tight text-white">Manage Tags</h3>
            <p class="text-[9px] font-bold text-white/40 uppercase tracking-widest">Add tags to your media</p>
          </div>
        </div>

        <div v-if="showNewTagForm" class="space-y-5">
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text font-bold text-[10px] uppercase tracking-widest text-white/40">Tag Name</span>
            </label>
            <input
              v-model="newTagName"
              type="text"
              placeholder="Work, Personal, Favorites..."
              class="input input-bordered w-full bg-white/5 focus:bg-white/10 transition-all font-bold text-xs h-11 rounded-lg border-white/10 text-white"
            />
          </div>
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text font-bold text-[10px] uppercase tracking-widest text-white/40">Tag Color</span>
            </label>
            <div class="flex gap-3 items-center">
              <input
                v-model="newTagColor"
                type="color"
                class="w-11 h-11 rounded-lg cursor-pointer border-none bg-white/5"
              />
              <div class="flex-grow h-11 rounded-lg flex items-center px-4 font-bold text-[11px] bg-white/5 border border-dashed border-white/10 uppercase tracking-widest" :style="{ color: newTagColor }">
                 Color Preview
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2 mt-10">
            <button class="btn btn-primary btn-sm h-10 rounded-lg shadow-sm font-bold uppercase tracking-widest text-[10px]" @click="addTags">Create & Apply</button>
            <button class="btn btn-ghost btn-sm h-10 rounded-lg font-bold uppercase tracking-widest text-[10px] text-white/70" @click="showNewTagForm = false">Existing Tags</button>
            <button class="btn btn-ghost btn-sm h-10 rounded-lg font-bold uppercase tracking-widest text-[10px] text-error/60" @click="closeTagModal">Cancel</button>
          </div>
        </div>

        <div v-else class="space-y-5">
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text font-bold text-[10px] uppercase tracking-widest text-white/40">Select Existing Tags</span>
            </label>
            <div class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar no-scrollbar">
              <div
                v-for="tag in predefinedTags"
                :key="tag.name"
                class="p-3 rounded-lg cursor-pointer text-center font-bold text-[9px] uppercase tracking-wider transition-all border border-white/10"
                :style="{ 
                  borderColor: isTagSelected(tag) ? tag.color : '',
                  backgroundColor: isTagSelected(tag) ? tag.color : 'transparent', 
                  color: isTagSelected(tag) ? 'white' : tag.color
                }"
                @click="toggleTagSelection(tag)"
              >
                {{ tag.name }}
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2 mt-10">
            <button class="btn btn-primary btn-sm h-10 rounded-lg shadow-sm font-bold uppercase tracking-widest text-[10px]" @click="addTags">Apply Selection</button>
            <button class="btn btn-ghost btn-sm h-10 rounded-lg font-bold uppercase tracking-widest text-[10px] text-white/70" @click="showNewTagForm = true">New Tag</button>
            <button class="btn btn-ghost btn-sm h-10 rounded-lg font-bold uppercase tracking-widest text-[10px] text-error/60" @click="closeTagModal">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="h-full w-full flex flex-col items-center justify-center text-white p-8 text-center gap-6">
      <div class="bg-white/5 p-8 rounded-xl border border-white/10">
        <Icon name="mdi:video-off-outline" class="w-16 h-16 opacity-20" />
      </div>
      <div>
        <h3 class="text-lg font-bold uppercase tracking-widest mb-1">No videos found</h3>
        <p class="text-white/40 text-[10px] font-bold uppercase tracking-widest max-w-xs">Upload some videos to your cloud to begin playback.</p>
      </div>
      <NuxtLink to="/files" class="btn btn-primary btn-sm rounded-lg px-8 shadow-sm font-bold uppercase tracking-widest text-[10px]">Go to Files</NuxtLink>
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
