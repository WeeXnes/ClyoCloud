<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import type { Video, FileMeta, Tag } from '~/types/File'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'
import { copyToClipboard } from '~/core/clipboard'

const route = useRoute()
const videos = ref<Video[]>([])
const currentVideo = ref<Video | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const showTagModal = ref(false)
const showShareModal = ref(false)
const selectedTags = ref<Tag[]>([])
const predefinedTags = ref<Tag[]>([])
const showNewTagForm = ref(true)
const newTagName = ref('')
const newTagColor = ref('#4B5EAA')
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

const isEditingDescription = ref(false)
const editableDescription = ref('')

const startEditDescription = () => {
  editableDescription.value = currentVideo.value?.meta.description || ''
  isEditingDescription.value = true
}

const saveDescription = async () => {
  if (!currentVideo.value) return

  try {
    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullPath: currentVideo.value.fullPath,
        description: editableDescription.value,
      }),
    })

    if (!response.ok) throw new Error('Failed to update description')

    currentVideo.value.meta.description = editableDescription.value
    isEditingDescription.value = false
    createNotification('Description updated', NotificationType.SUCCESS)
  } catch (err) {
    console.error(err)
    createNotification('Failed to update description', NotificationType.ERROR)
  }
}

const copyPublicLinkForVideo = async () => {
  const video = currentVideo.value
  if (!video) return

  const user = useState<any>('user')
  const username = user.value?.name
  if (!username) return

  const url = useRequestURL()
  const publicUrl = `${url.origin}/p/${username}/${encodeURIComponent(video.fullPath)}`
  
  const success = await copyToClipboard(publicUrl)
  if (success) {
    createNotification('Public link copied to clipboard!', NotificationType.SUCCESS)
  } else {
    createNotification('Failed to copy link', NotificationType.ERROR)
  }
}

