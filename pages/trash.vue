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
  <div class="min-h-screen bg-base-100 flex flex-col font-sans text-fg">
    <!-- Header -->
    <header class="page-bar">
      <div class="page-wrap py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden" aria-label="Open navigation">
            <Icon name="mdi:menu" class="w-5 h-5" />
          </label>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h1 class="text-[15px] font-medium tracking-section text-fg leading-tight">Recycle Bin</h1>
              <span class="badge num">
                {{ trashItems.length }} {{ trashItems.length === 1 ? 'item' : 'items' }}
              </span>
              <span v-if="trashItems.length > 0" class="badge num">
                {{ formatSize(totalTrashSize) }}
              </span>
            </div>
            <p class="hidden sm:block text-[13px] text-fg-3 leading-tight">
              Deleted items are kept for 30 days, then removed permanently
            </p>
          </div>
        </div>

        <!-- Header Actions -->
        <div class="flex items-center gap-2">
          <!-- Search -->
          <div class="relative w-full md:w-56">
            <Icon name="mdi:magnify" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" />
            <input 
              v-model="searchQuery" 
              type="text" 
              placeholder="Filter deleted files..." 
              class="input input-bordered input-sm w-full pl-9 transition font-medium text-xs"
            />
          </div>

          <!-- Refresh -->
          <button 
            @click="fetchTrash" 
            class="btn btn-sm btn-square" 
            :disabled="isLoading"
            title="Refresh"
          >
            <Icon name="mdi:refresh" :class="['w-4 h-4 text-fg-2', { 'animate-spin': isLoading }]" />
          </button>

          <!-- Empty Trash Button -->
          <button 
            @click="showEmptyConfirm = true" 
            :disabled="trashItems.length === 0 || isLoading"
            class="btn btn-error btn-sm gap-1.5 "
          >
            <Icon name="mdi:delete-sweep" class="w-4 h-4" />
            <span class="hidden sm:inline">Empty Bin</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 w-full page-wrap py-10 space-y-4">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 space-y-3">
        <span class="loading loading-spinner loading-md text-fg"></span>
        <p class="text-xs text-fg-3">Loading deleted items...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="trashItems.length === 0" class="py-24 text-center">
        <p class="text-[15px] text-fg">The recycle bin is empty.</p>
        <p class="text-[14px] text-fg-3 mt-1 max-w-sm mx-auto">Deleted files stay here for 30 days before they're removed.</p>
        <NuxtLink to="/files" class="btn btn-sm mt-6">Browse files</NuxtLink>
      </div>

      <!-- Trash List -->
      <div v-else class="space-y-3">
        <!-- Floating / Sticky Selection Bar -->
        <transition name="fade">
          <div 
            v-if="selectedIds.size > 0" 
            class="sticky top-[76px] z-20 bg-base-200 border border-line rounded-xl px-4 py-2.5 flex items-center justify-between gap-4"
          >
            <div class="flex items-center gap-3">
              <span class="num text-[13px] text-fg">
                {{ selectedIds.size }} selected
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button 
                @click="restoreSelected" 
                :disabled="isActionInProgress"
                class="btn btn-primary btn-sm gap-1.5"
              >
                <Icon name="mdi:restore" class="w-4 h-4" />
                Restore
              </button>
              <button 
                @click="itemToDelete = null; showDeleteConfirm = true" 
                :disabled="isActionInProgress"
                class="btn btn-error btn-sm gap-1.5"
              >
                <Icon name="mdi:delete-forever" class="w-4 h-4" />
                Delete Forever
              </button>
              <button 
                @click="selectedIds.clear()" 
                class="btn btn-ghost btn-sm btn-square"
                title="Deselect All"
              >
                <Icon name="mdi:close" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </transition>

        <!-- Table Container -->
        <div class="bg-base-100 border border-line rounded-xl overflow-hidden">
          <!-- Table Header / Select All Bar -->
          <div class="px-4 py-2.5 border-b border-line flex items-center justify-between micro bg-base-200">
            <div class="flex items-center gap-3">
              <input 
                type="checkbox" 
                :checked="isAllSelected" 
                @change="toggleSelectAll" 
                class="checkbox checkbox-primary checkbox-xs rounded"
              />
              <span>Item</span>
            </div>
            <div class="flex items-center gap-8">
              <span class="hidden md:inline">Size</span>
              <span class="hidden sm:inline">Deleted</span>
              <span class="hidden lg:inline">Expires</span>
              <span class="w-20 text-right">Actions</span>
            </div>
          </div>

          <!-- Items Rows -->
          <div class="divide-y divide-line">
            <div 
              v-for="item in filteredItems" 
              :key="item.id" 
              :class="[
                'px-4 py-3 flex items-center justify-between gap-4 transition-colors hover:bg-surface-2',
                { 'bg-surface-2': selectedIds.has(item.id) }
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

                <Icon v-if="item.isDirectory" name="vscode-icons:default-folder" class="w-5 h-5 shrink-0" />
                <Icon v-else :name="getIconForExtension(item.name)" class="w-5 h-5 shrink-0" />

                <div class="min-w-0 flex-1">
                  <p class="text-[14px] text-fg truncate" :title="item.name">
                    {{ item.name }}
                  </p>
                  <p class="text-[13px] text-fg-3 truncate flex items-center gap-1 mt-0.5" :title="item.originalPath">
                    <span>{{ item.originalPath }}</span>
                  </p>
                </div>
              </div>

              <!-- Right side: Stats & Actions -->
              <div class="flex items-center gap-6 shrink-0">
                <!-- Size -->
                <span class="num text-[13px] text-fg-2 hidden md:inline w-16 text-right">
                  {{ formatSize(item.size) }}
                </span>

                <!-- Date -->
                <span class="num text-[12px] text-fg-3 hidden sm:inline w-28 text-right">
                  {{ formatDate(item.trashedAt) }}
                </span>

                <!-- Expiration Badge -->
                <div class="hidden lg:flex w-24 justify-end">
                  <span class="num text-[12px] text-fg-2">
                    {{ getDaysRemaining(item.trashedAt) }}d left
                  </span>
                </div>

                <!-- Action Buttons -->
                <div class="flex items-center gap-1 w-20 justify-end">
                  <button 
                    @click="restoreItem(item)" 
                    :disabled="isActionInProgress"
                    class="btn btn-ghost btn-sm btn-square"
                    title="Restore file"
                    aria-label="Restore"
                  >
                    <Icon name="mdi:restore" class="w-4 h-4" />
                  </button>

                  <button 
                    @click="promptPermanentDelete(item)" 
                    :disabled="isActionInProgress"
                    class="btn btn-ghost btn-sm btn-square text-error"
                    title="Delete permanently"
                    aria-label="Delete permanently"
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
    <div v-if="showEmptyConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div class="bg-base-100 border border-line rounded-xl max-w-sm w-full p-6 space-y-4">
        <div class="flex items-center gap-3">
          <div>
            <h3 class="section-title">Empty Recycle Bin?</h3>
            <p class="text-[13px] text-fg-3">This can’t be undone.</p>
          </div>
        </div>

        <p class="text-[14px] text-fg-2 leading-relaxed">
          Are you sure you want to permanently delete all <span class="num text-fg">{{ trashItems.length }}</span> items in the recycle bin? These files cannot be recovered.
        </p>

        <div class="flex justify-end gap-2 pt-2">
          <button 
            class="btn btn-ghost btn-sm" 
            @click="showEmptyConfirm = false"
            :disabled="isActionInProgress"
          >
            Cancel
          </button>
          <button 
            class="btn btn-error btn-sm" 
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
    <div v-if="showDeleteConfirm" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div class="bg-base-100 border border-line rounded-xl max-w-sm w-full p-6 space-y-4">
        <div class="flex items-center gap-3">
          <div>
            <h3 class="section-title">Delete Permanently?</h3>
            <p class="text-[13px] text-fg-3">This can’t be undone.</p>
          </div>
        </div>

        <p class="text-[14px] text-fg-2 leading-relaxed">
          <span v-if="itemToDelete">
            Are you sure you want to permanently delete <strong class="text-fg">"{{ itemToDelete.name }}"</strong>? This cannot be restored.
          </span>
          <span v-else>
            Are you sure you want to permanently delete all <strong class="text-fg">{{ selectedIds.size }}</strong> selected items?
          </span>
        </p>

        <div class="flex justify-end gap-2 pt-2">
          <button 
            class="btn btn-ghost btn-sm" 
            @click="showDeleteConfirm = false; itemToDelete = null"
            :disabled="isActionInProgress"
          >
            Cancel
          </button>
          <button 
            class="btn btn-error btn-sm" 
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
