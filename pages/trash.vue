<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

useHead({
  title: 'Recycle Bin - ClyoCloud'
})

import { getIconForExtension } from '~/core/fileIcons'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'

interface TrashItem {
  id: string
  name: string
  originalPath: string
  trashedAt: number
  size: number
  isDirectory: boolean
  storedName: string
  hasCloudInfo: boolean
}

const trashItems = ref<TrashItem[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const selectedIds = ref<Set<string>>(new Set())

// Modals
const showEmptyConfirm = ref(false)
const showDeleteConfirm = ref(false)
const itemToDelete = ref<TrashItem | null>(null)
const isActionInProgress = ref(false)

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

const formatDate = (timestamp: number) => {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getDaysRemaining = (trashedAt: number) => {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
  const elapsed = Date.now() - trashedAt
  const remaining = Math.max(0, Math.ceil((thirtyDaysMs - elapsed) / (24 * 60 * 60 * 1000)))
  return remaining
}

async function fetchTrash() {
  isLoading.value = true
  try {
    const data: any = await $fetch('/api/trash')
    trashItems.value = data.items || []
    selectedIds.value.clear()
  } catch (err: any) {
    console.error('Error fetching trash:', err)
    createNotification(err.data?.statusMessage || 'Failed to load recycle bin', NotificationType.ERROR)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchTrash()
})

const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) return trashItems.value
  const query = searchQuery.value.toLowerCase().trim()
  return trashItems.value.filter(item =>
    item.name.toLowerCase().includes(query) ||
    item.originalPath.toLowerCase().includes(query)
  )
})

const totalTrashSize = computed(() => {
  return trashItems.value.reduce((acc, item) => acc + (item.size || 0), 0)
})

const isAllSelected = computed(() => {
  return filteredItems.value.length > 0 && filteredItems.value.every(item => selectedIds.value.has(item.id))
})

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedIds.value.clear()
  } else {
    filteredItems.value.forEach(item => selectedIds.value.add(item.id))
  }
}

