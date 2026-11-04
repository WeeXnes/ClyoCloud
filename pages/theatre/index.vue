<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'

useHead({
  title: 'Theatre'
})

const route = useRoute()
const router = useRouter()

// Types
interface Episode {
  name: string
  title: string
  videoFile: string
  videoPath: string
  size: number
}

interface Season {
  name: string
  episodes: Episode[]
}

interface MediaItem {
  id: string
  name: string
  title: string
  type: 'movie' | 'show'
  videoFile?: string
  videoPath?: string
  artworkUrl: string
  description: string
  year: string
  size?: number
  lastModified?: number
  seasons?: Season[]
}

// Media state
const movies = ref<MediaItem[]>([])
const shows = ref<MediaItem[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')
const activeFilter = ref<'all' | 'movies' | 'shows'>('all')
const randomFeaturedIndex = ref<number>(-1)

// Selected media detail modal
const selectedMedia = ref<MediaItem | null>(null)
const activeSeasonIndex = ref(0)

// Editing metadata modal
const showEditModal = ref(false)
const editForm = ref({
  title: '',
  year: '',
  description: '',
  artworkUrl: ''
})
const artworkFile = ref<File | null>(null)
const isSavingMeta = ref(false)

// Custom Video Player state
const showPlayer = ref(false)
const playingMedia = ref<{
  title: string
  subTitle?: string
  videoPath: string
  mediaId: string
  type: 'movie' | 'show'
} | null>(null)

const videoRef = ref<HTMLVideoElement | null>(null)
const playerIsPlaying = ref(false)
const playerCurrentTime = ref(0)
const playerDuration = ref(0)
const playerVolume = ref(1)
const playerMuted = ref(false)
const playerPlaybackRate = ref(1)
const playerBuffered = ref(0)
const playCompatibility = ref(false)
const showControls = ref(true)
let controlsTimer: any = null

// Featured Media (Banner)
const featuredMedia = computed(() => {
  const allMedia = [...movies.value, ...shows.value]
  if (allMedia.length === 0) return null
  if (randomFeaturedIndex.value === -1 || randomFeaturedIndex.value >= allMedia.length) {
    return allMedia[0]
  }
  return allMedia[randomFeaturedIndex.value]
})

// Filtered and searched lists
const filteredMovies = computed(() => {
  if (!searchQuery.value.trim()) return movies.value
  const query = searchQuery.value.toLowerCase()
  return movies.value.filter(m => 
    m.title.toLowerCase().includes(query) || 
    m.description.toLowerCase().includes(query)
  )
})

const filteredShows = computed(() => {
  if (!searchQuery.value.trim()) return shows.value
  const query = searchQuery.value.toLowerCase()
  return shows.value.filter(s => 
    s.title.toLowerCase().includes(query) || 
    s.description.toLowerCase().includes(query)
  )
})

// Data loading
const fetchMedia = async () => {
  try {
    isLoading.value = true
    error.value = null
    const res = await $fetch<{ movies: MediaItem[], shows: MediaItem[] }>('/api/theatre/media')
    movies.value = res.movies
    shows.value = res.shows

    const totalMediaCount = res.movies.length + res.shows.length
    if (totalMediaCount > 0) {
      if (randomFeaturedIndex.value === -1 || randomFeaturedIndex.value >= totalMediaCount) {
        randomFeaturedIndex.value = Math.floor(Math.random() * totalMediaCount)
      }
    } else {
      randomFeaturedIndex.value = -1
    }

    // Trigger autoplay from query once media has loaded
    if (route.query.play) {
      handleAutoPlayFromQuery(route.query.play as string)
    }
  } catch (err: any) {
    console.error('Error fetching media:', err)
    error.value = 'Failed to load media files. Make sure the movies and shows directories are populated.'
  } finally {
    isLoading.value = false
  }
}

const handleAutoPlayFromQuery = (videoPath: string) => {
  const decodedTarget = decodeURIComponent(videoPath)
  const isCompat = route.query.compatibility === 'true'
  
  // Try to find in movies
  const movie = movies.value.find(m => decodeURIComponent(m.videoPath || '') === decodedTarget)
  if (movie) {
    playingMedia.value = { 
      title: movie.title, 
      subTitle: undefined, 
      videoPath: movie.videoPath!, 
      mediaId: movie.id, 
      type: 'movie' 
    }
    playCompatibility.value = isCompat
    showPlayer.value = true
    playerCurrentTime.value = 0
    playerDuration.value = 0
    playerIsPlaying.value = false
    resetControlsTimeout()
    return
  }

  // Try to find in shows
  for (const show of shows.value) {
    if (!show.seasons) continue
    for (const season of show.seasons) {
      for (const episode of season.episodes) {
        if (decodeURIComponent(episode.videoPath) === decodedTarget) {
          playingMedia.value = {
            title: episode.title,
            subTitle: `${show.title} - ${season.name}`,
            videoPath: episode.videoPath,
            mediaId: show.id,
            type: 'show'
          }
          playCompatibility.value = isCompat
          showPlayer.value = true
          playerCurrentTime.value = 0
          playerDuration.value = 0
          playerIsPlaying.value = false
          resetControlsTimeout()
          return
        }
      }
    }
  }
}

onMounted(async () => {
  await router.isReady() // Wait for route query params to be populated
  await fetchMedia()
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  if (controlsTimer) clearTimeout(controlsTimer)
})

watch(
  () => route.query.play,
  (newPlay) => {
    if (!newPlay) {
      if (showPlayer.value) {
        showPlayer.value = false
        playingMedia.value = null
        if (videoRef.value) {
          videoRef.value.pause()
        }
      }
    } else {
      const path = newPlay as string
      if (playingMedia.value?.videoPath !== path) {
        handleAutoPlayFromQuery(path)
      }
    }
  }
)

watch(
  () => route.query.compatibility,
  (newCompat) => {
    const isCompat = newCompat === 'true'
    if (playingMedia.value && playCompatibility.value !== isCompat) {
      playCompatibility.value = isCompat
      nextTick(() => {
        if (videoRef.value) {
          videoRef.value.load()
          videoRef.value.play().catch(e => console.log('Playback state sync error:', e))
        }
      })
    }
  }
)



// Detail modal handlers
const openDetails = (media: MediaItem) => {
  selectedMedia.value = media
  activeSeasonIndex.value = 0
}

const closeDetails = () => {
  selectedMedia.value = null
}

// Metadata Edit handlers
const openEditMetadata = () => {
  if (!selectedMedia.value) return
  editForm.value = {
    title: selectedMedia.value.title,
    year: selectedMedia.value.year,
    description: selectedMedia.value.description,
    artworkUrl: selectedMedia.value.artworkUrl.startsWith('/api') ? '' : selectedMedia.value.artworkUrl
  }
  artworkFile.value = null
  showEditModal.value = true
}

const closeEditMetadata = () => {
  showEditModal.value = false
}

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    artworkFile.value = target.files[0]
  }
}

