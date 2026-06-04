<script setup lang="ts">
import { ref, computed } from 'vue'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'

interface DuplicateFile {
  name: string
  fullPath: string
  size: number
  lastModified: number
  selectedForDeletion?: boolean
}

interface DuplicateGroup {
  size: number
  files: DuplicateFile[]
  redundantSize: number
}

const duplicateGroups = ref<DuplicateGroup[]>([])
const isLoading = ref(false)
const isDeleting = ref(false)
const hoveredFile = ref<string | null>(null)

const isVideo = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['mp4', 'webm', 'mov', 'mkv'].includes(ext)
}

const isImage = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
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

async function fetchDuplicates() {
  isLoading.value = true
  try {
    const data: any = await $fetch('/api/storage-duplicates')
    duplicateGroups.value = data.map((group: any) => ({
      ...group,
      files: group.files.map((file: any) => ({ ...file, selectedForDeletion: false }))
    }))
    if (duplicateGroups.value.length === 0) {
      createNotification('No duplicate files found!', NotificationType.SUCCESS)
    }
  } catch (err) {
    console.error('Duplicate scan error:', err)
    createNotification('Failed to scan for duplicates', NotificationType.ERROR)
  } finally {
    isLoading.value = false
  }
}

const formatSize = (bytes: number) => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}

const totalRedundantSize = computed(() => {
  return duplicateGroups.value.reduce((acc, group) => acc + group.redundantSize, 0)
})

const selectedSizeToReclaim = computed(() => {
  let total = 0
  duplicateGroups.value.forEach(group => {
    group.files.forEach(file => {
      if (file.selectedForDeletion) {
        total += file.size
      }
    })
  })
  return total
})

const totalSelectedCount = computed(() => {
  let count = 0
  duplicateGroups.value.forEach(group => {
    group.files.forEach(file => {
      if (file.selectedForDeletion) count++
    })
  })
  return count
})

function selectAllButNewest() {
  duplicateGroups.value.forEach(group => {
    const newest = [...group.files].sort((a, b) => b.lastModified - a.lastModified)[0]
    group.files.forEach(file => {
      file.selectedForDeletion = file !== newest
    })
  })
}

function selectAllButOldest() {
  duplicateGroups.value.forEach(group => {
    const oldest = [...group.files].sort((a, b) => a.lastModified - b.lastModified)[0]
    group.files.forEach(file => {
      file.selectedForDeletion = file !== oldest
    })
  })
}

function clearSelections() {
  duplicateGroups.value.forEach(group => {
    group.files.forEach(file => {
      file.selectedForDeletion = false
    })
  })
}

