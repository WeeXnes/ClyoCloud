<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import type { Video, FileMeta, Tag } from '~/types/File'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'
import { copyToClipboard } from '~/core/clipboard'

const route = useRoute()
const videos = ref<Video[]>([])
const currentVideo = ref<Video | null>(null)

useHead({
  title: computed(() => currentVideo.value ? `Media - ${currentVideo.value.name}` : 'Media Player')
})
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

const excludedMediaPaths = ref<string[]>([])

const fetchUserSettings = async () => {
  try {
    const response = await fetch('/api/user-settings', { credentials: 'include' })
    if (response.ok) {
      const data = await response.json()
      mobileAutoPreview.value = data.mobileAutoPreview ?? true
      excludedMediaPaths.value = data.excludedMediaPaths || []
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

const excludeParentFolder = async () => {
  if (!currentVideo.value) return

  const pathParts = currentVideo.value.fullPath.split('/')
  pathParts.pop() // Remove filename
  const folderPath = pathParts.join('/')

  if (!confirm(`Exclude all files in folder "${folderPath || 'Root'}" from the Media tab?`)) return

  try {
    const settingsResponse = await fetch('/api/user-settings')
    if (!settingsResponse.ok) throw new Error('Failed to fetch settings')
    const settings = await settingsResponse.json()

    const currentExcluded = settings.excludedMediaPaths || []
    if (!currentExcluded.includes(folderPath)) {
      currentExcluded.push(folderPath)
    }

    const response = await fetch('/api/user-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, excludedMediaPaths: currentExcluded }),
    })

    if (!response.ok) throw new Error('Failed to update settings')

    createNotification(`Folder excluded: ${folderPath || 'Root'}`, NotificationType.SUCCESS)
    navigateTo('/media')
  } catch (err) {
    console.error(err)
    createNotification('Failed to exclude folder', NotificationType.ERROR)
  }
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
  if (size === undefined || size === null || isNaN(size)) return '0 B'
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
  <div class="min-h-screen bg-base-100 flex flex-col font-sans text-fg">
    <header class="page-bar">
      <div class="w-full px-4 sm:px-6 py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden" aria-label="Open navigation">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            
            <NuxtLink to="/media" class="btn btn-ghost btn-circle btn-sm shrink-0" aria-label="Back to media">
              <Icon name="mdi:arrow-left" class="w-5 h-5" />
            </NuxtLink>
            
            <div class="flex items-center gap-2 min-w-0">
              <div class="min-w-0">
                <h1 class="text-[15px] font-medium tracking-section text-fg leading-tight">Media Player</h1>
                <p class="hidden sm:block text-[13px] text-fg-3 leading-tight truncate max-w-[150px] sm:max-w-md">
                  {{ currentVideo?.name || 'Processing Stream...' }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-[1440px] mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
      <!-- Main Content Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        <!-- Player Column -->
        <div class="lg:col-span-8 xl:col-span-9 space-y-8">
          <!-- Loading State -->
          <div v-if="isLoading" class="aspect-video bg-base-200 animate-pulse rounded-xl border border-line"></div>

          <!-- Error State -->
          <div v-else-if="error" class="alert alert-error py-3 text-[13px]">
            <Icon name="mdi:alert-circle" class="w-6 h-6" />
            <span>{{ error }}</span>
          </div>

          <!-- Video Content -->
          <div v-else-if="currentVideo">
            <!-- Player Wrapper -->
            <div class="relative group aspect-video bg-black rounded-xl overflow-hidden border border-line">
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
                <h2 class="text-[1.75rem] font-medium tracking-title text-fg leading-tight mb-2 break-words">
                  {{ currentVideo.name }}
                </h2>
                <div class="flex items-center gap-3 num text-[13px] text-fg-3">
                   <span>Encrypted Stream</span>
                   <span aria-hidden="true">·</span>
                   <span>Direct Access</span>
                </div>
              </div>

              <div class="flex flex-wrap items-center justify-between gap-6 py-5 border-y border-line">
                <div class="flex items-center gap-8">
                  <div class="flex flex-col gap-1">
                    <span class="micro">Size</span>
                    <span class="num text-[15px] text-fg">{{ formatFileSize(currentVideo.size) }}</span>
                  </div>
                  <div class="flex flex-col gap-1">
                    <span class="micro">Added</span>
                    <span class="num text-[15px] text-fg">{{ formatDate(currentVideo.lastModified) }}</span>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2">
                   <button 
                     class="btn btn-sm gap-2"
                     :class="{ '!bg-surface-2': currentVideo.meta.isFavourite }"
                     :aria-pressed="currentVideo.meta.isFavourite"
                     @click="toggleFavourite(currentVideo)"
                   >
                     <Icon :name="currentVideo.meta.isFavourite ? 'mdi:star' : 'mdi:star-outline'" class="w-4 h-4" />
                     {{ currentVideo.meta.isFavourite ? 'Favourited' : 'Favourite' }}
                   </button>
                   <button class="btn btn-sm gap-2" @click="downloadVideo">
                     <Icon name="mdi:download" class="w-4 h-4" />
                     Download
                   </button>
                   <button class="btn btn-sm btn-error gap-2" @click="excludeParentFolder">
                     <Icon name="mdi:eye-off-outline" class="w-4 h-4" />
                     Exclude Folder
                   </button>
                   <button class="btn btn-sm btn-primary gap-2" @click="showShareModal = true">
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
                    :to="`/collections/${encodeURIComponent(tag.name)}`" class="tag-chip group/tag cursor-pointer">
                      <span class="dot" :style="{ backgroundColor: tag.color }"></span>
                    {{ tag.name }}
                    <Icon name="mdi:close" 
                          class="w-3 h-3 ml-1.5 cursor-pointer opacity-50 hover:opacity-100" 
                          @click.stop.prevent="removeTag(tag)" />
                  </NuxtLink>
                </div>
                <button
                  class="btn btn-xs"
                  @click="openTagModal"
                >
                  <Icon name="mdi:tag-plus-outline" class="w-3.5 h-3.5 mr-1" /> 
                  Add Tag
                </button>
              </div>

              <!-- Description Section -->
              <section class="border-t border-line pt-8">
                <div class="flex items-center justify-between mb-6">
                  <div class="flex items-center gap-2">
                    <h3 class="section-title">Description</h3>
                  </div>
                  <button 
                    v-if="!isEditingDescription"
                    class="btn btn-xs"
                    @click="startEditDescription"
                  >
                    Edit Description
                  </button>
                </div>

                <div v-if="isEditingDescription" class="space-y-4">
                  <textarea
                    v-model="editableDescription"
                    class="textarea w-full h-32"
                    placeholder="Add a description for this video..."
                  ></textarea>
                  <div class="flex justify-end gap-2">
                    <button class="btn btn-ghost btn-sm" @click="isEditingDescription = false">Cancel</button>
                    <button class="btn btn-sm" @click="saveDescription">Save</button>
                  </div>
                </div>
                
                <div v-else>
                  <div v-if="currentVideo.meta.description" class="text-[15px] leading-relaxed text-fg-2 whitespace-pre-line">
                    {{ currentVideo.meta.description }}
                  </div>
                  <div v-else>
                    <p class="text-[14px] text-fg-3 mb-4">No description yet.</p>
                    <button class="btn btn-sm" @click="startEditDescription">
                      Add Description
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <!-- Video Not Found -->
          <div v-else class="flex flex-col items-center justify-center py-24 text-center">
             <h2 class="text-[15px] text-fg">Video not found</h2>
             <p class="text-[14px] text-fg-3 mt-1 max-w-sm mx-auto">The requested video could not be found in your library.</p>
             <NuxtLink to="/media" class="btn btn-sm mt-6">Return to Library</NuxtLink>
          </div>
        </div>

        <!-- Recommendations Column -->
        <div class="lg:col-span-4 xl:col-span-3">
          <div class="sticky top-24 space-y-6">
            <h2 class="section-title">
              Related Media
            </h2>

            <div v-if="isLoading" class="space-y-4">
              <div v-for="i in 5" :key="i" class="flex gap-4">
                 <div class="w-28 aspect-video bg-base-200 animate-pulse rounded-lg flex-shrink-0"></div>
                 <div class="flex-grow space-y-2">
                   <div class="h-3 w-full bg-base-200 animate-pulse rounded"></div>
                   <div class="h-2 w-1/2 bg-base-200 animate-pulse rounded"></div>
                 </div>
              </div>
            </div>

            <div v-else-if="visibleRecommendedVideos.length" class="space-y-1">
              <a
                v-for="video in visibleRecommendedVideos"
                :key="video.fullPath"
                class="group flex gap-4 hover:bg-surface-2 p-2 -mx-2 rounded-lg transition-colors video-thumbnail-container"
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
                <div class="relative w-28 aspect-video overflow-hidden rounded-md bg-base-200 shrink-0 border border-line">
                  <img
                    v-if="hasThumbnail(video.name)"
                    :src="getThumbnailUrl(video.fullPath)"
                    alt=""
                    class="h-full w-full object-cover transition-transform duration-150"
                  />
                  <div v-else class="flex h-full w-full items-center justify-center">
                    <Icon name="mdi:play" class="w-5 h-5 text-fg-3" />
                  </div>

                  <!-- Video Preview Overlay -->
                  <div v-if="hoveredVideo === video.fullPath || (isMobile && visibleVideos.has(video.fullPath))" 
                       class="absolute inset-0 z-10 duration-200">
                    <img :src="getPreviewUrl(video.fullPath)" 
                         class="w-full h-full object-cover opacity-0 transition-opacity duration-150" 
                         @load="$event.target.classList.remove('opacity-0')"
                         alt="Preview" />
                  </div>
                </div>

                <!-- Small Metadata -->
                <div class="flex flex-col min-w-0 justify-center">
                  <h4 class="text-[13px] leading-snug line-clamp-2 mb-1 text-fg">
                    {{ video.name }}
                  </h4>
                  <div class="num text-[12px] text-fg-3">
                    {{ formatDate(video.lastModified).split(',')[0] }}
                  </div>
                </div>
              </a>

              <div class="pt-4">
                <button 
                  v-if="visibleVideosCount < recommendedVideos.length"
                  class="btn btn-xs w-full"
                  @click="loadMore"
                >
                  Show More
                </button>
              </div>
            </div>

            <div v-else>
              <p class="text-[14px] text-fg-3">No related videos.</p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Share Modal -->
    <div v-if="showShareModal" class="modal modal-open">
      <div class="modal-box rounded-xl p-8 max-w-sm border border-line">
        <div class="flex items-center gap-3 mb-8">
          <div>
            <h3 class="font-medium text-base tracking-tight text-fg">Share Video</h3>
            <p class="text-[13px] text-fg-3">Manage public sharing access</p>
          </div>
        </div>

        <div v-if="currentVideo" class="space-y-6">
          <div class="flex items-center justify-between p-4 bg-base-200 rounded-lg border border-line">
            <div>
              <span class="text-xs tracking-micro font-mono text-fg uppercase">Public Link</span>
              <p class="text-[11px] text-fg-3 uppercase tracking-micro font-mono">Enable public sharing</p>
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
              <div class="bg-surface-2 p-4 rounded-lg flex flex-col gap-3 border border-line-strong">
                <p class="text-[13px] text-success leading-relaxed">Sharing active. Anyone with the link can view.</p>
                <button class="btn btn-sm btn-success w-full" @click="copyPublicLinkForVideo">
                  <Icon name="mdi:content-copy" class="w-3.5 h-3.5 mr-2" />
                  Copy Public Link
                </button>
              </div>
            </div>
          </transition>

          <div class="pt-4">
            <button class="btn btn-ghost btn-sm w-full" @click="showShareModal = false">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tag Modal -->
    <div v-if="showTagModal" class="modal modal-open">
      <div class="modal-box rounded-xl p-8 max-w-sm border border-line">
        <div class="flex items-center gap-3 mb-8">
          <div>
            <h3 class="font-medium text-base tracking-tight text-fg">Manage Tags</h3>
            <p class="text-[13px] text-fg-3">Add tags to your media</p>
          </div>
        </div>

        <div v-if="showNewTagForm" class="space-y-5">
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text">Tag Name</span>
            </label>
            <input
              v-model="newTagName"
              type="text"
              placeholder="Work, Personal, Favorites..."
              class="input input-bordered w-full transition font-medium text-xs"
            />
          </div>
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text">Tag Color</span>
            </label>
            <div class="flex gap-3 items-center">
              <input
                v-model="newTagColor"
                type="color"
                class="w-11 h-11 rounded-lg cursor-pointer border-none bg-base-200"
              />
              <div class="flex-grow h-11 rounded-lg flex items-center px-4 text-[11px] bg-base-200 border border-dashed border-line uppercase tracking-micro font-mono" :style="{ color: newTagColor }">
                 Color Preview
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2 mt-10">
            <button class="btn btn-primary btn-sm" @click="addTag">Create & Apply</button>
            <button class="btn btn-ghost btn-sm" @click="showNewTagForm = false">Existing Tags</button>
            <button class="btn btn-ghost btn-sm text-error" @click="closeTagModal">Cancel</button>
          </div>
        </div>

        <div v-else class="space-y-5">
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text">Select Existing Tags</span>
            </label>
            <div class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              <div
                v-for="tag in predefinedTags"
                :key="tag.name"
                class="flex items-center gap-2 px-3 h-9 rounded-lg border cursor-pointer text-[13px] transition-colors"
                :class="isTagSelected(tag) ? 'border-fg text-fg bg-surface-2' : 'border-line text-fg-2 hover:border-line-strong'"
                role="checkbox"
                :aria-checked="isTagSelected(tag)"
                @click="toggleTagSelection(tag)"
              >
                <span class="dot" :style="{ backgroundColor: tag.color }"></span>
                <span class="truncate flex-1 text-left">{{ tag.name }}</span>
                <Icon v-if="isTagSelected(tag)" name="mdi:check" class="w-3.5 h-3.5 shrink-0" />
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2 mt-10">
            <button class="btn btn-primary btn-sm" @click="addTag">Apply Selection</button>
            <button class="btn btn-ghost btn-sm" @click="showNewTagForm = true">New Tag</button>
            <button class="btn btn-ghost btn-sm text-error" @click="closeTagModal">Cancel</button>
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
  background: var(--line-strong);
  border-radius: 10px;
}

video::shadow(video-controls) {
  display: none !important;
}

/* Ensure proper focus ring on thumbnails */
.group\/thumb:focus-within {
  outline: 2px solid var(--text);
  outline-offset: 2px;
}
</style>
