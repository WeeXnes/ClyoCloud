<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'

useHead({
  title: 'Duplicates'
})
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'
import { startOperation, updateOperation, completeOperation, failOperation } from '~/core/progressManager'

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

const scanStatus = ref<any>(null)
let pollInterval: any = null

async function fetchDuplicates() {
  isLoading.value = true
  try {
    const data: any = await $fetch('/api/storage-duplicates')
    scanStatus.value = data
    
    if (data.isScanning) {
      startPolling()
    } else if (data.results) {
      handleResults(data.results)
    } else {
      isLoading.value = false
    }
  } catch (err) {
    console.error('Duplicate scan error:', err)
    createNotification('Failed to start scan', NotificationType.ERROR)
    isLoading.value = false
  }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval)
  const op = startOperation('duplicate-scan', 'Scanning Duplicates', 100)
  
  pollInterval = setInterval(async () => {
    try {
      const data: any = await $fetch('/api/storage-duplicates-status')
      scanStatus.value = data
      
      if (data.isScanning) {
        updateOperation('duplicate-scan', data.progress || 0)
      } else {
        clearInterval(pollInterval)
        pollInterval = null
        completeOperation('duplicate-scan')
        handleResults(data.results)
      }
    } catch (err) {
      console.error('Polling error:', err)
      clearInterval(pollInterval)
      pollInterval = null
      failOperation('duplicate-scan')
      isLoading.value = false
    }
  }, 1000)
}

function handleResults(results: any) {
  if (!results) {
    isLoading.value = false
    return
  }
  duplicateGroups.value = results.map((group: any) => ({
    ...group,
    files: group.files.map((file: any) => ({ ...file, selectedForDeletion: false }))
  }))
  if (duplicateGroups.value.length === 0) {
    createNotification('No duplicate files found!', NotificationType.SUCCESS)
  }
  isLoading.value = false
}

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

const isVideo = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['mp4', 'webm', 'mov', 'mkv'].includes(ext)
}