const saveMetadata = async () => {
  if (!selectedMedia.value) return
  isSavingMeta.value = true
  try {
    // 1. Save Text Metadata
    const updatedMeta = await $fetch('/api/theatre/metadata', {
      method: 'POST',
      body: {
        type: selectedMedia.value.type,
        name: selectedMedia.value.id,
        title: editForm.value.title,
        year: editForm.value.year,
        description: editForm.value.description,
        artworkUrl: editForm.value.artworkUrl
      }
    })

    // 2. Upload Artwork File if selected
    if (artworkFile.value) {
      const formData = new FormData()
      formData.append('type', selectedMedia.value.type)
      formData.append('name', selectedMedia.value.id)
      formData.append('file', artworkFile.value)

      const uploadRes: any = await $fetch('/api/theatre/artwork', {
        method: 'POST',
        body: formData
      })

      if (uploadRes.success) {
        selectedMedia.value.artworkUrl = uploadRes.artworkUrl
      }
    } else {
      selectedMedia.value.artworkUrl = editForm.value.artworkUrl || selectedMedia.value.artworkUrl
    }

    selectedMedia.value.title = editForm.value.title
    selectedMedia.value.year = editForm.value.year
    selectedMedia.value.description = editForm.value.description

    // Refresh overall list
    await fetchMedia()
    createNotification('Metadata saved successfully!', NotificationType.SUCCESS)
    closeEditMetadata()
  } catch (err: any) {
    console.error('Failed to save metadata:', err)
    createNotification('Error saving metadata.', NotificationType.ERROR)
  } finally {
    isSavingMeta.value = false
  }
}

// Media player handlers
const startPlayback = (title: string, subTitle: string | undefined, videoPath: string, mediaId: string, type: 'movie' | 'show') => {
  playingMedia.value = { title, subTitle, videoPath, mediaId, type }
  playCompatibility.value = route.query.compatibility === 'true' // Load from URL query if present
  showPlayer.value = true
  playerCurrentTime.value = 0
  playerDuration.value = 0
  playerIsPlaying.value = false
  resetControlsTimeout()

  const query = {
    ...route.query,
    play: videoPath
  }
  if (playCompatibility.value) {
    query.compatibility = 'true'
  }
  router.push({ query })
}

const closePlayer = () => {
  showPlayer.value = false
  playingMedia.value = null
  if (videoRef.value) {
    videoRef.value.pause()
  }

  const query = { ...route.query }
  delete query.play
  delete query.compatibility
  router.push({ query })
}

// Video Player computed url
const currentStreamUrl = computed(() => {
  if (!playingMedia.value) return ''
  return `${playingMedia.value.videoPath}${playCompatibility.value ? '?compatibility=true' : ''}`
})

