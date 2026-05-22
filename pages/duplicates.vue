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
    <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/5">
      <div class="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            <div>
              <h1 class="text-xl font-black tracking-tight flex items-center gap-2">
                <Icon name="mdi:content-copy" class="text-primary w-6 h-6" />
                Duplicate Scanner
              </h1>
              <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">Identify & Remove Redundant Data</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
             <button 
               class="btn btn-primary h-12 rounded-xl px-6 shadow-lg shadow-primary/20 gap-2" 
               @click="fetchDuplicates"
               :disabled="isLoading"
             >
               <Icon v-if="!isLoading" name="mdi:magnify-scan" class="w-5 h-5" />
               <span v-else class="loading loading-spinner loading-sm"></span>
               Scan Storage
             </button>
          </div>
        </div>
      </div>
    </header>

    <main class="w-full max-w-[1400px] mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      
      <!-- Stats Summary -->
      <div v-if="duplicateGroups.length > 0" class="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
        <div class="bg-base-100 p-6 rounded-[2rem] border border-base-content/5 shadow-xl shadow-base-content/5 flex flex-col gap-1">
          <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Total Redundancy</span>
          <span class="text-2xl font-black tracking-tight text-error">{{ formatSize(totalRedundantSize) }}</span>
        </div>
        <div class="bg-base-100 p-6 rounded-[2rem] border border-base-content/5 shadow-xl shadow-base-content/5 flex flex-col gap-1">
          <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Selected for Deletion</span>
          <span class="text-2xl font-black tracking-tight text-primary">{{ formatSize(selectedSizeToReclaim) }}</span>
        </div>
        <div class="bg-base-100 p-6 rounded-[2rem] border border-base-content/5 shadow-xl shadow-base-content/5 flex flex-col gap-1">
          <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Resolution Count</span>
          <span class="text-2xl font-black tracking-tight">{{ totalSelectedCount }} <span class="text-xs text-base-content/30">files</span></span>
        </div>
      </div>

      <!-- Action Bar -->
      <div v-if="duplicateGroups.length > 0" class="flex flex-wrap items-center justify-between gap-4 p-4 bg-base-100 rounded-2xl border border-base-content/5 shadow-sm">
        <div class="flex items-center gap-2">
          <button class="btn btn-ghost btn-sm text-[10px] font-black uppercase tracking-widest rounded-lg border border-base-content/10" @click="selectAllButNewest">Keep Newest</button>
          <button class="btn btn-ghost btn-sm text-[10px] font-black uppercase tracking-widest rounded-lg border border-base-content/10" @click="selectAllButOldest">Keep Oldest</button>
          <button class="btn btn-ghost btn-sm text-[10px] font-black uppercase tracking-widest rounded-lg" @click="clearSelections">Clear</button>
        </div>
        <button 
          class="btn btn-error h-12 rounded-xl px-8 shadow-lg shadow-error/20 gap-2"
          @click="cleanSelected"
          :disabled="isDeleting || totalSelectedCount === 0"
        >
          <Icon v-if="!isDeleting" name="mdi:delete-sweep" class="w-5 h-5" />
          <span v-else class="loading loading-spinner loading-sm"></span>
          Clean Selected
        </button>
      </div>

      <!-- Duplicate Groups -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-32 gap-6">
         <div class="relative">
           <div class="w-24 h-24 rounded-full border-4 border-primary/10 border-t-primary animate-spin"></div>
           <Icon name="mdi:magnify" class="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" />
         </div>
         <div class="text-center">
            <h3 class="text-lg font-black tracking-tight">Analyzing Storage...</h3>
            <p class="text-xs font-bold text-base-content/40 uppercase tracking-widest mt-1">Comparing files by size and signature</p>
         </div>
      </div>

      <div v-else-if="duplicateGroups.length > 0" class="space-y-6">
        <div v-for="(group, idx) in duplicateGroups" :key="idx" class="bg-base-100 rounded-[2.5rem] shadow-xl shadow-base-content/5 border border-base-content/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500" :style="{ animationDelay: `${idx * 50}ms` }">
           <div class="p-6 bg-base-200/30 border-b border-base-content/5 flex items-center justify-between">
              <div class="flex items-center gap-4">
                 <div class="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center">
                    <Icon name="mdi:content-copy" class="w-5 h-5 text-error" />
                 </div>
                 <div>
                    <h3 class="text-sm font-black tracking-tight">Duplicate Group #{{ idx + 1 }}</h3>
                    <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">{{ group.files.length }} redundant copies found</p>
                 </div>
              </div>
              <div class="text-right">
                 <p class="text-[10px] font-black uppercase tracking-widest text-base-content/30 mb-1">Redundant Size</p>
                 <p class="text-lg font-black tracking-tighter text-error">{{ formatSize(group.redundantSize) }}</p>
              </div>
           </div>

           <div class="divide-y divide-base-content/5">
              <div 
                v-for="file in group.files" 
                :key="file.fullPath"
                class="flex items-center gap-4 p-4 hover:bg-base-200/50 transition-all group/row"
                :class="{ 'bg-error/5': file.selectedForDeletion }"
              >
                <div class="form-control">
                  <input 
                    type="checkbox" 
                    v-model="file.selectedForDeletion" 
                    class="checkbox checkbox-primary checkbox-sm rounded-lg"
                    title="Mark for deletion"
                  />
                </div>

                <!-- Media Preview -->
                <div class="relative w-16 h-16 rounded-lg bg-base-300 overflow-hidden shrink-0 group/preview"
                     @mouseenter="hoveredFile = file.fullPath"
                     @mouseleave="hoveredFile = null">
                  <img v-if="isImage(file.name) || isVideo(file.name)"
                       :src="getThumbnailUrl(file.fullPath)"
                       class="w-full h-full object-cover"
                       alt="" />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <Icon name="mdi:file-outline" class="w-6 h-6 text-base-content/20" />
                  </div>
                  
                  <!-- Animated Preview for Videos -->
                  <div v-if="isVideo(file.name) && hoveredFile === file.fullPath"
                       class="absolute inset-0 z-10 animate-in fade-in duration-300">
                    <img :src="getPreviewUrl(file.fullPath)" 
                         class="w-full h-full object-cover"
                         alt="Preview" />
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="text-xs font-bold truncate">{{ file.name }}</p>
                    <span v-if="!file.selectedForDeletion" class="badge badge-success badge-outline text-[8px] font-black uppercase py-2">KEEP</span>
                    <span v-else class="badge badge-error badge-outline text-[8px] font-black uppercase py-2">DELETE</span>
                  </div>
                  <p class="text-[10px] font-medium text-base-content/40 truncate mt-0.5">{{ file.fullPath }}</p>
                </div>

                <div class="flex items-center gap-8 text-right shrink-0">
                  <div class="flex flex-col gap-0.5">
                    <span class="text-[9px] font-black uppercase tracking-widest text-base-content/30">Modified</span>
                    <span class="text-[11px] font-bold">{{ formatDate(file.lastModified) }}</span>
                  </div>
                  <div class="flex flex-col gap-0.5 w-20">
                    <span class="text-[9px] font-black uppercase tracking-widest text-base-content/30">Size</span>
                    <span class="text-[11px] font-bold">{{ formatSize(file.size) }}</span>
                  </div>
                </div>
              </div>
           </div>
        </div>
      </div>

      <div v-else-if="!isLoading" class="flex flex-col items-center justify-center py-40 text-center gap-6">
        <div class="w-32 h-32 rounded-full bg-base-100 flex items-center justify-center shadow-2xl shadow-base-content/5">
           <Icon name="mdi:content-copy" class="w-16 h-16 text-base-content/10" />
        </div>
        <div>
           <h3 class="text-2xl font-black tracking-tight">Storage Analysis Ready</h3>
           <p class="text-sm font-medium text-base-content/40 max-w-xs mt-2 mx-auto">Click "Scan Storage" to find and remove identical files across your library.</p>
        </div>
        <button class="btn btn-primary btn-wide h-14 rounded-2xl shadow-xl shadow-primary/20 gap-3" @click="fetchDuplicates">
           <Icon name="mdi:magnify-scan" class="w-5 h-5" />
           <span class="font-black uppercase tracking-widest text-xs">Begin Full Analysis</span>
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
