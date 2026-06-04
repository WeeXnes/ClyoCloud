<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
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
  <div class="min-h-screen bg-base-200/50">
    <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/10">
      <div class="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            <div>
              <h1 class="text-lg font-bold tracking-tight flex items-center gap-2 text-base-content">
                <Icon name="mdi:share-variant" class="text-success w-5 h-5" />
                Shared Files
              </h1>
              <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">Manage your public links</p>
            </div>
          </div>

          <div class="relative w-full md:w-64">
            <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Icon name="mdi:magnify" class="w-4 h-4 text-base-content/30" />
            </div>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search shared items..."
              class="input input-sm input-bordered w-full pl-9 bg-base-100/50 focus:bg-base-100 transition-all border-base-content/10 font-bold text-xs rounded-lg"
            />
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div v-if="isLoading" class="flex flex-col gap-3">
        <div v-for="i in 5" :key="i" class="h-14 rounded-lg bg-base-300 animate-pulse"></div>
      </div>

      <div v-else-if="filteredFiles.length" class="flex flex-col gap-2.5">
        <div 
          v-for="file in filteredFiles" 
          :key="file.name"
          class="flex items-center gap-4 p-3 bg-base-100 rounded-lg border border-base-content/10 hover:border-primary/30 hover:bg-base-200/50 transition-all cursor-pointer group"
          @click="onFileClick(file)"
        >
          <div class="flex items-center justify-center shrink-0 w-8 h-8">
            <Icon class="w-6 h-6" :name="file.isFolder ? 'vscode-icons:default-folder' : getIconForExtension(file.name)" />
          </div>

          <div class="flex-grow min-w-0">
            <h3 class="text-xs font-bold truncate group-hover:text-primary transition-colors text-base-content">{{ file.name }}</h3>
            <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest mt-0.5">
              {{ file.isFolder ? 'Folder' : (file.size / 1024 / 1024).toFixed(2) + ' MB' }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button 
              class="btn btn-ghost btn-sm btn-circle text-success hover:bg-success/10"
              title="Copy Public Link"
              @click.stop="copyPublicLink(file)"
            >
              <Icon name="mdi:link-variant" class="w-5 h-5" />
            </button>
            <button 
              class="btn btn-ghost btn-sm btn-circle text-error hover:bg-error/10"
              title="Disable Sharing"
              @click.stop="togglePublic(file)"
            >
              <Icon name="mdi:share-off" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-24 text-center">
        <div class="bg-base-200/50 p-6 rounded-xl mb-6">
          <Icon name="mdi:share-variant-outline" class="w-16 h-16 text-base-content/10" />
        </div>
        <h3 class="text-xl font-bold tracking-tight text-base-content">No shared files</h3>
        <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">Files you make public will appear here for easy management.</p>
        <NuxtLink to="/files" class="btn btn-primary btn-sm mt-8 px-8 rounded-lg shadow-sm font-bold uppercase tracking-widest text-[10px]">
          Go to Files
        </NuxtLink>
      </div>
    </main>
  </div>
</template>