// Toggle stream compatibility (saving and restoring timestamp)
const toggleCompatibility = () => {
  const prevTime = playerCurrentTime.value
  playCompatibility.value = !playCompatibility.value
  
  createNotification(
    playCompatibility.value ? 'Compatibility Mode enabled (Audio transcoded to AAC)' : 'Direct Stream Mode enabled',
    NotificationType.INFO
  )

  const query = { ...route.query }
  if (playCompatibility.value) {
    query.compatibility = 'true'
  } else {
    delete query.compatibility
  }
  router.push({ query })

  // Force video element reload
  nextTick(() => {
    if (videoRef.value) {
      videoRef.value.load()
      videoRef.value.currentTime = prevTime
      videoRef.value.play().catch(e => console.log('Autoplay blocked on toggle:', e))
    }
  })
}

// Control Bar visibility on Inactivity
const resetControlsTimeout = () => {
  showControls.value = true
  if (controlsTimer) clearTimeout(controlsTimer)
  
  if (playerIsPlaying.value) {
    controlsTimer = setTimeout(() => {
      showControls.value = false
    }, 3000)
  }
}

const onMouseMove = () => {
  resetControlsTimeout()
}

// Video element events
const onTimeUpdate = () => {
  if (videoRef.value) {
    playerCurrentTime.value = videoRef.value.currentTime
  }
}

const onDurationChange = () => {
  if (videoRef.value) {
    playerDuration.value = videoRef.value.duration
  }
}

const onProgress = () => {
  if (videoRef.value && videoRef.value.buffered.length > 0) {
    const duration = videoRef.value.duration
    if (duration > 0) {
      const bufferedEnd = videoRef.value.buffered.end(videoRef.value.buffered.length - 1)
      playerBuffered.value = (bufferedEnd / duration) * 100
    }
  }
}

// Custom Player controls logic
const togglePlay = () => {
  if (!videoRef.value) return
  if (videoRef.value.paused) {
    videoRef.value.play()
    playerIsPlaying.value = true
  } else {
    videoRef.value.pause()
    playerIsPlaying.value = false
  }
  resetControlsTimeout()
}

const seek = (e: MouseEvent) => {
  if (!videoRef.value || playerDuration.value === 0) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const clickX = e.clientX - rect.left
  const width = rect.width
  const percentage = clickX / width
  const newTime = percentage * playerDuration.value
  videoRef.value.currentTime = newTime
  playerCurrentTime.value = newTime
  resetControlsTimeout()
}

const skipTime = (seconds: number) => {
  if (!videoRef.value) return
  let newTime = videoRef.value.currentTime + seconds
  if (newTime < 0) newTime = 0
  if (newTime > playerDuration.value) newTime = playerDuration.value
  videoRef.value.currentTime = newTime
  playerCurrentTime.value = newTime
  resetControlsTimeout()
}

const changeVolume = (e: Event) => {
  const target = e.target as HTMLInputElement
  const volume = parseFloat(target.value)
  playerVolume.value = volume
  if (videoRef.value) {
    videoRef.value.volume = volume
    videoRef.value.muted = volume === 0
    playerMuted.value = volume === 0
  }
  resetControlsTimeout()
}

const toggleMute = () => {
  if (!videoRef.value) return
  playerMuted.value = !playerMuted.value
  videoRef.value.muted = playerMuted.value
  if (!playerMuted.value && playerVolume.value === 0) {
    playerVolume.value = 0.5
    videoRef.value.volume = 0.5
  }
  resetControlsTimeout()
}

const setPlaybackRate = (rate: number) => {
  playerPlaybackRate.value = rate
  if (videoRef.value) {
    videoRef.value.playbackRate = rate
  }
  resetControlsTimeout()
}

const toggleFullscreen = () => {
  const container = document.getElementById('theatre-player-container')
  if (!container) return
  
  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => {
      console.error('Error enabling fullscreen:', err)
    })
  } else {
    document.exitFullscreen()
  }
  resetControlsTimeout()
}

// Helpers
const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds === Infinity) return '00:00'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  const formattedMins = mins.toString().padStart(2, '0')
  const formattedSecs = secs.toString().padStart(2, '0')

  if (hrs > 0) {
    return `${hrs}:${formattedMins}:${formattedSecs}`
  }
  return `${formattedMins}:${formattedSecs}`
}

