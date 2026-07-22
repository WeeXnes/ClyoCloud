<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getIconForExtension } from '~/core/fileIcons'
import type { File } from '~/types/File'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'

useHead({
  title: 'Wallpapers'
})

const files = ref<File[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const isGridView = ref(true)
const sortOption = ref<'name' | 'size' | 'date'>('name')
const hoveredFile = ref<string | null>(null)

const fetchWallpapers = async () => {
  isLoading.value = true
  try {
    const data = await $fetch<File[]>('/api/wallpapers')
    files.value = data
  } catch (err) {
    console.error('Failed to fetch wallpapers:', err)
    createNotification('Failed to load wallpapers', NotificationType.ERROR)
  } finally {
    isLoading.value = false
  }
}

const formatSize = (bytes: number) => {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

const isImageFile = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif'].includes(ext)
}

const getThumbnailUrl = (fullPath: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  const segments = fullPath.split('/')
  const encodedPath = segments.map(segment => encodeURIComponent(segment)).join('/')
  return `${baseUrl}/thumbnail/${encodedPath}`
}

const sortedFiles = computed(() => {
  let filtered = [...files.value]

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(file => file.name.toLowerCase().includes(query))
  }

  return filtered.sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
    if (sortOption.value === 'size') return b.size - a.size
    if (sortOption.value === 'date') return b.lastModified - a.lastModified
    return a.name.localeCompare(b.name)
  })
})

const openFile = (file: File) => {
  goToParentFolder(file)
}

const goToParentFolder = (file: File) => {
  const path = file.name
  const segments = path.split('/')
  const parentPath = segments.slice(0, -1).map(encodeURIComponent).join('/')
  navigateTo(`/files/${parentPath}`)
}

const removeWallpaper = async (file: File) => {
  try {
    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullPath: file.name, isWallpaper: false }),
    })
    
    if (!response.ok) throw new Error('Failed to remove wallpaper status')
    
    files.value = files.value.filter(f => f.name !== file.name)
    createNotification('Removed from exported wallpapers', NotificationType.INFO)
  } catch (err) {
    console.error(err)
    createNotification('Failed to remove from wallpapers', NotificationType.ERROR)
  }
}

onMounted(fetchWallpapers)
</script>