async function cleanSelected() {
  const filesToDelete = []
  duplicateGroups.value.forEach(group => {
    group.files.forEach(file => {
      if (file.selectedForDeletion) {
        filesToDelete.push(file)
      }
    })
  })

  if (filesToDelete.length === 0) return
  if (!confirm(`Are you sure you want to delete ${filesToDelete.length} files? This will reclaim ${formatSize(selectedSizeToReclaim.value)}.`)) return

  isDeleting.value = true
  let successCount = 0
  
  try {
    for (const file of filesToDelete) {
      try {
        await $fetch('/api/files', {
          method: 'DELETE',
          body: { path: file.fullPath }
        })
        successCount++
      } catch (err) {
        console.error(`Failed to delete ${file.fullPath}:`, err)
      }
    }
    
    createNotification(`Successfully deleted ${successCount} files.`, NotificationType.SUCCESS)
    await fetchDuplicates()
  } catch (err) {
    createNotification('An error occurred during cleanup', NotificationType.ERROR)
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-200/50 flex flex-col font-sans">
    <header class="sticky top-0 z-[40] w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/10">
      <div class="w-full px-4 py-3 md:py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div class="flex flex-col gap-0.5 md:gap-1 min-w-0">
            <div class="flex items-center gap-2">
              <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-xs md:btn-sm lg:hidden">
                <Icon name="mdi:menu" class="w-5 h-5" />
              </label>
              <h1 class="text-base md:text-lg font-bold tracking-tight flex items-center gap-2 text-base-content">
                <Icon name="mdi:content-copy" class="text-primary w-5 h-5" />
                Duplicate Scanner
              </h1>
            </div>
            <p class="text-[9px] md:text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">Identify & Remove Redundant Data</p>
          </div>

          <div class="flex flex-wrap items-center gap-2 md:gap-3">
             <button 
               class="btn btn-xs md:btn-sm btn-primary h-8 md:h-10 rounded-lg px-4 md:px-6 shadow-sm gap-2 font-bold text-[9px] md:text-[10px] uppercase tracking-widest" 
               @click="fetchDuplicates"
               :disabled="isLoading"
             >
               <Icon v-if="!isLoading" name="mdi:magnify-scan" class="w-4 h-4" />
               <span v-else class="loading loading-spinner loading-xs"></span>
               Scan Storage
             </button>
          </div>
        </div>
      </div>
    </header>

    <main class="w-full max-w-[1400px] mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      
      <!-- Stats Summary -->
      <div v-if="duplicateGroups.length > 0" class="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
        <div class="bg-base-100 p-6 rounded-xl border border-base-content/10 shadow-sm flex flex-col gap-1">
          <span class="text-[9px] font-bold uppercase tracking-widest text-base-content/30">Total Redundancy</span>
          <span class="text-xl font-bold tracking-tight text-error">{{ formatSize(totalRedundantSize) }}</span>
        </div>
        <div class="bg-base-100 p-6 rounded-xl border border-base-content/10 shadow-sm flex flex-col gap-1">
          <span class="text-[9px] font-bold uppercase tracking-widest text-base-content/30">Selected to Reclaim</span>
          <span class="text-xl font-bold tracking-tight text-primary">{{ formatSize(selectedSizeToReclaim) }}</span>
        </div>
        <div class="bg-base-100 p-6 rounded-xl border border-base-content/10 shadow-sm flex flex-col gap-1">
          <span class="text-[9px] font-bold uppercase tracking-widest text-base-content/30">Resolution Count</span>
          <span class="text-xl font-bold tracking-tight text-base-content">{{ totalSelectedCount }} <span class="text-[10px] text-base-content/30 uppercase tracking-widest">files</span></span>
        </div>
      </div>

      <!-- Action Bar -->
      <div v-if="duplicateGroups.length > 0" class="flex flex-wrap items-center justify-between gap-4 p-4 bg-base-100 rounded-xl border border-base-content/10 shadow-sm">
        <div class="flex items-center gap-2">
          <button class="btn btn-ghost btn-xs text-[9px] font-bold uppercase tracking-widest rounded-md border border-base-content/10 h-8 px-3" @click="selectAllButNewest">Keep Newest</button>
          <button class="btn btn-ghost btn-xs text-[9px] font-bold uppercase tracking-widest rounded-md border border-base-content/10 h-8 px-3" @click="selectAllButOldest">Keep Oldest</button>
          <button class="btn btn-ghost btn-xs text-[9px] font-bold uppercase tracking-widest rounded-md h-8 px-3" @click="clearSelections">Clear</button>
        </div>
        <button 
          class="btn btn-error btn-sm h-10 rounded-lg px-8 shadow-sm gap-2 font-bold text-[10px] uppercase tracking-widest"
          @click="cleanSelected"
          :disabled="isDeleting || totalSelectedCount === 0"
        >
          <Icon v-if="!isDeleting" name="mdi:delete-sweep" class="w-4 h-4" />
          <span v-else class="loading loading-spinner loading-xs"></span>
          Clean Selected
        </button>
      </div>

      <!-- Duplicate Groups -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-32 gap-6">
         <div class="relative">
           <div class="w-16 h-16 rounded-full border-2 border-primary/10 border-t-primary animate-spin"></div>
           <Icon name="mdi:magnify" class="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" />
         </div>
         <div class="text-center">
            <h3 class="text-base font-bold tracking-tight text-base-content">Analyzing Storage...</h3>
            <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest mt-1">Comparing byte signatures across cluster</p>
         </div>
      </div>

      <div v-else-if="duplicateGroups.length > 0" class="space-y-6">
        <div v-for="(group, idx) in duplicateGroups" :key="idx" class="bg-base-100 rounded-xl shadow-sm border border-base-content/10 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300" :style="{ animationDelay: `${idx * 50}ms` }">
           <div class="p-5 bg-base-200/30 border-b border-base-content/10 flex items-center justify-between">
              <div class="flex items-center gap-3">
                 <div class="w-9 h-9 rounded-lg bg-error/10 flex items-center justify-center border border-error/10">
                    <Icon name="mdi:content-copy" class="w-4 h-4 text-error" />
                 </div>
                 <div>
                    <h3 class="text-xs font-bold uppercase tracking-tight text-base-content">Duplicate Cluster #{{ idx + 1 }}</h3>
                    <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">{{ group.files.length }} redundant copies identified</p>
                 </div>
              </div>
              <div class="text-right">
                 <p class="text-[9px] font-bold uppercase tracking-widest text-base-content/30 mb-0.5">Wasted Space</p>
                 <p class="text-base font-bold tracking-tight text-error">{{ formatSize(group.redundantSize) }}</p>
              </div>
           </div>

           <div class="divide-y divide-base-content/5">
              <div 
                v-for="file in group.files" 
                :key="file.fullPath"
                class="flex items-center gap-4 p-4 hover:bg-base-200/50 transition-all group/row h-[72px]"
                :class="{ 'bg-error/5': file.selectedForDeletion }"
              >
                <div class="flex items-center justify-center shrink-0">
                  <input 
                    type="checkbox" 
                    v-model="file.selectedForDeletion" 
                    class="checkbox checkbox-primary checkbox-xs rounded-sm"
                    title="Mark for deletion"
                  />
                </div>

                <!-- Media Preview -->
                <div class="relative w-11 h-11 rounded-md bg-base-300 overflow-hidden shrink-0 group/preview"
                     @mouseenter="hoveredFile = file.fullPath"
                     @mouseleave="hoveredFile = null">
                  <img v-if="isImage(file.name) || isVideo(file.name)"
                       :src="getThumbnailUrl(file.fullPath)"
                       class="w-full h-full object-cover"
                       alt="" />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <Icon name="mdi:file-outline" class="w-5 h-5 text-base-content/20" />
                  </div>
                  
                  <!-- Animated Preview for Videos -->
                  <div v-if="isVideo(file.name) && hoveredFile === file.fullPath"
                       class="absolute inset-0 z-10 animate-in fade-in duration-200">
                    <img :src="getPreviewUrl(file.fullPath)" 
                         class="w-full h-full object-cover"
                         alt="Preview" />
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="text-xs font-bold truncate text-base-content">{{ file.name }}</p>
                    <span v-if="!file.selectedForDeletion" class="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">KEEP</span>
                    <span v-else class="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-error/10 text-error border border-error/20">DELETE</span>
                  </div>
                  <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-wide truncate mt-0.5">{{ file.fullPath }}</p>
                </div>

                <div class="flex items-center gap-8 text-right shrink-0">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-[8px] font-bold uppercase tracking-widest text-base-content/30">Modified</span>
                    <span class="text-[10px] font-bold text-base-content/60">{{ formatDate(file.lastModified).split(',')[0] }}</span>
                  </div>
                  <div class="flex flex-col gap-0.5 w-16">
                    <span class="text-[8px] font-bold uppercase tracking-widest text-base-content/30">Size</span>
                    <span class="text-[10px] font-bold text-base-content">{{ formatSize(file.size) }}</span>
                  </div>
                </div>
              </div>
           </div>
        </div>
      </div>

      <div v-else-if="!isLoading" class="flex flex-col items-center justify-center py-32 text-center gap-6">
        <div class="w-24 h-24 rounded-xl bg-base-100 flex items-center justify-center shadow-sm border border-base-content/10">
           <Icon name="mdi:content-copy" class="w-12 h-12 text-base-content/10" />
        </div>
        <div>
           <h3 class="text-lg font-bold tracking-tight text-base-content">Duplicate Scanner</h3>
           <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest max-w-xs mt-2 mx-auto leading-relaxed">Scan your storage to identify and remove identical files.</p>
        </div>
        <button class="btn btn-primary btn-wide btn-sm h-11 rounded-lg shadow-sm font-bold uppercase tracking-widest text-[10px]" @click="fetchDuplicates">
           <Icon name="mdi:magnify-scan" class="w-4 h-4" />
           Scan Storage
        </button>
      </div>
    </main>
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
  background: rgba(0, 0, 0, 0.05);
  border-radius: 10px;
}
</style>