const formatFileSize = (size: number | undefined): string => {
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

// Global Keyboard shortcuts
const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (!showPlayer.value) return

  // Prevent default behavior of Space/Arrows (like scrolling the page) while playing
  if (['Space', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault()
  }

  switch (e.key) {
    case ' ':
    case 'Spacebar':
      togglePlay()
      break
    case 'ArrowLeft':
      skipTime(-10)
      break
    case 'ArrowRight':
      skipTime(10)
      break
    case 'ArrowUp':
      const volUp = Math.min(playerVolume.value + 0.05, 1)
      playerVolume.value = volUp
      if (videoRef.value) videoRef.value.volume = volUp
      break
    case 'ArrowDown':
      const volDown = Math.max(playerVolume.value - 0.05, 0)
      playerVolume.value = volDown
      if (videoRef.value) videoRef.value.volume = volDown
      break
    case 'm':
    case 'M':
      toggleMute()
      break
    case 'f':
    case 'F':
      toggleFullscreen()
      break
    case 'Escape':
      closePlayer()
      break
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-100 text-fg-2 flex flex-col font-sans select-none pb-16">
    <!-- Header -->
    <header class="page-bar">
      <div class="page-wrap py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden" aria-label="Open navigation">
            <Icon name="mdi:menu" class="w-5 h-5" />
          </label>
          <div class="flex items-center gap-2">
            <div>
              <h1 class="text-[15px] font-medium tracking-section text-fg leading-tight">Theatre</h1>
              <p class="hidden sm:block text-[13px] text-fg-3 leading-tight">Movies and shows</p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Search Bar -->
          <div class="relative flex-1 sm:flex-none">
            <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Icon name="mdi:magnify" class="w-4 h-4 text-fg-3" />
            </div>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search movies & shows..."
              class="input input-sm w-full sm:w-60 !pl-9"
            />
          </div>

          <!-- Category Filters -->
          <div class="inline-flex shrink-0 p-[3px] border border-line rounded-full text-[13px]" role="group" aria-label="Filter">
            <button 
              @click="activeFilter = 'all'" 
              class="h-7 px-3 rounded-full transition-colors"
              :aria-pressed="activeFilter === 'all'"
              :class="activeFilter === 'all' ? 'bg-surface-2 text-fg' : 'text-fg-2 hover:text-fg'"
            >
              All
            </button>
            <button 
              @click="activeFilter = 'movies'" 
              class="h-7 px-3 rounded-full transition-colors"
              :aria-pressed="activeFilter === 'movies'"
              :class="activeFilter === 'movies' ? 'bg-surface-2 text-fg' : 'text-fg-2 hover:text-fg'"
            >
              Movies
            </button>
            <button 
              @click="activeFilter = 'shows'" 
              class="h-7 px-3 rounded-full transition-colors"
              :aria-pressed="activeFilter === 'shows'"
              :class="activeFilter === 'shows' ? 'bg-surface-2 text-fg' : 'text-fg-2 hover:text-fg'"
            >
              Shows
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content Area -->
    <div class="flex-1 w-full page-wrap mt-10">
      
      <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col gap-6 items-center justify-center py-40">
        <span class="loading loading-spinner loading-lg text-fg"></span>
        <p class="text-[14px] text-fg-3">Scanning movie and show folders…</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="max-w-form mx-auto py-16">
        <p class="text-[15px] text-fg">No media folders found.</p>
        <p class="text-[14px] text-fg-3 mt-1">Create the movies and shows folders and add some files. By default they are:</p>
        <dl class="hair-list mt-6 text-[13px]">
          <div class="flex justify-between gap-4 px-4 py-3"><dt class="micro">Movies</dt><dd class="num text-fg-2">~/.clyo/movies/</dd></div>
          <div class="flex justify-between gap-4 px-4 py-3"><dt class="micro">Shows</dt><dd class="num text-fg-2">~/.clyo/shows/</dd></div>
        </dl>
        <button @click="fetchMedia" class="btn btn-sm mt-6">Scan again</button>
      </div>

      <!-- Content (Hero + Grids) -->
      <div v-else class="space-y-16">
        
        <!-- Hero Banner (Jellyfin/Netflix Spotlight) -->
        <div 
          v-if="featuredMedia" 
          class="relative w-full h-[400px] md:h-[480px] rounded-xl overflow-hidden border border-line bg-black text-white flex items-end"
        >
          <!-- Backdrop Blur Image -->
          <div class="absolute inset-0 bg-black">
            <img 
              v-if="featuredMedia.artworkUrl"
              :src="featuredMedia.artworkUrl" 
              class="w-full h-full object-cover opacity-40"
              alt=""
            />
            <div class="absolute inset-0 bg-black/50"></div>
          </div>

          <!-- Hero Content details card -->
          <div class="relative z-10 w-full max-w-3xl p-8 md:p-12 space-y-4">
            <span class="inline-block border border-white/30 px-1.5 py-px rounded-md text-[11px] uppercase tracking-micro font-mono text-white/80">
              {{ featuredMedia.type === 'movie' ? 'Spotlight Movie' : 'Spotlight Show' }}
            </span>

            <h2 class="page-title !text-white">
              {{ featuredMedia.title }}
            </h2>

            <div class="flex items-center gap-3 text-[14px] text-white/80">
              <span v-if="featuredMedia.year">{{ featuredMedia.year }}</span>
              <span v-if="featuredMedia.year" aria-hidden="true">·</span>
              <span>
                {{ featuredMedia.type === 'movie' ? 'Feature Film' : `${featuredMedia.seasons?.length} Seasons` }}
              </span>
            </div>

            <p class="text-[15px] text-white/80 leading-relaxed line-clamp-3 max-w-2xl">
              {{ featuredMedia.description || 'No description configured. Click details to configure metadata and select artworks.' }}
            </p>

            <div class="flex items-center gap-3 pt-4">
              <button 
                v-if="featuredMedia.type === 'movie' && featuredMedia.videoPath"
                @click="startPlayback(featuredMedia.title, undefined, featuredMedia.videoPath, featuredMedia.id, 'movie')"
                class="btn btn-sm gap-2 !bg-white !border-white !text-black"
              >
                <Icon name="mdi:play" class="w-4 h-4" />
                Play
              </button>
              <button 
                @click="openDetails(featuredMedia)"
                class="btn btn-sm gap-2 !bg-transparent !border-white/40 !text-white hover:!bg-white/10"
              >
                <Icon name="mdi:information-outline" class="w-4 h-4" />
                Details
              </button>
            </div>
          </div>

          <!-- Poster image inside Hero (right side) -->
          <div class="absolute right-12 bottom-12 hidden md:block w-48 aspect-[2/3] rounded-xl overflow-hidden border border-white/20">
            <img 
              v-if="featuredMedia.artworkUrl"
              :src="featuredMedia.artworkUrl" 
              class="w-full h-full object-cover" 
              alt="Poster"
            />
            <div v-else class="w-full h-full bg-base-200 flex items-center justify-center">
              <Icon name="mdi:movie" class="w-16 h-16 text-line-strong" />
            </div>
          </div>
        </div>

        <!-- Movies List -->
        <div v-if="activeFilter === 'all' || activeFilter === 'movies'" class="space-y-4">
          <div class="flex items-baseline justify-between">
            <h2 class="section-title">Movies</h2>
            <span class="num text-[13px] text-fg-3">{{ filteredmovies.length }} films</span>
          </div>

          <div v-if="filteredMovies.length === 0" class="py-12 text-[14px] text-fg-3">
            No movies match your search query.
          </div>

          <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            <div 
              v-for="movie in filteredMovies" 
              :key="movie.id"
              class="group relative flex flex-col gap-2.5 cursor-pointer"
              @click="openDetails(movie)"
            >
              <!-- Card Poster image -->
              <div class="relative aspect-[2/3] rounded-xl overflow-hidden bg-base-200 border border-line group-hover:border-line-strong transition-colors">
                <img 
                  v-if="movie.artworkUrl"
                  :src="movie.artworkUrl" 
                  class="w-full h-full object-cover" 
                  alt="Poster"
                  loading="lazy"
                />
                <div v-else class="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                  <Icon name="mdi:movie-open-outline" class="w-10 h-10 text-line-strong mb-2" />
                  <span class="text-[11px] text-fg-3 uppercase tracking-micro font-mono truncate max-w-full">{{ movie.title }}</span>
                </div>

                <!-- Hover Play Overlay -->
                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <button 
                    v-if="movie.videoPath"
                    @click.stop="startPlayback(movie.title, undefined, movie.videoPath, movie.id, 'movie')"
                    class="w-11 h-11 flex items-center justify-center bg-white text-black rounded-full transition-opacity hover:opacity-85"
                    title="Play Movie"
                  >
                    <Icon name="mdi:play" class="w-5 h-5 pl-0.5" />
                  </button>
                  <button 
                    @click.stop="openDetails(movie)"
                    class="w-11 h-11 flex items-center justify-center border border-white/40 text-white rounded-full transition-colors hover:bg-white/10"
                    title="View Details"
                  >
                    <Icon name="mdi:information-variant" class="w-5 h-5" />
                  </button>
                </div>
              </div>

              <!-- Card title & subtitle -->
              <div class="px-1 text-left min-w-0">
                <h4 class="text-[14px] text-fg truncate max-w-full mb-0.5">
                  {{ movie.title }}
                </h4>
                <div class="flex items-center justify-between num text-[12px] text-fg-3">
                  <span>{{ movie.year || 'Unknown Year' }}</span>
                  <span>{{ formatFileSize(movie.size) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- TV Shows List -->
        <div v-if="activeFilter === 'all' || activeFilter === 'shows'" class="space-y-4">
          <div class="flex items-baseline justify-between">
            <h2 class="section-title">Shows</h2>
            <span class="num text-[13px] text-fg-3">{{ filteredshows.length }} series</span>
          </div>

          <div v-if="filteredShows.length === 0" class="py-12 text-[14px] text-fg-3">
            No TV shows match your search query.
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            <div 
              v-for="show in filteredShows" 
              :key="show.id"
              class="group relative flex flex-col gap-2.5 cursor-pointer"
              @click="openDetails(show)"
            >
              <!-- Card Poster image -->
              <div class="relative aspect-[2/3] rounded-xl overflow-hidden bg-base-200 border border-line group-hover:border-line-strong transition-colors">
                <img 
                  v-if="show.artworkUrl"
                  :src="show.artworkUrl" 
                  class="w-full h-full object-cover" 
                  alt="Poster"
                  loading="lazy"
                />
                <div v-else class="w-full h-full bg-base-200 flex flex-col items-center justify-center p-4 text-center">
                  <Icon name="mdi:television-guide" class="w-10 h-10 text-line-strong mb-2" />
                  <span class="text-[11px] text-fg-3 uppercase tracking-micro font-mono truncate max-w-full">{{ show.title }}</span>
                </div>

                <!-- Hover Overlay -->
                <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    @click.stop="openDetails(show)"
                    class="w-11 h-11 flex items-center justify-center bg-white text-black rounded-full transition-opacity hover:opacity-85"
                    title="View Seasons"
                  >
                    <Icon name="mdi:folder-open" class="w-5 h-5" />
                  </button>
                </div>
              </div>

              <!-- Card title & seasons -->
              <div class="px-1 text-left min-w-0">
                <h4 class="text-[14px] text-fg truncate max-w-full mb-0.5">
                  {{ show.title }}
                </h4>
                <div class="flex items-center justify-between num text-[12px] text-fg-3">
                  <span>{{ show.year || 'TV Series' }}</span>
                  <span>{{ show.seasons?.length }} Seasons</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Media Detail Modal (Jellyfin Style Details Panel) -->
    <div v-if="selectedMedia" class="modal modal-open z-50">
      <div class="modal-box max-w-4xl p-0 overflow-hidden relative">
        
        <!-- Backdrop Banner with Blurs -->
        <div class="relative w-full h-44 bg-black">
          <img 
            v-if="selectedMedia.artworkUrl"
            :src="selectedMedia.artworkUrl" 
            class="w-full h-full object-cover opacity-30"
            alt=""
          />
          <button @click="closeDetails" class="absolute top-4 right-4 btn btn-circle btn-sm !border-white/30 !text-white !bg-black/40 hover:!bg-black/60" aria-label="Close">
            <Icon name="mdi:close" class="w-5 h-5" />
          </button>
        </div>

        <!-- Main Body -->
        <div class="p-6 md:p-8 flex flex-col md:flex-row gap-8 -mt-24 relative z-10">
          
          <!-- Left Column (Poster + Actions) -->
          <div class="w-full md:w-56 shrink-0 flex flex-col items-center gap-4">
            <div class="w-full aspect-[2/3] rounded-xl overflow-hidden border border-line-strong bg-base-200">
              <img 
                v-if="selectedMedia.artworkUrl"
                :src="selectedMedia.artworkUrl" 
                class="w-full h-full object-cover" 
                alt="Poster"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <Icon name="mdi:movie-open" class="w-16 h-16 text-line-strong" />
              </div>
            </div>

            <!-- Action buttons -->
            <div class="w-full flex flex-col gap-2">
              <button 
                v-if="selectedMedia.type === 'movie' && selectedMedia.videoPath"
                @click="startPlayback(selectedMedia.title, undefined, selectedMedia.videoPath, selectedMedia.id, 'movie')"
                class="btn btn-primary btn-sm w-full gap-2"
              >
                <Icon name="mdi:play" class="w-4 h-4" />
                Play Movie
              </button>
              <button 
                @click="openEditMetadata"
                class="btn btn-sm w-full gap-2"
              >
                <Icon name="mdi:pencil" class="w-4 h-4" />
                Edit Info
              </button>
            </div>
          </div>

          <!-- Right Column (Details + Episode Scanner) -->
          <div class="flex-1 space-y-6 text-left">
            <div>
              <div class="flex items-center gap-3 flex-wrap">
                <h2 class="text-2xl font-medium text-fg tracking-title md:text-white">{{ selectedMedia.title }}</h2>
                <span class="badge num">{{ selectedMedia.year || 'No year' }}</span>
                <span class="badge">
                  {{ selectedMedia.type === 'movie' ? 'Movie' : 'TV Series' }}
                </span>
              </div>
              <p class="text-[13px] text-fg-3 mt-1">Folder: <span class="num">{{ selectedMedia.name }}</span></p>
            </div>

            <!-- Description -->
            <div class="text-[15px] text-fg-2 leading-relaxed">
              {{ selectedMedia.description || 'No description configured. Click "Edit Info" to write a summary, set artwork URLs, or upload poster images.' }}
            </div>

            <!-- Shows / Seasons & Episode Selection -->
            <div v-if="selectedMedia.type === 'show' && selectedMedia.seasons && selectedMedia.seasons.length > 0" class="space-y-4 border-t border-line pt-4">
              <h3 class="micro">Seasons</h3>
              
              <!-- Season Navigation tabs -->
              <div class="flex flex-wrap gap-2">
                <button 
                  v-for="(season, index) in selectedMedia.seasons" 
                  :key="season.name"
                  @click="activeSeasonIndex = index"
                  class="btn btn-xs"
                  :class="activeSeasonIndex === index ? 'btn-primary' : ''"
                >
                  {{ season.name }}
                </button>
              </div>

              <!-- Episodes in selected season -->
              <div class="hair-list mt-2 max-h-[220px] overflow-y-auto">
                <div 
                  v-for="episode in selectedMedia.seasons[activeSeasonIndex].episodes" 
                  :key="episode.videoFile"
                  class="flex items-center justify-between px-4 py-2.5 hover:bg-surface-2 transition-colors group/ep"
                >
                  <div class="flex items-center gap-3 min-w-0">
                    <Icon name="mdi:play-circle-outline" class="w-4 h-4 text-fg-3 group-hover/ep:text-fg transition-colors shrink-0" />
                    <div class="min-w-0">
                      <p class="text-[14px] text-fg truncate pr-4">{{ episode.title }}</p>
                      <p class="num text-[12px] text-fg-3">{{ formatFileSize(episode.size) }}</p>
                    </div>
                  </div>
                  
                  <button 
                    @click="startPlayback(episode.title, `${selectedMedia.title} - ${selectedMedia.seasons[activeSeasonIndex].name}`, episode.videoPath, selectedMedia.id, 'show')"
                    class="btn btn-ghost btn-circle btn-sm" aria-label="Play episode"
                    title="Play Episode"
                  >
                    <Icon name="mdi:play" class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>

    <!-- Metadata Edit Modal -->
    <div v-if="showEditModal && selectedMedia" class="modal modal-open z-[60]">
      <div class="modal-box max-w-lg p-6 text-left">
        <h3 class="section-title mb-6">
          Edit Media Information
        </h3>

        <div class="space-y-4">
          <!-- Title Input -->
          <div class="form-control w-full">
            <label class="label"><span class="label-text text-fg-2">Display Title</span></label>
            <input 
              v-model="editForm.title" 
              type="text" 
              placeholder="e.g. Inception" 
              class="input input-sm input-bordered w-full"
            />
          </div>

          <!-- Year Input -->
          <div class="form-control w-full">
            <label class="label"><span class="label-text text-fg-2">Release Year</span></label>
            <input 
              v-model="editForm.year" 
              type="text" 
              placeholder="e.g. 2010" 
              class="input input-sm input-bordered w-full"
            />
          </div>

          <!-- Description Input -->
          <div class="form-control w-full">
            <label class="label"><span class="label-text text-fg-2">Description / Summary</span></label>
            <textarea 
              v-model="editForm.description" 
              placeholder="Provide a plot summary..." 
              class="textarea textarea-bordered w-full h-24"
            ></textarea>
          </div>

          <!-- Artwork URL Input -->
          <div class="form-control w-full">
            <label class="label"><span class="label-text text-fg-2">Artwork URL (Fetch from anywhere)</span></label>
            <input 
              v-model="editForm.artworkUrl" 
              type="text" 
              placeholder="https://example.com/poster.jpg" 
              class="input input-sm input-bordered w-full"
            />
            <span class="text-[13px] text-fg-3 mt-1">Paste any direct image link to set as artwork.</span>
          </div>

          <!-- Local File Artwork Input -->
          <div class="form-control w-full">
            <label class="label"><span class="label-text text-fg-2">Or Upload Local Image</span></label>
            <input 
              type="file" 
              accept="image/*"
              @change="handleFileChange"
              class="file-input file-input-sm w-full"
            />
          </div>
        </div>

        <div class="modal-action flex justify-end gap-2 mt-6">
          <button 
            @click="closeEditMetadata" 
            class="btn btn-ghost btn-sm"
          >
            Cancel
          </button>
          <button 
            @click="saveMetadata" 
            :disabled="isSavingMeta"
            class="btn btn-primary btn-sm"
          >
            <span v-if="isSavingMeta" class="loading loading-spinner loading-xs"></span>
            Save Changes
          </button>
        </div>
      </div>
    </div>

    <!-- Polished Custom Video Player (Full Screen Cinematic Overlay) -->
    <div 
      v-if="showPlayer && playingMedia" 
      id="theatre-player-container"
      class="fixed inset-0 bg-black z-[999] flex flex-col justify-between"
      @mousemove="onMouseMove"
    >
      <!-- Video Element -->
      <div class="absolute inset-0 z-10 w-full h-full flex items-center justify-center bg-black">
        <video
          ref="videoRef"
          :src="currentStreamUrl"
          class="w-full h-full object-contain"
          @timeupdate="onTimeUpdate"
          @durationchange="onDurationChange"
          @progress="onProgress"
          @play="playerIsPlaying = true"
          @pause="playerIsPlaying = false"
          autoplay
        >
          Your browser does not support HTML5 video streaming.
        </video>
      </div>

      <!-- Top Overlay Controls (Title + Close) -->
      <transition name="fade-slide">
        <div 
          v-if="showControls" 
          class="absolute top-0 inset-x-0 z-20 bg-black/60 p-6 flex items-center justify-between pointer-events-auto"
        >
          <div class="flex items-center gap-3">
            <button @click="closePlayer" class="btn btn-circle !bg-transparent !text-white !border-white/20 hover:!bg-white/10" aria-label="Close player">
              <Icon name="mdi:arrow-left" class="w-5 h-5" />
            </button>
            <div class="text-left">
              <h2 class="text-sm font-medium text-white tracking-tight">{{ playingMedia.title }}</h2>
              <p v-if="playingMedia.subTitle" class="text-[11px] text-white/70 uppercase tracking-micro font-mono mt-0.5">{{ playingMedia.subTitle }}</p>
            </div>
          </div>

          <!-- Streaming Mode indicator & toggler -->
          <div class="flex items-center gap-4">
            <button 
              @click="toggleCompatibility"
              class="btn btn-xs flex items-center gap-1.5"
              :class="playCompatibility ? '!border-warning !text-warning !bg-transparent' : '!bg-transparent !text-white/80 !border-white/20 hover:!bg-white/10'"
            >
              <Icon name="mdi:auto-fix" class="w-3.5 h-3.5" />
              {{ playCompatibility ? 'COMPATIBILITY TRANSCODE ACTIVE' : 'DIRECT STREAM (NATIVE)' }}
            </button>

            <!-- Keyboard shortcut hint -->
            <div class="tooltip tooltip-bottom text-[11px]" data-tip="Keys: Space (Play), Arrows (Seek/Volume), F (Fullscreen), Esc (Close)">
              <Icon name="mdi:keyboard" class="w-5 h-5 text-white/70 hover:text-white cursor-pointer" />
            </div>
          </div>
        </div>
      </transition>

      <!-- Bottom Control Bar -->
      <transition name="fade-slide">
        <div 
          v-if="showControls" 
          class="absolute bottom-0 inset-x-0 z-20 bg-black/60 p-6 pt-12 space-y-4 pointer-events-auto"
        >
          
          <!-- Timeline scrubber bar -->
          <div class="flex items-center gap-4">
            <span class="text-[11px] font-medium font-mono text-white">{{ formatTime(playerCurrentTime) }}</span>
            
            <div 
              class="relative flex-1 h-1.5 bg-white/15 rounded-full cursor-pointer group/timeline overflow-hidden"
              @click="seek"
            >
              <!-- Buffered Bar -->
              <div 
                class="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full" 
                :style="{ width: playerBuffered + '%' }"
              ></div>
              <!-- Current Playback Position Bar -->
              <div 
                class="absolute left-0 top-0 bottom-0 bg-white rounded-full"
                :style="{ width: (playerCurrentTime / (playerDuration || 1)) * 100 + '%' }"
              ></div>
            </div>
            
            <span class="text-[11px] font-medium font-mono text-white">{{ formatTime(playerDuration) }}</span>
          </div>

          <!-- Bottom controls buttons -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <!-- Rewind 10s -->
              <button @click="skipTime(-10)" class="text-white hover:text-white" title="Rewind 10s">
                <Icon name="mdi:replay-10" class="w-6 h-6" />
              </button>

              <!-- Play / Pause -->
              <button @click="togglePlay" class="w-12 h-12 flex items-center justify-center bg-white text-black rounded-full transition-opacity hover:opacity-85" title="Play / Pause">
                <Icon :name="playerIsPlaying ? 'mdi:pause' : 'mdi:play'" class="w-6 h-6" :class="{ 'pl-0.5': !playerIsPlaying }" />
              </button>

              <!-- Skip 10s -->
              <button @click="skipTime(10)" class="text-white hover:text-white" title="Forward 10s">
                <Icon name="mdi:forward-10" class="w-6 h-6" />
              </button>

              <!-- Volume Control -->
              <div class="flex items-center gap-2 group/volume ml-4">
                <button @click="toggleMute" class="text-white hover:text-white">
                  <Icon :name="playerMuted ? 'mdi:volume-off' : playerVolume > 0.5 ? 'mdi:volume-high' : 'mdi:volume-medium'" class="w-5 h-5" />
                </button>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  :value="playerMuted ? 0 : playerVolume" 
                  @input="changeVolume"
                  class="range range-xs w-16 h-1 opacity-0 group-hover/volume:opacity-100 focus:opacity-100 transition-opacity duration-200 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            <!-- Right Controls: Speed and Screen -->
            <div class="flex items-center gap-4">
              <!-- Playback Rate selection -->
              <div class="dropdown dropdown-top dropdown-end">
                <label tabindex="0" class="btn btn-xs !bg-transparent !text-white !border-white/20 hover:!bg-white/10">
                  SPEED: {{ playerPlaybackRate }}x
                </label>
                <ul tabindex="0" class="dropdown-content menu p-1 bg-black border border-white/15 rounded-lg w-24 text-[13px] text-left text-white">
                  <li><a @click="setPlaybackRate(0.5)">0.5x</a></li>
                  <li><a @click="setPlaybackRate(1)">Normal</a></li>
                  <li><a @click="setPlaybackRate(1.25)">1.25x</a></li>
                  <li><a @click="setPlaybackRate(1.5)">1.5x</a></li>
                  <li><a @click="setPlaybackRate(2)">2.0x</a></li>
                </ul>
              </div>

              <!-- Fullscreen -->
              <button @click="toggleFullscreen" class="text-white hover:text-white" title="Toggle Fullscreen">
                <Icon name="mdi:fullscreen" class="w-6 h-6" />
              </button>
            </div>

          </div>

        </div>
      </transition>

    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--line-strong);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--line-strong);
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Animations for Player Controls */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 120ms ease-out;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
}
</style>
