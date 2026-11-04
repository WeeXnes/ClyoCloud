<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

useHead({
  title: 'Shared'
})
import { getIconForExtension } from '~/core/fileIcons'
import type { File } from '~/types/File'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'
import { copyToClipboard } from '~/core/clipboard'

const files = ref<File[]>([])
const isLoading = ref(true)
const searchQuery = ref('')

const fetchShared = async () => {
  isLoading.value = true
  try {
    const data = await $fetch<File[]>('/api/shared')
    files.value = data
  } catch (err) {
    console.error('Failed to fetch shared files:', err)
    createNotification('Failed to load shared files', NotificationType.ERROR)
  } finally {
    isLoading.value = false
  }
}

const filteredFiles = computed(() => {
  if (!searchQuery.value.trim()) return files.value
  const query = searchQuery.value.toLowerCase().trim()
  return files.value.filter(file => file.name.toLowerCase().includes(query))
})

const onFileClick = (file: File) => {
  // Navigate to parent folder
  const path = file.name
  const segments = path.split('/')
  const parentPath = segments.slice(0, -1).map(encodeURIComponent).join('/')
  navigateTo(`/files/${parentPath}`)
}

const togglePublic = async (file: File) => {
  const isPublic = !file.meta.isPublic
  try {
    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullPath: file.name, isPublic }),
    })
    
    if (!response.ok) throw new Error('Failed to update sharing status')
    
    if (!isPublic) {
      files.value = files.value.filter(f => f.name !== file.name)
      createNotification('Sharing disabled', NotificationType.INFO)
    } else {
      file.meta.isPublic = true
      createNotification('Sharing enabled', NotificationType.SUCCESS)
    }
    
  } catch (err) {
    console.error(err)
    createNotification('Failed to update sharing status', NotificationType.ERROR)
  }
}

const copyPublicLink = async (file: File) => {
  const user = useState<any>('user')
  const username = user.value?.name
  if (!username) return

  const url = useRequestURL()
  const publicUrl = `${url.origin}/p/${username}/${encodeURIComponent(file.name)}`

  const success = await copyToClipboard(publicUrl)
  if (success) {
    createNotification('Public link copied!', NotificationType.SUCCESS)
  } else {
    createNotification('Failed to copy link', NotificationType.ERROR)
  }
}

onMounted(fetchShared)
</script>

<template>
  <div class="min-h-screen bg-base-100">
    <header class="page-bar">
      <div class="page-wrap py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden" aria-label="Open navigation">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            <div class="flex items-center gap-2">
              <div>
                <h1 class="text-[15px] font-medium tracking-section text-fg leading-tight">Shared Files</h1>
                <p class="hidden sm:block text-[13px] text-fg-3 leading-tight">Manage your public links</p>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 md:gap-3">
             <div class="relative flex-1 md:flex-none md:min-w-[240px]">
                <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Icon name="mdi:magnify" class="w-4 h-4 text-fg-3" />
                </div>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search shared files..."
                  class="input input-xs md:input-sm input-bordered w-full !pl-9 transition font-medium text-xs "
                />
             </div>
          </div>
        </div>
      </div>
    </header>

    <main class="page-wrap py-10">
      <div v-if="isLoading" class="hair-list">
        <div v-for="i in 5" :key="i" class="h-14 animate-pulse"></div>
      </div>

      <div v-else-if="filteredFiles.length" class="hair-list">
        <div 
          v-for="file in filteredFiles" 
          :key="file.name"
          class="flex items-center gap-4 px-4 py-3 bg-base-100 hover:bg-surface-2 transition-colors cursor-pointer group"
          @click="onFileClick(file)"
        >
          <div class="flex items-center justify-center shrink-0 w-8 h-8">
            <Icon class="w-6 h-6" :name="file.isFolder ? 'vscode-icons:default-folder' : getIconForExtension(file.name)" />
          </div>

          <div class="flex-grow min-w-0">
            <h3 class="text-[14px] truncate text-fg">{{ file.name }}</h3>
            <p class="num text-[12px] text-fg-3 mt-0.5">
              {{ file.isFolder ? 'Folder' : (typeof file.size === 'number' && !isNaN(file.size) ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : '0.00 MB') }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button 
              class="btn btn-ghost btn-sm btn-circle" aria-label="Copy public link"
              title="Copy Public Link"
              @click.stop="copyPublicLink(file)"
            >
              <Icon name="mdi:link-variant" class="w-5 h-5" />
            </button>
            <button 
              class="btn btn-ghost btn-sm btn-circle text-error" aria-label="Stop sharing"
              title="Disable Sharing"
              @click.stop="togglePublic(file)"
            >
              <Icon name="mdi:share-off" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-24 text-center">
        <h3 class="text-[15px] text-fg">No shared files</h3>
        <p class="text-[14px] text-fg-3 mt-1 max-w-sm mx-auto">Files you make public will appear here for easy management.</p>
        <NuxtLink to="/files" class="btn btn-sm mt-6">
          Go to Files
        </NuxtLink>
      </div>
    </main>
  </div>
</template>