const isImage = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
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
  const op = startOperation('duplicate-clean', 'Cleaning Duplicates', filesToDelete.length)
  
  try {
    let current = 0
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
      current++
      updateOperation('duplicate-clean', current)
    }
    
    createNotification(`Successfully deleted ${successCount} files.`, NotificationType.SUCCESS)
    completeOperation('duplicate-clean')
    await fetchDuplicates()
  } catch (err) {
    createNotification('An error occurred during cleanup', NotificationType.ERROR)
    failOperation('duplicate-clean')
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-100 flex flex-col font-sans">
    <header class="page-bar">
      <div class="page-wrap py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden" aria-label="Open navigation">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            <div class="flex items-center gap-2">
              <div>
                <h1 class="text-[15px] font-medium tracking-section text-fg leading-tight">Duplicate Scanner</h1>
                <p class="hidden sm:block text-[13px] text-fg-3 leading-tight">Identify & Remove Redundant Data</p>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 md:gap-3">
             <button 
               class="btn btn-sm btn-primary gap-2" 
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

    <main class="w-full page-wrap py-10 space-y-8">
      
      <!-- Stats Summary -->
      <div v-if="duplicateGroups.length > 0" class="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line border-y border-line">
        <div class="bg-base-100 py-6 sm:pr-6 flex flex-col gap-2">
          <span class="num text-3xl font-medium tracking-title text-fg leading-none">{{ formatSize(totalRedundantSize) }}</span>
          <span class="micro">Redundant</span>
        </div>
        <div class="bg-base-100 py-6 sm:px-6 flex flex-col gap-2">
          <span class="num text-3xl font-medium tracking-title text-fg leading-none">{{ formatSize(selectedSizeToReclaim) }}</span>
          <span class="micro">Selected to reclaim</span>
        </div>
        <div class="bg-base-100 py-6 sm:px-6 flex flex-col gap-2">
          <span class="num text-3xl font-medium tracking-title text-fg leading-none">{{ totalSelectedCount }}</span>
          <span class="micro">Files selected</span>
        </div>
      </div>

      <!-- Action Bar -->
      <div v-if="duplicateGroups.length > 0" class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <button class="btn btn-sm" @click="selectAllButNewest">Keep newest</button>
          <button class="btn btn-sm" @click="selectAllButOldest">Keep oldest</button>
          <button class="btn btn-ghost btn-sm" @click="clearSelections">Clear</button>
        </div>
        <button 
          class="btn btn-error btn-sm gap-2"
          @click="cleanSelected"
          :disabled="isDeleting || totalSelectedCount === 0"
        >
          <Icon v-if="!isDeleting" name="mdi:delete-sweep" class="w-4 h-4" />
          <span v-else class="loading loading-spinner loading-xs"></span>
          Clean Selected
        </button>
      </div>

      <!-- Duplicate Groups -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 gap-8 max-w-md mx-auto">
         <span class="loading loading-spinner loading-md"></span>
         
         <div class="w-full space-y-4">
            <div class="text-center">
               <h3 class="section-title">
                 {{ scanStatus?.phase === 'indexing' ? 'Indexing Storage...' : 
                    scanStatus?.phase === 'hashing' ? 'Comparing Signatures...' : 
                    scanStatus?.phase === 'sorting' ? 'Finalizing Results...' : 'Analyzing...' }}
               </h3>
               <p class="num text-[13px] text-fg-3 mt-1">
                 {{ scanStatus?.phase === 'indexing' ? `Discovered ${scanStatus?.totalFiles || 0} files` : 
                    scanStatus?.phase === 'hashing' ? `Processed ${scanStatus?.processedFiles || 0} / ${scanStatus?.totalFiles || 0} candidates` : 
                    'Byte-by-byte verification in progress' }}
               </p>
            </div>

            <div v-if="scanStatus?.phase === 'hashing'" class="space-y-2">
              <div class="h-1 w-full bg-surface-2 rounded-full overflow-hidden">
                <div class="h-full bg-invert" :style="{ width: `${scanStatus?.progress || 0}%` }"></div>
              </div>
              <div class="flex justify-between items-center px-1">
                <span class="micro num">{{ scanStatus?.progress || 0 }}% complete</span>
                <span class="micro num">{{ scanStatus?.processedFiles || 0 }} files</span>
              </div>
            </div>
         </div>
      </div>

      <div v-else-if="duplicateGroups.length > 0" class="space-y-6">
        <div v-for="(group, idx) in duplicateGroups" :key="idx" class="bg-base-100 rounded-xl border border-line overflow-hidden">
           <div class="px-4 py-3 bg-base-200 border-b border-line flex items-center justify-between gap-4">
              <div>
                 <h3 class="text-[14px] text-fg">Group <span class="num">{{ idx + 1 }}</span></h3>
                 <p class="num text-[13px] text-fg-3">{{ group.files.length }} copies</p>
              </div>
              <div class="text-right">
                 <p class="num text-[14px] text-fg">{{ formatSize(group.redundantSize) }}</p>
                 <p class="micro">Wasted</p>
              </div>
           </div>

           <div class="divide-y divide-line">
              <div 
                v-for="file in group.files" 
                :key="file.fullPath"
                class="flex items-center gap-4 px-4 py-3 hover:bg-surface-2 transition-colors group/row min-h-[68px]"
                :class="{ 'bg-surface-2': file.selectedForDeletion }"
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
                <div class="relative w-11 h-11 rounded-md bg-surface-2 overflow-hidden shrink-0 group/preview"
                     @mouseenter="hoveredFile = file.fullPath"
                     @mouseleave="hoveredFile = null">
                  <img v-if="isImage(file.name) || isVideo(file.name)"
                       :src="getThumbnailUrl(file.fullPath)"
                       class="w-full h-full object-cover"
                       alt="" />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <Icon name="mdi:file-outline" class="w-5 h-5 text-fg-3" />
                  </div>
                  
                  <!-- Animated Preview for Videos -->
                  <div v-if="isVideo(file.name) && hoveredFile === file.fullPath"
                       class="absolute inset-0 z-10 duration-200">
                    <img :src="getPreviewUrl(file.fullPath)" 
                         class="w-full h-full object-cover"
                         alt="Preview" />
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="text-[14px] truncate text-fg">{{ file.name }}</p>
                    <span v-if="!file.selectedForDeletion" class="flex items-center gap-1.5 text-[12px] text-fg-2 shrink-0"><span class="dot text-success"></span>Keep</span>
                    <span v-else class="flex items-center gap-1.5 text-[12px] text-fg-2 shrink-0"><span class="dot text-error"></span>Delete</span>
                  </div>
                  <p class="text-[13px] text-fg-3 truncate mt-0.5">{{ file.fullPath }}</p>
                </div>

                <div class="hidden sm:flex items-center gap-8 text-right shrink-0">
                  <div class="flex flex-col gap-0.5">
                    <span class="micro">Modified</span>
                    <span class="num text-[13px] text-fg-2">{{ formatDate(file.lastModified).split(',')[0] }}</span>
                  </div>
                  <div class="flex flex-col gap-0.5 w-16">
                    <span class="micro">Size</span>
                    <span class="num text-[13px] text-fg">{{ formatSize(file.size) }}</span>
                  </div>
                </div>
              </div>
           </div>
        </div>
      </div>

      <div v-else-if="!isLoading" class="py-24 text-center">
        <p class="text-[15px] text-fg">No scan results yet.</p>
        <p class="text-[14px] text-fg-3 mt-1">Run a scan to find identical files in your storage.</p>
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
  background: var(--line-strong);
  border-radius: 10px;
}
</style>