<template>
  <div class="min-h-screen bg-base-200/50">
    <!-- Header -->
    <header class="sticky top-0 z-[40] w-full bg-base-100/70 backdrop-blur-md border-b border-base-content/5">
      <div class="w-full px-4 sm:px-6 py-3 sm:py-4">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          
          <!-- Title -->
          <div class="flex items-center gap-3">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden hover:bg-base-content/10">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shrink-0">
                <Icon name="mdi:wallpaper" class="text-purple-500 w-5 h-5" />
              </div>
              <div>
                <h1 class="text-base font-extrabold tracking-tight">Exported Wallpapers</h1>
                <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest leading-none mt-0.5">Manage your cloud wallpapers</p>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
             <!-- Search Input -->
             <div class="relative flex-1 md:w-[240px]">
                <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Icon name="mdi:magnify" class="w-4 h-4 text-base-content/30" />
                </div>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search wallpapers..."
                  class="input input-xs md:input-sm input-bordered w-full pl-9 bg-base-100/50 focus:bg-base-100 transition-all border-base-content/10 font-bold text-xs h-8 md:h-10"
                />
             </div>

             <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
               <!-- Sort Dropdown -->
               <div class="dropdown dropdown-end">
                 <button tabindex="0" class="btn btn-xs md:btn-sm btn-ghost gap-1.5 border border-base-content/10 bg-base-100/50 font-bold text-[10px] uppercase tracking-widest">
                    <Icon name="mdi:sort-variant" class="w-4 h-4" />
                    <span class="hidden sm:inline">Sort</span>
                 </button>
                 <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow-lg bg-base-100 rounded-lg w-40 border border-base-content/10 mt-2 font-bold text-[10px] uppercase tracking-widest">
                   <li><a @click="sortOption = 'name'" :class="{ 'active': sortOption === 'name' }">Name</a></li>
                   <li><a @click="sortOption = 'size'" :class="{ 'active': sortOption === 'size' }">Size</a></li>
                   <li><a @click="sortOption = 'date'" :class="{ 'active': sortOption === 'date' }">Date</a></li>
                 </ul>
               </div>

               <div class="h-6 w-px bg-base-content/10 mx-0.5 sm:mx-1"></div>

               <!-- View Switcher -->
               <div class="flex bg-base-200/50 p-1 rounded-lg border border-base-content/10">
                 <button 
                  class="btn btn-xs btn-ghost rounded-md px-1.5" 
                  :class="{ 'bg-base-100 shadow-sm text-purple-500': !isGridView }"
                  @click="isGridView = false"
                  title="List View"
                 >
                   <Icon name="mdi:view-list" class="w-4 h-4" />
                 </button>
                 <button 
                  class="btn btn-xs btn-ghost rounded-md px-1.5" 
                  :class="{ 'bg-base-100 shadow-sm text-purple-500': isGridView }"
                  @click="isGridView = true"
                  title="Grid View"
                 >
                   <Icon name="mdi:view-grid" class="w-4 h-4" />
                 </button>
               </div>
             </div>
          </div>

        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-8 min-h-[70vh]">
      <!-- Loading Skeleton -->
      <div v-if="isLoading" :class="isGridView ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6' : 'space-y-3'">
        <div v-for="i in 12" :key="i" class="flex flex-col gap-3">
          <div :class="isGridView ? 'aspect-square rounded-lg bg-base-300 animate-pulse' : 'h-14 rounded-lg bg-base-300 animate-pulse'"></div>
          <div v-if="isGridView" class="h-3.5 w-3/4 bg-base-300 animate-pulse rounded mx-auto"></div>
        </div>
      </div>

      <!-- Wallpaper File Display -->
      <div 
        v-else-if="sortedFiles.length"
        :class="isGridView ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6' : 'flex flex-col gap-2.5'"
      >
        <div 
          v-for="file in sortedFiles" 
          :key="file.name" 
          class="group relative file-item-container"
        >
          <!-- Grid View Card -->
          <div v-if="isGridView" class="flex flex-col gap-2 transition-all duration-300">
            <div 
              class="relative aspect-square rounded-lg bg-base-100 border border-base-content/10 shadow-sm hover:border-purple-500/40 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden flex items-center justify-center group/item"
              @click="openFile(file)"
              @mouseenter="hoveredFile = file.name"
              @mouseleave="hoveredFile = null"
            >
              <!-- Action Badge: Remove Wallpaper with X Symbol (Top Right) -->
              <div class="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
                <button 
                  class="bg-base-100/90 text-error hover:bg-error hover:text-white w-7 h-7 flex items-center justify-center rounded-md shadow-md backdrop-blur-md hover:scale-110 transition-all"
                  title="Remove from Wallpapers"
                  @click.stop="removeWallpaper(file)"
                >
                  <Icon name="mdi:close" class="w-4 h-4" />
                </button>
              </div>

              <!-- Open Folder Button (Top Left) -->
              <div class="absolute top-2 left-2 z-10 flex flex-col gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                <button 
                  class="bg-base-100/90 text-base-content/70 hover:text-primary w-7 h-7 flex items-center justify-center rounded-md shadow-md backdrop-blur-md hover:scale-110 transition-all"
                  title="Go to folder"
                  @click.stop="goToParentFolder(file)"
                >
                  <Icon name="mdi:folder-open-outline" class="w-4 h-4" />
                </button>
              </div>

              <!-- Thumbnail Media -->
              <template v-if="isImageFile(file.name)">
                <img 
                  :src="getThumbnailUrl(file.name)" 
                  class="w-full h-full object-cover transition-transform duration-500 group-hover/item:scale-105"
                  alt="" 
                  loading="lazy" 
                />
              </template>
              <template v-else-if="file.isFolder">
                <Icon name="vscode-icons:default-folder" class="w-12 h-12 group-hover/item:scale-105 transition-transform duration-300" />
              </template>
              <template v-else>
                <Icon :name="getIconForExtension(file.name)" class="w-12 h-12 text-purple-500 group-hover/item:scale-105 transition-transform duration-300" />
              </template>

              <!-- Hover Overlay -->
              <div class="absolute inset-0 bg-black/10 opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none"></div>
            </div>

            <!-- Grid Metadata -->
            <div class="px-1 text-center h-[40px] flex flex-col justify-center">
              <h3 class="text-[11px] font-bold truncate block group-hover:text-purple-500 transition-colors leading-tight text-base-content">
                {{ file.name.split('/').pop() }}
              </h3>
              <div class="text-[9px] font-bold text-base-content/40 uppercase tracking-wider mt-0.5">
                <span v-if="!file.isFolder">{{ formatSize(file.size) }}</span>
                <span v-else>Folder</span>
              </div>
            </div>
          </div>

          <!-- List View Row -->
          <div 
            v-else 
            class="flex items-center gap-4 p-3 bg-base-100 rounded-lg border border-base-content/10 hover:border-purple-500/30 hover:bg-base-200/50 transition-all cursor-pointer group/row"
            @click="openFile(file)"
          >
            <div class="flex items-center justify-center shrink-0 w-10 h-10 rounded-md overflow-hidden bg-base-200 border border-base-content/5">
              <img v-if="isImageFile(file.name)" :src="getThumbnailUrl(file.name)" class="w-full h-full object-cover" alt="" />
              <Icon v-else class="w-6 h-6 text-purple-500" :name="file.isFolder ? 'vscode-icons:default-folder' : getIconForExtension(file.name)" />
            </div>

            <div class="flex-grow min-w-0">
              <h3 class="text-xs font-bold truncate group-hover/row:text-purple-500 transition-colors text-base-content">{{ file.name.split('/').pop() }}</h3>
              <p class="text-[9px] font-bold text-base-content/30 truncate mt-0.5">{{ file.name }}</p>
            </div>

            <div class="flex items-center gap-6 text-[9px] font-bold text-base-content/40 uppercase tracking-widest shrink-0">
              <span class="w-20 text-right">{{ file.isFolder ? 'Folder' : formatSize(file.size) }}</span>
              <span class="hidden md:inline w-24 text-right">{{ new Date(file.lastModified).toLocaleDateString() }}</span>
              
              <div class="flex items-center gap-1">
                <button 
                  class="btn btn-ghost btn-xs btn-circle text-base-content/60 hover:text-primary"
                  title="Go to folder"
                  @click.stop="goToParentFolder(file)"
                >
                  <Icon name="mdi:folder-open-outline" class="w-4 h-4" />
                </button>
                <button 
                  class="btn btn-ghost btn-xs btn-circle text-error hover:bg-error/10"
                  title="Remove from Wallpapers"
                  @click.stop="removeWallpaper(file)"
                >
                  <Icon name="mdi:close" class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="flex flex-col items-center justify-center py-24 text-center">
        <div class="bg-base-200/50 p-6 rounded-xl mb-6">
          <Icon name="mdi:wallpaper" class="w-16 h-16 text-base-content/10" />
        </div>
        <h3 class="text-xl font-bold tracking-tight text-base-content">No exported wallpapers</h3>
        <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">
          Files you mark as wallpapers will appear here in your grid collection for easy management.
        </p>
        <NuxtLink to="/files" class="btn btn-primary btn-sm mt-8 px-8 rounded-lg shadow-sm font-bold uppercase tracking-widest text-[10px]">
          Go to Files
        </NuxtLink>
      </div>
    </main>
  </div>
</template>