const downloadVideo = () => {
  if (!currentVideo.value) return
  const url = getStreamUrl()
  const a = document.createElement('a')
  a.href = url
  a.download = currentVideo.value.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

const togglePublicAccess = async (event: Event) => {
  if (!currentVideo.value) return
  const isPublic = (event.target as HTMLInputElement).checked
  
  try {
    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        fullPath: currentVideo.value.fullPath, 
        isPublic 
      }),
    })
    
    if (!response.ok) throw new Error('Failed to update visibility')
    
    currentVideo.value.meta.isPublic = isPublic
    createNotification(`Public access ${isPublic ? 'enabled' : 'disabled'}`, NotificationType.INFO)
    
  } catch (err) {
    console.error(err)
    createNotification('Failed to update public access', NotificationType.ERROR)
    // Reset toggle state
    ;(event.target as HTMLInputElement).checked = !isPublic
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

const getStreamUrl = () => {
  const url = useRequestURL()
  const baseUrl = url.origin
  const subpath = Array.isArray(route.params.path) ? route.params.path.join('/') : route.params.path || ''
  return `${baseUrl}/stream/${encodeURIComponent(subpath)}`
}

const getSourceType = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mov') return 'video/quicktime'
  if (ext === 'mkv') return 'video/x-matroska'
  return 'video/mp4'
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

async function fetchPredefinedTags() {
  try {
    const response = await fetch('/api/tags', {
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch tags: ${response.statusText}`)
    }
    predefinedTags.value = await response.json()
  } catch (err) {
    console.error('Error fetching tags:', err)
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

const getVideoUrl = (fullPath: string) => {
  const segments = fullPath.split('/')
  const encodedPath = segments.map(segment => encodeURIComponent(segment)).join('/')
  return `/media/${encodedPath}`
}

const goToVideo = (fullPath: string) => {
  navigateTo(getVideoUrl(fullPath))
}

const openTagModal = () => {
  selectedTags.value = currentVideo.value?.meta.tags ? [...currentVideo.value.meta.tags] : []
  showNewTagForm.value = false
  newTagName.value = ''
  newTagColor.value = '#4B5EAA'
  showTagModal.value = true
}

const closeTagModal = () => {
  showTagModal.value = false
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

const removeTag = async (tagToRemove: Tag) => {
  if (!currentVideo.value) return

  try {
    const updatedTags = currentVideo.value.meta.tags.filter(t => t.name !== tagToRemove.name)

    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullPath: currentVideo.value.fullPath,
        tags: updatedTags,
      }),
    })

    if (!response.ok) throw new Error('Failed to remove tag')

    currentVideo.value.meta.tags = updatedTags
    createNotification('Tag removed', NotificationType.SUCCESS)
    await fetchVideos()
  } catch (err) {
    console.error(err)
    createNotification('Failed to remove tag', NotificationType.ERROR)
  }
}

const addTag = async () => {
  let tagsToAdd: Tag[] = []
  if (showNewTagForm.value) {
    if (!newTagName.value.trim()) {
      createNotification('Tag name is required', NotificationType.WARNING)
      return;
    }
    tagsToAdd.push({ name: newTagName.value, color: newTagColor.value })
  } else {
    tagsToAdd = selectedTags.value
  }

  if (tagsToAdd.length === 0) {
    createNotification('Please select or create at least one tag', NotificationType.WARNING)
    return;
  }

  if (!currentVideo.value) {
    createNotification('No video selected', NotificationType.ERROR)
    return;
  }

  try {
    const currentTags = currentVideo.value.meta.tags || []
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

    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        fullPath: currentVideo.value.fullPath,
        tags: updatedTags,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to add tags`);
    }

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
    await fetchVideos(); // Refresh video list
    closeTagModal();
  } catch (err) {
    console.error('Error adding tags:', err);
    createNotification('Failed to add tags', NotificationType.ERROR)
  }
};

const recommendedVideos = computed(() => {
  if (!currentVideo.value) {
    return [];
  }

  const currentTags = new Set(currentVideo.value.meta.tags.map(tag => tag.name.toLowerCase()));

  const videosWithTagCount = videos.value
      .filter(v => v.fullPath !== currentVideo.value?.fullPath)
      .map(video => {
        const sharedTagCount = video.meta.tags.filter(tag =>
            currentTags.has(tag.name.toLowerCase())
        ).length;
        return { video, sharedTagCount };
      });

  return videosWithTagCount
      .sort((a, b) => b.sharedTagCount - a.sharedTagCount)
      .map(item => item.video);
});

const visibleVideosCount = ref(20);

const visibleRecommendedVideos = computed(() => {
  return recommendedVideos.value.slice(0, visibleVideosCount.value);
});

watch(visibleRecommendedVideos, () => {
  if (isMobile.value) {
    setupObserver()
  }
}, { deep: true })

const loadMore = () => {
  visibleVideosCount.value += 20;
};

onMounted(async () => {
  await fetchVideos();
  await fetchPredefinedTags();
  await fetchUserSettings()
  checkMobile()
  if (isMobile.value && mobileAutoPreview.value) setupObserver()
  window.addEventListener('resize', checkMobile)
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  if (observer) observer.disconnect()
})

// Watch for route changes to refresh the video
watch(() => route.params.path, () => {
  const subpath = Array.isArray(route.params.path) ? route.params.path.map(decodeURIComponent).join('/') : decodeURIComponent(route.params.path || '')
  currentVideo.value = videos.value.find(video => video.fullPath === subpath) || null
  // Scroll to top when video changes
  window.scrollTo({ top: 0, behavior: 'smooth' })
})
</script>

<template>
  <div class="min-h-screen bg-base-200/50 flex flex-col font-sans text-base-content">
    <header class="sticky top-0 z-[40] w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/10">
      <div class="w-full px-4 py-3 md:py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-xs md:btn-sm lg:hidden">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            
            <NuxtLink to="/media" class="btn btn-ghost btn-circle btn-xs md:btn-sm border border-base-content/10 bg-base-100/50 hover:bg-base-100">
              <Icon name="mdi:arrow-left" class="w-4 h-4 md:w-5 h-5" />
            </NuxtLink>
            
            <div class="flex flex-col gap-0.5 md:gap-1 min-w-0">
              <h1 class="text-base md:text-lg font-bold tracking-tight flex items-center gap-2 text-base-content">
                <Icon name="mdi:play-box-multiple-outline" class="text-primary w-5 h-5" />
                Media Player
              </h1>
              <p class="text-[9px] md:text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1 truncate max-w-[150px] sm:max-w-md">
                {{ currentVideo?.name || 'Processing Stream...' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-[1800px] mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-1 w-full">
      <!-- Main Content Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <!-- Player Column -->
        <div class="lg:col-span-8 xl:col-span-9 space-y-8">
          <!-- Loading State -->
          <div v-if="isLoading" class="aspect-video bg-base-300 animate-pulse rounded-xl border border-base-content/10 shadow-sm"></div>

          <!-- Error State -->
          <div v-else-if="error" class="alert alert-error py-4 rounded-lg text-xs font-bold text-white shadow-sm border-none">
            <Icon name="mdi:alert-circle" class="w-6 h-6" />
            <span>{{ error }}</span>
          </div>

          <!-- Video Content -->
          <div v-else-if="currentVideo" class="animate-in fade-in duration-300">
            <!-- Player Wrapper -->
            <div class="relative group aspect-video bg-black rounded-xl overflow-hidden shadow-lg border border-white/5">
              <video
                id="previewVideo"
                controls
                autoplay
                class="w-full h-full"
                :key="currentVideo.fullPath"
              >
                <source :src="getStreamUrl()" :type="getSourceType(currentVideo.name)" />
                Your browser does not support video.
              </video>
            </div>

            <!-- Header Info -->
            <div class="mt-8 space-y-6">
              <div>
                <h1 class="text-2xl font-bold tracking-tight text-base-content leading-tight mb-2">
                  {{ currentVideo.name }}
                </h1>
                <div class="flex items-center gap-3 text-[10px] font-bold text-base-content/30 uppercase tracking-[0.2em]">
                   <span>Encrypted Stream</span>
                   <div class="w-1 h-1 rounded-full bg-current"></div>
                   <span>Direct Access</span>
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-6 py-5 border-y border-base-content/10">
                <div class="flex items-center gap-8">
                  <div class="flex flex-col gap-1">
                    <span class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">File Size</span>
                    <span class="text-sm font-bold text-base-content">{{ formatFileSize(currentVideo.size) }}</span>
                  </div>
                  <div class="flex flex-col gap-1">
                    <span class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">Date Added</span>
                    <span class="text-sm font-bold text-base-content">{{ formatDate(currentVideo.lastModified) }}</span>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                   <button 
                     class="btn btn-sm btn-ghost gap-2 rounded-lg border border-base-content/10 bg-base-100/50 font-bold text-[10px] uppercase tracking-widest"
                     :class="{ 'text-orange-500 bg-orange-500/10 border-orange-500/20 shadow-sm': currentVideo.meta.isFavourite }"
                     @click="toggleFavourite(currentVideo)"
                   >
                     <Icon :name="currentVideo.meta.isFavourite ? 'mdi:star' : 'mdi:star-outline'" class="w-4 h-4" />
                     {{ currentVideo.meta.isFavourite ? 'Favourited' : 'Favourite' }}
                   </button>
                   <button class="btn btn-sm btn-ghost gap-2 rounded-lg border border-base-content/10 bg-base-100/50 font-bold text-[10px] uppercase tracking-widest" @click="downloadVideo">
                     <Icon name="mdi:download" class="w-4 h-4 text-success" />
                     Download
                   </button>
                   <button class="btn btn-sm btn-primary gap-2 rounded-lg px-6 shadow-sm font-bold text-[10px] uppercase tracking-widest" @click="showShareModal = true">
                     <Icon name="mdi:share-variant" class="w-4 h-4" />
                     Share
                   </button>
                </div>
              </div>

              <!-- Tags -->
              <div class="flex flex-wrap items-center gap-2">
                <div v-if="currentVideo.meta.tags?.length" class="flex flex-wrap gap-2">
                  <NuxtLink
                    v-for="tag in currentVideo.meta.tags"
                    :key="tag.name"
                    :to="`/collections/${encodeURIComponent(tag.name)}`"
                    class="badge badge-sm border-none text-white font-bold py-2.5 px-3 rounded-md shadow-sm group/tag hover:scale-105 transition-transform cursor-pointer"
                    :style="{ backgroundColor: tag.color }"
                  >
                    {{ tag.name }}
                    <Icon name="mdi:close" 
                          class="w-3 h-3 ml-1.5 cursor-pointer opacity-50 hover:opacity-100" 
                          @click.stop.prevent="removeTag(tag)" />
                  </NuxtLink>
                </div>
                <button
                  class="btn btn-ghost btn-xs bg-base-100/50 hover:bg-base-100 border border-base-content/10 rounded-md px-3 h-7 transition-all font-bold text-[9px] uppercase tracking-widest"
                  @click="openTagModal"
                >
                  <Icon name="mdi:tag-plus-outline" class="w-3.5 h-3.5 mr-1 text-primary" /> 
                  Add Tag
                </button>
              </div>

              <!-- Description Section -->
              <section class="bg-base-100 rounded-xl p-6 sm:p-8 shadow-sm border border-base-content/10">
                <div class="flex items-center justify-between mb-6">
                  <div class="flex items-center gap-2">
                    <Icon name="mdi:text-subject" class="w-4 h-4 text-base-content/30" />
                    <h3 class="text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/40">Description</h3>
                  </div>
                  <button 
                    v-if="!isEditingDescription"
                    class="btn btn-ghost btn-xs rounded-md h-7 px-3 border border-base-content/5 font-bold text-[9px] uppercase tracking-widest"
                    @click="startEditDescription"
                  >
                    Edit Description
                  </button>
                </div>

                <div v-if="isEditingDescription" class="space-y-4">
                  <textarea
                    v-model="editableDescription"
                    class="textarea textarea-bordered w-full h-32 bg-base-200/50 focus:bg-base-100 transition-all font-bold text-xs rounded-lg"
                    placeholder="Add a description for this video..."
                  ></textarea>
                  <div class="flex justify-end gap-2">
                    <button class="btn btn-ghost btn-xs h-8 px-4 rounded-md font-bold text-[10px] uppercase tracking-widest" @click="isEditingDescription = false">Cancel</button>
                    <button class="btn btn-primary btn-xs h-8 px-6 rounded-md shadow-sm font-bold text-[10px] uppercase tracking-widest" @click="saveDescription">Save Description</button>
                  </div>
                </div>
                
                <div v-else>
                  <div v-if="currentVideo.meta.description" class="bg-base-200/30 p-5 rounded-lg border border-base-content/5 text-xs font-bold leading-relaxed text-base-content/70 whitespace-pre-line">
                    {{ currentVideo.meta.description }}
                  </div>
                  <div v-else class="flex flex-col items-center py-6 text-center">
                    <p class="text-[10px] font-bold text-base-content/30 uppercase tracking-[0.2em] mb-4">No description yet</p>
                    <button class="btn btn-ghost btn-sm border border-dashed border-base-content/20 rounded-lg font-bold text-[9px] uppercase tracking-widest px-8" @click="startEditDescription">
                      Add Description
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <!-- Video Not Found -->
          <div v-else class="flex flex-col items-center justify-center py-24 text-center">
             <div class="bg-base-200/50 p-8 rounded-xl mb-6 border border-base-content/5">
               <Icon name="mdi:movie-off-outline" class="w-16 h-16 text-base-content/10" />
             </div>
             <h2 class="text-xl font-bold text-base-content uppercase tracking-widest">Video not found</h2>
             <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest max-w-sm mt-2 leading-relaxed">The requested video could not be found in your library.</p>
             <NuxtLink to="/media" class="btn btn-primary btn-sm mt-8 px-8 rounded-lg shadow-sm font-bold uppercase tracking-widest text-[10px]">Return to Library</NuxtLink>
          </div>
        </div>

        <!-- Recommendations Column -->
        <div class="lg:col-span-4 xl:col-span-3">
          <div class="sticky top-24 space-y-6">
            <h2 class="text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/40 pl-1 flex items-center gap-2">
              <Icon name="mdi:sparkles" class="w-4 h-4 text-primary/60" />
              Related Media
            </h2>

            <div v-if="isLoading" class="space-y-4">
              <div v-for="i in 5" :key="i" class="flex gap-4">
                 <div class="w-28 aspect-video bg-base-300 animate-pulse rounded-lg flex-shrink-0"></div>
                 <div class="flex-grow space-y-2">
                   <div class="h-3 w-full bg-base-300 animate-pulse rounded"></div>
                   <div class="h-2 w-1/2 bg-base-300 animate-pulse rounded"></div>
                 </div>
              </div>
            </div>

            <div v-else-if="visibleRecommendedVideos.length" class="space-y-1">
              <a
                v-for="video in visibleRecommendedVideos"
                :key="video.fullPath"
                class="group flex gap-4 hover:bg-base-100 p-2.5 rounded-lg transition-all video-thumbnail-container border border-transparent hover:border-base-content/10"
                :href="getVideoUrl(video.fullPath)"
                :data-video-path="video.fullPath"
                @click.prevent="goToVideo(video.fullPath)"
                @mouseenter="hoveredVideo = video.fullPath"
                @mouseleave="hoveredVideo = null"
                @touchstart.passive="handleTouchStart(video.fullPath)"
                @touchend="handleTouchEnd"
                @touchmove="handleTouchEnd"
              >
                <!-- Compact Thumbnail -->
                <div class="relative w-28 aspect-video overflow-hidden rounded-md bg-base-300 shadow-sm shrink-0 border border-base-content/5">
                  <img
                    v-if="hasThumbnail(video.name)"
                    :src="getThumbnailUrl(video.fullPath)"
                    alt=""
                    class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div v-else class="flex h-full w-full items-center justify-center">
                    <Icon name="mdi:play" class="w-5 h-5 text-base-content/10" />
                  </div>

                  <!-- Video Preview Overlay -->
                  <div v-if="hoveredVideo === video.fullPath || (isMobile && visibleVideos.has(video.fullPath))" 
                       class="absolute inset-0 z-10 animate-in fade-in duration-200">
                    <img :src="getPreviewUrl(video.fullPath)" 
                         class="w-full h-full object-cover opacity-0 transition-opacity duration-300" 
                         @load="$event.target.classList.remove('opacity-0')"
                         alt="Preview" />
                  </div>
                </div>

                <!-- Small Metadata -->
                <div class="flex flex-col min-w-0 justify-center">
                  <h4 class="text-[11px] font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1 text-base-content">
                    {{ video.name }}
                  </h4>
                  <div class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest">
                    {{ formatDate(video.lastModified).split(',')[0] }}
                  </div>
                </div>
              </a>

              <div class="pt-4">
                <button 
                  v-if="visibleVideosCount < recommendedVideos.length"
                  class="btn btn-ghost btn-xs w-full font-bold uppercase tracking-widest text-[9px] h-9 rounded-lg border border-base-content/5 bg-base-100/50"
                  @click="loadMore"
                >
                  Show More
                </button>
              </div>
            </div>

            <div v-else class="bg-base-100 p-8 rounded-xl text-center shadow-sm border border-base-content/10">
              <Icon name="mdi:video-off-outline" class="w-10 h-10 text-base-content/10 mx-auto mb-3" />
              <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest">No matching videos</p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Share Modal -->
    <div v-if="showShareModal" class="modal modal-open backdrop-blur-md">
      <div class="modal-box rounded-xl shadow-xl p-8 max-w-sm border border-base-content/10">
        <div class="flex items-center gap-3 mb-8">
          <div class="bg-primary/10 p-2.5 rounded-lg border border-primary/10 text-primary">
            <Icon name="mdi:share-variant" class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-bold text-base tracking-tight text-base-content">Share Video</h3>
            <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">Manage public sharing access</p>
          </div>
        </div>

        <div v-if="currentVideo" class="space-y-6">
          <div class="flex items-center justify-between p-4 bg-base-200/50 rounded-lg border border-base-content/5">
            <div>
              <span class="text-xs font-bold tracking-tight text-base-content uppercase">Public Link</span>
              <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">Enable public sharing</p>
            </div>
            <input 
              type="checkbox" 
              class="toggle toggle-success toggle-xs rounded-sm" 
              :checked="currentVideo.meta.isPublic" 
              @change="togglePublicAccess" 
            />
          </div>

          <transition name="fade">
            <div v-if="currentVideo.meta.isPublic" class="space-y-3">
              <div class="bg-success/5 p-4 rounded-lg flex flex-col gap-3 border border-success/10">
                <p class="text-[10px] font-bold text-success uppercase tracking-widest leading-relaxed">Sharing active. Anyone with the link can view.</p>
                <button class="btn btn-sm btn-success text-white w-full rounded-md shadow-sm font-bold uppercase tracking-widest text-[10px] h-9" @click="copyPublicLinkForVideo">
                  <Icon name="mdi:content-copy" class="w-3.5 h-3.5 mr-2" />
                  Copy Public Link
                </button>
              </div>
            </div>
          </transition>

          <div class="pt-4">
            <button class="btn btn-ghost btn-sm w-full h-9 rounded-md font-bold uppercase tracking-widest text-[10px]" @click="showShareModal = false">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tag Modal -->
    <div v-if="showTagModal" class="modal modal-open backdrop-blur-md">
      <div class="modal-box rounded-xl shadow-xl p-8 max-w-sm border border-base-content/10">
        <div class="flex items-center gap-3 mb-8">
          <div class="bg-primary/10 p-2.5 rounded-lg border border-primary/10 text-primary">
            <Icon name="mdi:tag-multiple" class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-bold text-base tracking-tight text-base-content">Manage Tags</h3>
            <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">Add tags to your media</p>
          </div>
        </div>

        <div v-if="showNewTagForm" class="space-y-5">
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">Tag Name</span>
            </label>
            <input
              v-model="newTagName"
              type="text"
              placeholder="Work, Personal, Favorites..."
              class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-xs h-11 rounded-lg border-base-content/10"
            />
          </div>
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">Tag Color</span>
            </label>
            <div class="flex gap-3 items-center">
              <input
                v-model="newTagColor"
                type="color"
                class="w-11 h-11 rounded-lg cursor-pointer border-none bg-base-200/50"
              />
              <div class="flex-grow h-11 rounded-lg flex items-center px-4 font-bold text-[11px] bg-base-200/50 border border-dashed border-base-content/10 uppercase tracking-widest" :style="{ color: newTagColor }">
                 Color Preview
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2 mt-10">
            <button class="btn btn-primary btn-sm h-10 rounded-lg shadow-sm font-bold uppercase tracking-widest text-[10px]" @click="addTag">Create & Apply</button>
            <button class="btn btn-ghost btn-sm h-10 rounded-lg font-bold uppercase tracking-widest text-[10px]" @click="showNewTagForm = false">Existing Tags</button>
            <button class="btn btn-ghost btn-sm h-10 rounded-lg font-bold uppercase tracking-widest text-[10px] text-error/60" @click="closeTagModal">Cancel</button>
          </div>
        </div>

        <div v-else class="space-y-5">
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">Select Existing Tags</span>
            </label>
            <div class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              <div
                v-for="tag in predefinedTags"
                :key="tag.name"
                class="p-3 rounded-lg cursor-pointer text-center font-bold text-[9px] uppercase tracking-wider transition-all border border-base-content/10"
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
            <button class="btn btn-primary btn-sm h-10 rounded-lg shadow-sm font-bold uppercase tracking-widest text-[10px]" @click="addTag">Apply Selection</button>
            <button class="btn btn-ghost btn-sm h-10 rounded-lg font-bold uppercase tracking-widest text-[10px]" @click="showNewTagForm = true">New Tag</button>
            <button class="btn btn-ghost btn-sm h-10 rounded-lg font-bold uppercase tracking-widest text-[10px] text-error/60" @click="closeTagModal">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

video::shadow(video-controls) {
  display: none !important;
}

/* Ensure proper focus ring on thumbnails */
.group\/thumb:focus-within {
  outline: 2px solid hsl(var(--p));
  outline-offset: 2px;
}
</style>
