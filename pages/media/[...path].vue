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

    const response = await fetch('/api/file-meta', {      method: 'POST',
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

const loadMore = () => {
  visibleVideosCount.value += 20;
};

onMounted(() => {
  fetchVideos();
  fetchPredefinedTags();
});

// Watch for route changes to refresh the video
watch(() => route.params.path, () => {
  const subpath = Array.isArray(route.params.path) ? route.params.path.map(decodeURIComponent).join('/') : decodeURIComponent(route.params.path || '')
  currentVideo.value = videos.value.find(video => video.fullPath === subpath) || null
  // Scroll to top when video changes
  window.scrollTo({ top: 0, behavior: 'smooth' })
})
</script>

<template>
  <div class="min-h-screen bg-base-200/30">
    <!-- Edge-to-Edge Header area (modern and clean) -->
    <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/5 mb-6">
      <div class="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-4">
          <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden">
            <Icon name="mdi:menu" class="w-5 h-5" />
          </label>
          
          <NuxtLink to="/media" class="btn btn-ghost btn-circle btn-sm bg-base-100 shadow-sm border border-base-content/5">
            <Icon name="mdi:arrow-left" class="w-5 h-5" />
          </NuxtLink>
          
          <div>
            <h1 class="text-xl font-black tracking-tight flex items-center gap-2">
              <Icon name="mdi:play-box-multiple-outline" class="text-primary w-6 h-6" />
              Media Player
            </h1>
            <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1 truncate max-w-[150px] sm:max-w-md">
              {{ currentVideo?.name || 'Loading video...' }}
            </p>
          </div>
        </div>
      </div>
    </header>

    <div class="max-w-[1800px] mx-auto px-4 pb-8 sm:px-6 lg:px-8">
      <!-- Main Content Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <!-- Player Column -->
        <div class="lg:col-span-8 xl:col-span-9">
          <!-- Loading State -->
          <div v-if="isLoading" class="aspect-video bg-base-300 animate-pulse rounded-2xl shadow-lg"></div>

          <!-- Error State -->
          <div v-else-if="error" class="alert alert-error shadow-lg rounded-2xl">
            <Icon name="mdi:alert-circle" class="w-6 h-6" />
            <span>{{ error }}</span>
          </div>

          <!-- Video Content -->
          <div v-else-if="currentVideo">
            <!-- Player Wrapper -->
            <div class="relative group aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/5">
              <video
                id="previewVideo"
                controls
                autoplay
                class="w-full h-full"
                :key="currentVideo.fullPath"
              >
                <source :src="getStreamUrl()" :type="getSourceType(currentVideo.name)" />
                Your browser does not support the video tag.
              </video>            </div>

            <!-- Header Info -->
            <div class="mt-6">
              <h1 class="text-2xl sm:text-3xl font-black tracking-tight leading-tight mb-3">
                {{ currentVideo.name }}
              </h1>

              <div class="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-base-content/5">
                <div class="flex items-center gap-6">
                  <div class="flex flex-col">
                    <span class="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">Size</span>
                    <span class="text-sm font-bold">{{ formatFileSize(currentVideo.size) }}</span>
                  </div>
                  <div class="h-8 w-px bg-base-content/10"></div>
                  <div class="flex flex-col">
                    <span class="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">Modified</span>
                    <span class="text-sm font-bold">{{ formatDate(currentVideo.lastModified) }}</span>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                   <button 
                     class="btn btn-sm btn-ghost gap-2 rounded-full border border-base-content/10"
                     :class="{ 'text-orange-500': currentVideo.meta.isFavourite }"
                     @click="toggleFavourite(currentVideo)"
                   >
                     <Icon :name="currentVideo.meta.isFavourite ? 'mdi:star' : 'mdi:star-outline'" class="w-4 h-4" />
                     {{ currentVideo.meta.isFavourite ? 'Favourited' : 'Favourite' }}
                   </button>
                   <button class="btn btn-sm btn-ghost gap-2 rounded-full border border-base-content/10" @click="downloadVideo">
                     <Icon name="mdi:download" class="w-4 h-4" />
                     Download
                   </button>
                   <button class="btn btn-sm btn-primary gap-2 rounded-full px-4 shadow-lg" @click="showShareModal = true">
                     <Icon name="mdi:share-variant" class="w-4 h-4" />
                     Share
                   </button>
                </div>
              </div>

              <!-- Tags & Actions -->
              <div class="flex flex-wrap items-center gap-3 mt-6">
                <div v-if="currentVideo.meta.tags?.length" class="flex flex-wrap gap-1.5">
                  <span
                    v-for="tag in currentVideo.meta.tags"
                    :key="tag.name"
                    class="badge badge-md border-none text-white font-bold py-3.5 shadow-sm group/tag"
                    :style="{ backgroundColor: tag.color }"
                  >
                    {{ tag.name }}
                    <Icon name="mdi:close" 
                          class="w-0 group-hover/tag:w-3 h-3 ml-0 group-hover/tag:ml-1 cursor-pointer transition-all" 
                          @click.stop="removeTag(tag)" />
                  </span>
                </div>
                <button
                  class="btn btn-ghost btn-xs sm:btn-sm bg-base-100 hover:bg-base-200 border border-base-content/5 rounded-full px-3 transition-all"
                  @click="openTagModal"
                >
                  <Icon name="mdi:tag-plus-outline" class="w-4 h-4 mr-1 text-primary" /> 
                  <span class="font-bold text-[11px] uppercase tracking-wide">Add Tag</span>
                </button>
              </div>

              <!-- Description Section -->
              <div class="mt-8 bg-base-100 rounded-2xl p-6 shadow-sm ring-1 ring-base-content/5">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-xs font-black uppercase tracking-widest text-base-content/40">Description</h3>
                  <button 
                    v-if="!isEditingDescription"
                    class="btn btn-ghost btn-circle btn-sm"
                    @click="startEditDescription"
                  >
                    <Icon name="mdi:pencil" class="w-4 h-4" />
                  </button>
                </div>

                <div v-if="isEditingDescription" class="space-y-4">
                  <textarea
                    v-model="editableDescription"
                    class="textarea textarea-bordered w-full h-40 bg-base-200/50 focus:bg-base-100 transition-all font-medium text-sm rounded-xl"
                    placeholder="Tell us more about this video..."
                  ></textarea>
                  <div class="flex justify-end gap-3">
                    <button class="btn btn-ghost btn-sm rounded-lg" @click="isEditingDescription = false">Cancel</button>
                    <button class="btn btn-primary btn-sm rounded-lg px-6 shadow-md" @click="saveDescription">Save Changes</button>
                  </div>
                </div>
                
                <div v-else>
                  <p v-if="currentVideo.meta.description" class="text-sm leading-relaxed font-medium text-base-content/80 whitespace-pre-line">
                    {{ currentVideo.meta.description }}
                  </p>
                  <div v-else class="flex flex-col items-center py-4 text-center">
                    <p class="text-sm font-bold text-base-content/30 italic mb-3">No description provided yet.</p>
                    <button class="btn btn-ghost btn-sm border border-dashed border-base-content/20 rounded-xl" @click="startEditDescription">
                      <Icon name="mdi:plus" class="w-4 h-4 mr-1" /> Add Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Video Not Found -->
          <div v-else class="flex flex-col items-center justify-center py-24 text-center">
             <div class="bg-base-300 p-8 rounded-full mb-6">
               <Icon name="mdi:movie-off-outline" class="w-20 h-20 text-base-content/20" />
             </div>
             <h2 class="text-2xl font-black">Video not found</h2>
             <p class="text-base-content/60 max-w-sm mt-3">The video you're looking for might have been moved, renamed, or deleted.</p>
             <NuxtLink to="/media" class="btn btn-primary mt-8 px-8 rounded-full shadow-lg">Return to Library</NuxtLink>
          </div>
        </div>

        <!-- Recommendations Column -->
        <div class="lg:col-span-4 xl:col-span-3">
          <div class="sticky top-24">
            <h2 class="text-xs font-black uppercase tracking-widest text-base-content/40 mb-5 pl-1 flex items-center gap-2">
              <Icon name="mdi:sparkles" class="w-4 h-4 text-primary" />
              Recommended for you
            </h2>

            <div v-if="isLoading" class="flex flex-col gap-4">
              <div v-for="i in 5" :key="i" class="flex gap-3">
                 <div class="w-32 aspect-video bg-base-300 animate-pulse rounded-lg flex-shrink-0"></div>
                 <div class="flex-grow space-y-2">
                   <div class="h-3 w-full bg-base-300 animate-pulse rounded"></div>
                   <div class="h-2 w-1/2 bg-base-300 animate-pulse rounded"></div>
                 </div>
              </div>
            </div>

            <div v-else-if="visibleRecommendedVideos.length" class="flex flex-col gap-5">
              <a
                v-for="video in visibleRecommendedVideos"
                :key="video.fullPath"
                class="group flex gap-3 hover:bg-base-100 p-2 -m-2 rounded-xl transition-all"
                :href="getVideoUrl(video.fullPath)"
                @click.prevent="goToVideo(video.fullPath)"
              >
                <!-- Compact Thumbnail -->
                <div class="relative w-32 aspect-video overflow-hidden rounded-lg bg-base-300 shadow-sm flex-shrink-0 ring-1 ring-base-content/5">
                  <img
                    v-if="hasThumbnail(video.name)"
                    :src="getThumbnailUrl(video.fullPath)"
                    alt=""
                    class="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div v-else class="flex h-full w-full items-center justify-center">
                    <Icon name="mdi:play" class="w-5 h-5 text-base-content/20" />
                  </div>
                </div>

                <!-- Small Metadata -->
                <div class="flex flex-col min-w-0">
                  <h4 class="text-xs font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1">
                    {{ video.name }}
                  </h4>
                  <div class="text-[10px] font-bold text-base-content/40">
                    {{ formatDate(video.lastModified) }}
                  </div>
                  <div class="flex flex-wrap gap-1 mt-1">
                     <span v-for="tag in video.meta.tags.slice(0, 1)" :key="tag.name" class="badge badge-xs border-none text-[8px]" :style="{ backgroundColor: tag.color, color: 'white' }">
                       {{ tag.name }}
                     </span>
                  </div>
                </div>
              </a>

              <button 
                v-if="visibleVideosCount < recommendedVideos.length"
                class="btn btn-ghost btn-sm w-full font-bold uppercase tracking-widest text-[10px] mt-2 rounded-xl border-base-content/5"
                @click="loadMore"
              >
                Load more suggestions
              </button>
            </div>

            <div v-else class="bg-base-100 p-8 rounded-2xl text-center shadow-sm ring-1 ring-base-content/5">
              <Icon name="mdi:video-off-outline" class="w-8 h-8 text-base-content/20 mx-auto mb-3" />
              <p class="text-xs font-bold text-base-content/40 uppercase tracking-wider">No similar videos found</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Share Modal -->
    <div v-if="showShareModal" class="modal modal-open backdrop-blur-md">
      <div class="modal-box rounded-3xl shadow-2xl p-8 max-w-md border border-base-content/5">
        <div class="flex items-center gap-3 mb-6">
          <div class="bg-primary/10 p-3 rounded-2xl">
            <Icon name="mdi:share-variant" class="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 class="font-black text-xl tracking-tight">Share Video</h3>
            <p class="text-xs font-medium text-base-content/50">Manage how others access this video.</p>
          </div>
        </div>

        <div v-if="currentVideo" class="space-y-6">
          <div class="flex items-center justify-between p-4 bg-base-200/50 rounded-2xl border border-base-content/5">
            <div>
              <span class="text-sm font-black tracking-tight">Public Access</span>
              <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">Enable to share via link</p>
            </div>
            <input 
              type="checkbox" 
              class="toggle toggle-success toggle-sm" 
              :checked="currentVideo.meta.isPublic" 
              @change="togglePublicAccess" 
            />
          </div>

          <transition name="fade">
            <div v-if="currentVideo.meta.isPublic" class="space-y-4">
              <div class="bg-success/10 p-4 rounded-2xl flex flex-col gap-3 border border-success/20">
                <p class="text-[11px] font-bold text-success-content/70">Anyone with the link can view this video.</p>
                <button class="btn btn-sm btn-success text-white w-full rounded-xl shadow-lg shadow-success/20 h-11" @click="copyPublicLinkForVideo">
                  <Icon name="mdi:content-copy" class="w-4 h-4 mr-2" />
                  Copy Public Link
                </button>
              </div>
            </div>
          </transition>

          <div class="flex flex-col gap-3 pt-4">
            <button class="btn btn-ghost h-12 rounded-xl" @click="showShareModal = false">Close</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tag Modal (Enhanced) -->
    <div v-if="showTagModal" class="modal modal-open backdrop-blur-md">
      <div class="modal-box rounded-3xl shadow-2xl p-8 max-w-lg border border-base-content/5">
        <div class="flex items-center gap-3 mb-6">
          <div class="bg-primary/10 p-3 rounded-2xl">
            <Icon name="mdi:tag-plus" class="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 class="font-black text-xl tracking-tight">Tag your content</h3>
            <p class="text-xs font-medium text-base-content/50">Organization makes finding videos easier.</p>
          </div>
        </div>

        <div v-if="showNewTagForm" class="space-y-6">
          <div class="form-control">
            <label class="label mb-1">
              <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/50">Tag Identity</span>
            </label>
            <input
              v-model="newTagName"
              type="text"
              placeholder="e.g. Cinematic, Vacation 2024..."
              class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-sm h-12 rounded-xl"
            />
          </div>
          <div class="form-control">
            <label class="label mb-1">
              <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/50">Visual Color</span>
            </label>
            <div class="flex gap-4 items-center">
              <input
                v-model="newTagColor"
                type="color"
                class="w-16 h-12 rounded-xl cursor-pointer border-none bg-base-200/50"
              />
              <div class="flex-grow h-12 rounded-xl flex items-center px-4 font-bold text-sm bg-base-200/50 border border-dashed border-base-content/20" :style="{ color: newTagColor }">
                 {{ newTagColor }} Preview
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-3 mt-8">
            <button class="btn btn-primary h-12 rounded-xl shadow-lg shadow-primary/20" @click="addTag">Create & Add Tag</button>
            <button class="btn btn-ghost btn-sm h-12 rounded-xl" @click="showNewTagForm = false">Choose from library</button>
            <button class="btn btn-ghost btn-sm h-12 rounded-xl" @click="closeTagModal">Dismiss</button>
          </div>
        </div>

        <div v-else class="space-y-6">
          <div class="form-control">
            <label class="label mb-3">
              <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/50">Library Selection</span>
            </label>
            <div class="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              <div
                v-for="tag in predefinedTags"
                :key="tag.name"
                class="p-3 rounded-xl cursor-pointer text-center font-bold text-xs transition-all ring-2 ring-inset"
                :style="{ 
                  backgroundColor: isTagSelected(tag) ? tag.color : 'transparent', 
                  color: isTagSelected(tag) ? 'white' : tag.color,
                  ringColor: tag.color
                }"
                @click="toggleTagSelection(tag)"
              >
                {{ tag.name }}
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-3 mt-8">
            <button class="btn btn-primary h-12 rounded-xl shadow-lg shadow-primary/20" @click="addTag">Apply Selected Tags</button>
            <button class="btn btn-ghost btn-sm h-12 rounded-xl" @click="showNewTagForm = true">Create new identity</button>
            <button class="btn btn-ghost btn-sm h-12 rounded-xl" @click="closeTagModal">Dismiss</button>
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