function toggleSelectItem(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

// Single Restore
async function restoreItem(item: TrashItem) {
  isActionInProgress.value = true
  try {
    const res: any = await $fetch('/api/trash-restore', {
      method: 'POST',
      body: { id: item.id }
    })
    createNotification(`Restored: ${res.restoredPath || item.name}`, NotificationType.SUCCESS)
    trashItems.value = trashItems.value.filter(i => i.id !== item.id)
    selectedIds.value.delete(item.id)
  } catch (err: any) {
    createNotification(err.data?.statusMessage || 'Failed to restore item', NotificationType.ERROR)
  } finally {
    isActionInProgress.value = false
  }
}

// Bulk Restore
async function restoreSelected() {
  if (selectedIds.value.size === 0) return
  isActionInProgress.value = true
  const ids = Array.from(selectedIds.value)
  try {
    const res: any = await $fetch('/api/trash-restore', {
      method: 'POST',
      body: { ids }
    })
    createNotification(`Successfully restored ${res.count || ids.length} items`, NotificationType.SUCCESS)
    trashItems.value = trashItems.value.filter(i => !selectedIds.value.has(i.id))
    selectedIds.value.clear()
  } catch (err: any) {
    createNotification(err.data?.statusMessage || 'Failed to restore items', NotificationType.ERROR)
  } finally {
    isActionInProgress.value = false
  }
}

// Single Permanent Delete Prompt
function promptPermanentDelete(item: TrashItem) {
  itemToDelete.value = item
  showDeleteConfirm.value = true
}

// Confirm Delete (Single or Bulk)
async function confirmPermanentDelete() {
  isActionInProgress.value = true
  try {
    if (itemToDelete.value) {
      await $fetch('/api/trash', {
        method: 'DELETE',
        body: { id: itemToDelete.value.id }
      })
      createNotification(`Permanently deleted: ${itemToDelete.value.name}`, NotificationType.INFO)
      trashItems.value = trashItems.value.filter(i => i.id !== itemToDelete.value!.id)
      selectedIds.value.delete(itemToDelete.value.id)
      itemToDelete.value = null
    } else if (selectedIds.value.size > 0) {
      const ids = Array.from(selectedIds.value)
      await $fetch('/api/trash', {
        method: 'DELETE',
        body: { ids }
      })
      createNotification(`Permanently deleted ${ids.length} items`, NotificationType.INFO)
      trashItems.value = trashItems.value.filter(i => !selectedIds.value.has(i.id))
      selectedIds.value.clear()
    }
  } catch (err: any) {
    createNotification(err.data?.statusMessage || 'Failed to delete item', NotificationType.ERROR)
  } finally {
    showDeleteConfirm.value = false
    itemToDelete.value = null
    isActionInProgress.value = false
  }
}

// Empty Trash
async function confirmEmptyTrash() {
  isActionInProgress.value = true
  try {
    const res: any = await $fetch('/api/trash', {
      method: 'DELETE',
      body: { emptyAll: true }
    })
    createNotification(`Recycle bin emptied (${res.count || 0} items purged)`, NotificationType.SUCCESS)
    trashItems.value = []
    selectedIds.value.clear()
  } catch (err: any) {
    createNotification(err.data?.statusMessage || 'Failed to empty recycle bin', NotificationType.ERROR)
  } finally {
    showEmptyConfirm.value = false
    isActionInProgress.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-300/40 flex flex-col font-sans text-base-content/90">
    <!-- Header -->
    <header class="sticky top-0 z-30 w-full bg-base-100/70 backdrop-blur-md border-b border-base-content/5 px-6 py-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center text-error border border-error/20 shadow-sm">
            <Icon name="mdi:trash-can-outline" class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-base font-black tracking-tight">Recycle Bin</h1>
              <span class="badge badge-sm font-bold bg-base-200/80 border-base-content/10 text-[9px] uppercase tracking-wider">
                {{ trashItems.length }} {{ trashItems.length === 1 ? 'item' : 'items' }}
              </span>
              <span v-if="trashItems.length > 0" class="badge badge-sm font-bold bg-base-200/80 border-base-content/10 text-[9px] uppercase tracking-wider text-base-content/60">
                {{ formatSize(totalTrashSize) }}
              </span>
            </div>
            <p class="text-[10px] font-bold text-base-content/40 tracking-wider mt-0.5">
              Deleted items are preserved for 30 days before automatic permanent deletion
            </p>
          </div>
        </div>

        <!-- Header Actions -->
        <div class="flex items-center gap-2">
          <!-- Search -->
          <div class="relative w-full md:w-56">
            <Icon name="mdi:magnify" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Filter deleted files..." 
              class="input input-bordered input-sm w-full pl-9 bg-base-200/50 focus:bg-base-100 transition-all font-bold text-xs rounded-xl border-base-content/5"
            />
          </div>

          <!-- Refresh -->
          <button 
            @click="fetchTrash" 
            class="btn btn-ghost btn-sm btn-square rounded-xl border border-base-content/5" 
            :disabled="isLoading"
            title="Refresh"
          >
            <Icon name="mdi:refresh" :class="['w-4 h-4 text-base-content/60', { 'animate-spin': isLoading }]" />
          </button>

          <!-- Empty Trash Button -->
          <button 
            @click="showEmptyConfirm = true" 
            :disabled="trashItems.length === 0 || isLoading"
            class="btn btn-error btn-sm rounded-xl gap-1.5 font-bold text-[10px] uppercase tracking-widest text-white shadow-sm"
          >
            <Icon name="mdi:delete-sweep" class="w-4 h-4" />
            <span class="hidden sm:inline">Empty Bin</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 w-full max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-4">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 space-y-3">
        <span class="loading loading-spinner loading-md text-primary"></span>
        <p class="text-xs font-bold uppercase tracking-widest text-base-content/40">Loading deleted items...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="trashItems.length === 0" class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-16 h-16 rounded-2xl bg-base-200/60 border border-base-content/5 flex items-center justify-center text-base-content/20 mb-4 shadow-sm">
          <Icon name="mdi:trash-can-outline" class="w-8 h-8" />
        </div>
        <h2 class="text-base font-extrabold text-base-content/70">Recycle Bin is Empty</h2>
        <p class="text-xs text-base-content/40 font-bold max-w-sm mt-1 leading-relaxed">
          Files and folders you delete will appear here first so you can restore them anytime within 30 days.
        </p>
        <NuxtLink to="/files" class="btn btn-primary btn-sm rounded-xl font-bold text-[10px] uppercase tracking-wider mt-5 gap-1.5 shadow-sm">
          <Icon name="mdi:folder-outline" class="w-4 h-4" />
          Browse My Files
        </NuxtLink>
      </div>

      <!-- Trash List -->
      <div v-else class="space-y-3">
        <!-- Floating / Sticky Selection Bar -->
        <transition name="fade">
          <div 
            v-if="selectedIds.size > 0" 
            class="sticky top-20 z-20 bg-base-100/90 backdrop-blur-md border border-primary/20 rounded-2xl p-3 shadow-lg flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div class="flex items-center gap-3 pl-2">
              <span class="badge badge-primary font-bold text-xs text-primary-content">
                {{ selectedIds.size }} selected
              </span>
              <span class="text-xs font-bold text-base-content/60 hidden sm:inline">
                Choose an action for selected items
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button 
                @click="restoreSelected" 
                :disabled="isActionInProgress"
                class="btn btn-primary btn-sm rounded-xl font-bold text-[10px] uppercase tracking-wider gap-1.5 shadow-sm"
              >
                <Icon name="mdi:restore" class="w-4 h-4" />
                Restore
              </button>
              <button 
                @click="itemToDelete = null; showDeleteConfirm = true" 
                :disabled="isActionInProgress"
                class="btn btn-error btn-outline btn-sm rounded-xl font-bold text-[10px] uppercase tracking-wider gap-1.5"
              >
                <Icon name="mdi:delete-forever" class="w-4 h-4" />
                Delete Forever
              </button>
              <button 
                @click="selectedIds.clear()" 
                class="btn btn-ghost btn-sm btn-square rounded-xl"
                title="Deselect All"
              >
                <Icon name="mdi:close" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </transition>

        <!-- Table Container -->
        <div class="bg-base-100/70 backdrop-blur-md border border-base-content/5 rounded-2xl overflow-hidden shadow-sm">
          <!-- Table Header / Select All Bar -->
          <div class="px-5 py-3 border-b border-base-content/5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-base-content/40 bg-base-200/30">
            <div class="flex items-center gap-3">
              <input 
                type="checkbox" 
                :checked="isAllSelected" 
                @change="toggleSelectAll" 
                class="checkbox checkbox-primary checkbox-xs rounded"
              />
              <span>Item & Original Location</span>
            </div>
            <div class="flex items-center gap-8">
              <span class="hidden md:inline">Size</span>
              <span class="hidden sm:inline">Deleted</span>
              <span class="hidden lg:inline">Expires In</span>
              <span class="w-20 text-right">Actions</span>
            </div>
          </div>

          <!-- Items Rows -->
          <div class="divide-y divide-base-content/5">
            <div 
              v-for="item in filteredItems" 
              :key="item.id" 
              :class="[
                'px-5 py-3.5 flex items-center justify-between gap-4 transition-colors hover:bg-base-200/40',
                { 'bg-primary/5': selectedIds.has(item.id) }
              ]"
            >
              <!-- Left side: Checkbox + Icon + Name & Path -->
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <input 
                  type="checkbox" 
                  :checked="selectedIds.has(item.id)" 
                  @change="toggleSelectItem(item.id)" 
                  class="checkbox checkbox-primary checkbox-xs rounded shrink-0"
                />

                <div class="w-9 h-9 rounded-xl bg-base-200 flex items-center justify-center border border-base-content/5 shrink-0 text-base-content/60">
                  <Icon v-if="item.isDirectory" name="mdi:folder" class="w-5 h-5 text-warning" />
                  <Icon v-else :name="getIconForExtension(item.name)" class="w-5 h-5 text-primary" />
                </div>

                <div class="min-w-0 flex-1">
                  <p class="font-extrabold text-xs text-base-content/90 truncate" :title="item.name">
                    {{ item.name }}
                  </p>
                  <p class="text-[10px] font-bold text-base-content/40 truncate flex items-center gap-1 mt-0.5" :title="item.originalPath">
                    <Icon name="mdi:folder-outline" class="w-3 h-3 shrink-0" />
                    <span>{{ item.originalPath }}</span>
                  </p>
                </div>
              </div>

              <!-- Right side: Stats & Actions -->
              <div class="flex items-center gap-6 shrink-0">
                <!-- Size -->
                <span class="text-xs font-bold font-mono text-base-content/60 hidden md:inline w-16 text-right">
                  {{ formatSize(item.size) }}
                </span>

                <!-- Date -->
                <span class="text-[11px] font-bold text-base-content/40 hidden sm:inline w-28 text-right">
                  {{ formatDate(item.trashedAt) }}
                </span>

                <!-- Expiration Badge -->
                <div class="hidden lg:flex w-24 justify-end">
                  <span class="badge badge-sm font-bold text-[9px] uppercase tracking-wider bg-warning/15 text-warning border-none">
                    {{ getDaysRemaining(item.trashedAt) }}d left
                  </span>
                </div>

                <!-- Action Buttons -->
                <div class="flex items-center gap-1 w-20 justify-end">
                  <button 
                    @click="restoreItem(item)" 
                    :disabled="isActionInProgress"
                    class="btn btn-ghost btn-xs btn-square text-primary hover:bg-primary/10 rounded-lg"
                    title="Restore file"
                  >
                    <Icon name="mdi:restore" class="w-4 h-4" />
                  </button>

                  <button 
                    @click="promptPermanentDelete(item)" 
                    :disabled="isActionInProgress"
                    class="btn btn-ghost btn-xs btn-square text-error hover:bg-error/10 rounded-lg"
                    title="Delete permanently"
                  >
                    <Icon name="mdi:delete-forever" class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Empty Trash Confirmation Modal -->
    <div v-if="showEmptyConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-base-100 border border-base-content/10 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-error/15 flex items-center justify-center text-error border border-error/20">
            <Icon name="mdi:delete-sweep" class="w-6 h-6" />
          </div>
          <div>
            <h3 class="text-sm font-black uppercase tracking-wider text-base-content/90">Empty Recycle Bin?</h3>
            <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-widest">Irreversible operation</p>
          </div>
        </div>

        <p class="text-xs text-base-content/60 font-bold leading-relaxed">
          Are you sure you want to permanently delete all <span class="text-error font-extrabold">{{ trashItems.length }}</span> items in the recycle bin? These files cannot be recovered.
        </p>

        <div class="flex gap-2 pt-2">
          <button 
            class="btn btn-ghost btn-sm rounded-xl flex-1 font-bold text-[10px] uppercase tracking-wider" 
            @click="showEmptyConfirm = false"
            :disabled="isActionInProgress"
          >
            Cancel
          </button>
          <button 
            class="btn btn-error btn-sm rounded-xl flex-1 font-bold text-[10px] uppercase tracking-wider text-white shadow-sm" 
            @click="confirmEmptyTrash"
            :disabled="isActionInProgress"
          >
            <span v-if="isActionInProgress" class="loading loading-spinner loading-xs"></span>
            <span v-else>Purge All</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Permanent Delete Confirmation Modal (Single or Selected) -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="bg-base-100 border border-base-content/10 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-error/15 flex items-center justify-center text-error border border-error/20">
            <Icon name="mdi:alert-octagon-outline" class="w-6 h-6" />
          </div>
          <div>
            <h3 class="text-sm font-black uppercase tracking-wider text-base-content/90">Delete Permanently?</h3>
            <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-widest">Cannot be undone</p>
          </div>
        </div>

        <p class="text-xs text-base-content/60 font-bold leading-relaxed">
          <span v-if="itemToDelete">
            Are you sure you want to permanently delete <strong class="text-base-content/90">"{{ itemToDelete.name }}"</strong>? This cannot be restored.
          </span>
          <span v-else>
            Are you sure you want to permanently delete all <strong class="text-base-content/90">{{ selectedIds.size }}</strong> selected items?
          </span>
        </p>

        <div class="flex gap-2 pt-2">
          <button 
            class="btn btn-ghost btn-sm rounded-xl flex-1 font-bold text-[10px] uppercase tracking-wider" 
            @click="showDeleteConfirm = false; itemToDelete = null"
            :disabled="isActionInProgress"
          >
            Cancel
          </button>
          <button 
            class="btn btn-error btn-sm rounded-xl flex-1 font-bold text-[10px] uppercase tracking-wider text-white shadow-sm" 
            @click="confirmPermanentDelete"
            :disabled="isActionInProgress"
          >
            <span v-if="isActionInProgress" class="loading loading-spinner loading-xs"></span>
            <span v-else>Delete Forever</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
