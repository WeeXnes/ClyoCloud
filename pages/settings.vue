<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'nuxt/app'

useHead({
  title: 'Settings'
})
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'
import { startOperation, updateOperation, completeOperation, failOperation, ProgressManager } from '~/core/progressManager'
import type { Tag } from '~/types/File'
import { useState } from 'nuxt/app'

const route = useRoute()
const router = useRouter()

const activeCategory = computed<string | null>({
  get() {
    const cat = route.query.cat as string
    if (cat && ['security', 'system', 'appearance', 'previews', 'directories'].includes(cat)) {
      return cat
    }
    return null
  },
  set(val) {
    router.push({ query: val ? { cat: val } : {} })
  }
})

function getCategoryTitle(cat: string | null) {
  switch (cat) {
    case 'security': return 'Security & Access'
    case 'system': return 'System & Storage'
    case 'appearance': return 'Appearance & Identity'
    case 'previews': return 'Media Processing'
    case 'directories': return 'Directory Rules'
    default: return 'Settings'
  }
}

function getCategorySubtitle(cat: string | null) {
  switch (cat) {
    case 'security': return 'Update credentials, configure two-factor authentication, and manage sessions'
    case 'system': return 'Configure custom paths, execute storage diagnostics, and rebuild indexes'
    case 'appearance': return 'Select visual themes and define labels for file classification'
    case 'previews': return 'Manage video and image preview settings'
    case 'directories': return 'Inclusion and exclusion patterns for file queries'
    default: return 'Cloud Settings'
  }
}

const newPassword = ref('')
const confirmPassword = ref('')
const isChangingPassword = ref(false)

const downloadPath = ref('')
const mobileAutoPreview = ref(true)
const imageViewerMobileFullscreen = ref(false)
const maxConcurrentPreviews = ref(3)
const slideshowFrequency = ref(5)
const experimentalMode = ref(false)
const cpuCores = ref<number | null>(null)
const serverMaxConcurrency = ref<number | null>(null)
const isLoadingSettings = ref(true)
const maxDuplicateResults = ref(50)
const selectedShortsPaths = ref<string[]>([])
const excludedMediaPaths = ref<string[]>([])
const theme = useState<string>('currentTheme')
const isSavingSettings = ref(false)
const isRebuildingCache = ref(false)

const removeSelectedPath = async (index: number) => {
  selectedShortsPaths.value.splice(index, 1)
  await saveUserSettings()
}

const removeExcludedMediaPath = async (index: number) => {
  excludedMediaPaths.value.splice(index, 1)
  await saveUserSettings()
}

const tags = ref<Tag[]>([])
const newTagName = ref('')
const newTagColor = ref('#4B5EAA')
const isSavingTags = ref(false)

const isGeneratingPreviews = ref(false)
const isClearingPreviews = ref(false)
const cleanupData = ref<{ largeFiles: any[], oldFiles: any[] } | null>(null)
const isScanningStorage = ref(false)
const cleanupStatus = ref<any>(null)
let cleanupInterval: any = null

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

async function fetchCleanupData() {
  isScanningStorage.value = true
  try {
    const data: any = await $fetch('/api/storage-clean')
    cleanupStatus.value = data
    
    if (data.isScanning) {
      startCleanupPolling()
    } else if (data.results) {
      cleanupData.value = data.results
      isScanningStorage.value = false
    }
  } catch (err) {
    console.error('Cleanup scan error:', err)
    isScanningStorage.value = false
  }
}

function startCleanupPolling() {
  if (cleanupInterval) clearInterval(cleanupInterval)
  cleanupInterval = setInterval(async () => {
    try {
      const data: any = await $fetch('/api/storage-clean-status')
      cleanupStatus.value = data
      
      if (!data.isScanning) {
        clearInterval(cleanupInterval)
        cleanupInterval = null
        cleanupData.value = data.results
        isScanningStorage.value = false
      }
    } catch (err) {
      console.error('Cleanup polling error:', err)
      clearInterval(cleanupInterval)
      cleanupInterval = null
      isScanningStorage.value = false
    }
  }, 1000)
}

async function deleteCleanupFile(file: any) {
  if (!confirm(`Are you sure you want to delete ${file.name}?`)) return
  try {
    await $fetch('/api/files', {
      method: 'DELETE',
      body: { path: file.fullPath }
    })
    createNotification('File deleted', NotificationType.SUCCESS)
    // Refresh the cleanup data
    if (cleanupData.value) {
      cleanupData.value.largeFiles = cleanupData.value.largeFiles.filter(f => f.fullPath !== file.fullPath)
      cleanupData.value.oldFiles = cleanupData.value.oldFiles.filter(f => f.fullPath !== file.fullPath)
    }
  } catch (err) {
    createNotification('Failed to delete file', NotificationType.ERROR)
  }
}

const generationResults = ref<{ total: number, processed: number, generated: number, skipped: number, errors: number, isProcessing: boolean } | null>(null)
let statusPollingInterval: any = null

const fetchGenerationStatus = async () => {
  try {
    const response = await fetch('/api/previews-status', { credentials: 'include' })
    if (response.ok) {
      const status = await response.json()
      generationResults.value = status
      isGeneratingPreviews.value = status.isProcessing

      if (status.isProcessing) {
        const existingOp = ProgressManager.operations.find(o => o.id === 'preview-gen')
        if (!existingOp) {
          startOperation('preview-gen', 'Generating Previews', status.total)
        } else if (existingOp.total !== status.total) {
            existingOp.total = status.total
        }
        updateOperation('preview-gen', status.processed)
      } else if (statusPollingInterval) {
        clearInterval(statusPollingInterval)
        statusPollingInterval = null
        completeOperation('preview-gen')
        if (status.processed > 0) {
          createNotification(`Bulk generation complete! Processed: ${status.processed}`, NotificationType.SUCCESS)
        }
      }
    }
  } catch (err) {
    console.error('Error fetching generation status:', err)
    failOperation('preview-gen')
  }
}

const is2faEnabled = ref(false)
const show2faSetup = ref(false)
const qrCodeUrl = ref('')
const totpSecret = ref('')
const totpCode = ref('')
const isVerifying2fa = ref(false)
const showDisableConfirm = ref(false)
const disableCode = ref('')

const user = useState<{ name: string } | null>('user')

async function fetch2faStatus() {
  try {
    const response = await fetch('/api/user-settings', { credentials: 'include' })
    if (response.ok) {
      const data = await response.json()
      is2faEnabled.value = data.twoFactorEnabled || false
    }
  } catch (err) {
    console.error('Error fetching 2FA status:', err)
  }
}

async function setup2fa() {
  try {
    const data: any = await $fetch('/api/2fa/setup')
    qrCodeUrl.value = data.qrCodeUrl
    totpSecret.value = data.secret
    show2faSetup.value = true
  } catch (err: any) {
    createNotification(err.data?.statusMessage || 'Failed to start 2FA setup', NotificationType.ERROR)
  }
}

async function enable2fa() {
  if (!totpCode.value) return
  isVerifying2fa.value = true
  try {
    await $fetch('/api/2fa/enable', {
      method: 'POST',
      body: { secret: totpSecret.value, code: totpCode.value }
    })
    is2faEnabled.value = true
    show2faSetup.value = false
    totpCode.value = ''
    createNotification('2FA enabled successfully', NotificationType.SUCCESS)
  } catch (err: any) {
    createNotification(err.data?.statusMessage || 'Invalid 2FA code', NotificationType.ERROR)
  } finally {
    isVerifying2fa.value = false
  }
}

async function disable2fa() {
  showDisableConfirm.value = true
}

async function confirmDisable2fa() {
  if (!disableCode.value) return
  isVerifying2fa.value = true
  try {
    await $fetch('/api/2fa/disable', {
      method: 'POST',
      body: { code: disableCode.value }
    })
    is2faEnabled.value = false
    showDisableConfirm.value = false
    disableCode.value = ''
    createNotification('2FA disabled successfully', NotificationType.INFO)
  } catch (err: any) {
    createNotification(err.data?.statusMessage || 'Failed to disable 2FA', NotificationType.ERROR)
  } finally {
    isVerifying2fa.value = false
  }
}

const appQrCodeUrl = ref('')
const isGeneratingAppQr = ref(false)
const devices = ref<any[]>([])

async function fetchDevices() {
  try {
    const response = await fetch('/api/devices', { credentials: 'include' })
    if (response.ok) {
      devices.value = await response.json()
    }
  } catch (err) {
    console.error('Error fetching devices:', err)
  }
}

async function revokeDevice(id: string) {
  try {
    const response = await fetch('/api/devices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    if (response.ok) {
      createNotification('Device connection revoked successfully', NotificationType.INFO)
      await fetchDevices()
    } else {
      const errData = await response.json()
      createNotification(errData.statusMessage || 'Failed to revoke device connection', NotificationType.ERROR)
    }
  } catch (err: any) {
    createNotification(err.message || 'Failed to revoke device connection', NotificationType.ERROR)
  }
}

async function fetchAppQrCode() {
  isGeneratingAppQr.value = true
  try {
    const origin = window.location.origin
    const data: any = await $fetch(`/api/user-qr?origin=${encodeURIComponent(origin)}`)
    appQrCodeUrl.value = data.qrCodeUrl
    await fetchDevices()
  } catch (err: any) {
    createNotification(err.data?.statusMessage || 'Failed to generate App Login QR Code', NotificationType.ERROR)
  } finally {
    isGeneratingAppQr.value = false
  }
}

async function fetchTags() {
  try {
    const response = await fetch('/api/tags', { credentials: 'include' })
    if (response.ok) {
      tags.value = await response.json()
    }
  } catch (err) {
    console.error('Error fetching tags:', err)
  }
}

async function fetchUserSettings() {
  try {
    const response = await fetch('/api/user-settings', { credentials: 'include' })
    if (response.ok) {
      const data = await response.json()
      downloadPath.value = data.downloadPath || ''
      mobileAutoPreview.value = data.mobileAutoPreview ?? true
      imageViewerMobileFullscreen.value = data.imageViewerMobileFullscreen ?? false
      maxConcurrentPreviews.value = data.maxConcurrentPreviews || 3
      slideshowFrequency.value = data.slideshowFrequency || 5
      experimentalMode.value = data.experimentalMode || false
      cpuCores.value = data.cpuCores || 4
      serverMaxConcurrency.value = data.serverMaxConcurrency || 8
      selectedShortsPaths.value = data.selectedShortsPaths || []
      excludedMediaPaths.value = data.excludedMediaPaths || []
      theme.value = data.theme || 'onedev'
      maxDuplicateResults.value = data.maxDuplicateResults || 50

    }
  } catch (err) {
    console.error('Error fetching user settings:', err)
  } finally {
    isLoadingSettings.value = false
  }
}

onMounted(() => {
  fetchTags()
  fetchUserSettings()
  fetch2faStatus()
  fetchDevices()
  fetchGenerationStatus() // Check if a task is already running
  fetchThumbnailGenerationStatus() // Check if a task is already running
})

onUnmounted(() => {
  if (statusPollingInterval) clearInterval(statusPollingInterval)
  if (thumbnailStatusPollingInterval) clearInterval(thumbnailStatusPollingInterval)
})

async function saveUserSettings() {
  isSavingSettings.value = true
  try {
    const response = await fetch('/api/user-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        downloadPath: downloadPath.value,
        mobileAutoPreview: mobileAutoPreview.value,
        imageViewerMobileFullscreen: imageViewerMobileFullscreen.value,
        maxConcurrentPreviews: maxConcurrentPreviews.value,
        slideshowFrequency: slideshowFrequency.value,
        experimentalMode: experimentalMode.value,
        selectedShortsPaths: selectedShortsPaths.value,
        excludedMediaPaths: excludedMediaPaths.value,
        theme: theme.value,
        maxDuplicateResults: maxDuplicateResults.value,

      }),
    })

    if (!response.ok) throw new Error('Failed to save settings')
    createNotification('Settings updated', NotificationType.SUCCESS)
  } catch (err) {
    createNotification('Failed to save settings', NotificationType.ERROR)
  } finally {
    isSavingSettings.value = false
  }
}

async function changePassword() {
  if (newPassword.value !== confirmPassword.value) {
    createNotification('Passwords do not match', NotificationType.WARNING)
    return
  }
  if (newPassword.value.length < 6) {
    createNotification('Password must be at least 6 characters', NotificationType.WARNING)
    return
  }

  isChangingPassword.value = true
  try {
    const response = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: newPassword.value }),
    })

    if (!response.ok) throw new Error('Failed to change password')

    createNotification('Password updated successfully', NotificationType.SUCCESS)
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    createNotification('Failed to update password', NotificationType.ERROR)
  } finally {
    isChangingPassword.value = false
  }
}

async function addTag() {
  if (!newTagName.value.trim()) return
  
  const tagExists = tags.value.some(t => t.name.toLowerCase() === newTagName.value.toLowerCase())
  if (tagExists) {
    createNotification('Tag already exists', NotificationType.WARNING)
    return
  }

  tags.value.push({ name: newTagName.value, color: newTagColor.value })
  newTagName.value = ''
  await saveTags()
}

async function removeTag(index: number) {
  tags.value.splice(index, 1)
  await saveTags()
}

async function saveTags() {
  isSavingTags.value = true
  try {
    const response = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: tags.value }),
    })

    if (!response.ok) throw new Error('Failed to save tags')
    createNotification('Tags updated', NotificationType.SUCCESS)
  } catch (err) {
    createNotification('Failed to save tags', NotificationType.ERROR)
  } finally {
    isSavingTags.value = false
  }
}

async function generateAllPreviews() {
  if (isGeneratingPreviews.value) return
  
  isGeneratingPreviews.value = true
  generationResults.value = null
  try {
    const response = await fetch('/api/previews-generate', {
      method: 'POST',
      credentials: 'include'
    })

    if (!response.ok) throw new Error('Failed to start preview generation')
    
    createNotification('Bulk preview generation started in background.', NotificationType.INFO)
    
    // Start polling for status
    if (statusPollingInterval) clearInterval(statusPollingInterval)
    statusPollingInterval = setInterval(fetchGenerationStatus, 1000)
    fetchGenerationStatus() // Immediate first fetch
  } catch (err) {
    console.error(err)
    createNotification('Failed to start bulk generation', NotificationType.ERROR)
    isGeneratingPreviews.value = false
  }
}

const isGeneratingThumbnails = ref(false)
const thumbnailGenerationResults = ref<{ total: number, processed: number, generated: number, skipped: number, errors: number, isProcessing: boolean } | null>(null)
let thumbnailStatusPollingInterval: any = null

const fetchThumbnailGenerationStatus = async () => {
  try {
    const response = await fetch('/api/thumbnails-status', { credentials: 'include' })
    if (response.ok) {
      const status = await response.json()
      thumbnailGenerationResults.value = status
      isGeneratingThumbnails.value = status.isProcessing

      if (status.isProcessing) {
        const existingOp = ProgressManager.operations.find(o => o.id === 'thumb-gen')
        if (!existingOp) {
          startOperation('thumb-gen', 'Generating Image Thumbnails', status.total)
        } else if (existingOp.total !== status.total) {
            existingOp.total = status.total
        }
        updateOperation('thumb-gen', status.processed)
      } else if (thumbnailStatusPollingInterval) {
        clearInterval(thumbnailStatusPollingInterval)
        thumbnailStatusPollingInterval = null
        completeOperation('thumb-gen')
        if (status.processed > 0) {
          createNotification(`Bulk thumbnail generation complete! Processed: ${status.processed}`, NotificationType.SUCCESS)
        }
      }
    }
  } catch (err) {
    console.error('Error fetching thumbnail status:', err)
    failOperation('thumb-gen')
  }
}

async function generateAllThumbnails() {
  isGeneratingThumbnails.value = true
  try {
    const response = await fetch('/api/thumbnails-generate', {
      method: 'POST',
      credentials: 'include'
    })
    if (!response.ok) throw new Error('Failed to start thumbnail generation')
    
    createNotification('Bulk thumbnail generation started in background.', NotificationType.INFO)
    
    if (thumbnailStatusPollingInterval) clearInterval(thumbnailStatusPollingInterval)
    thumbnailStatusPollingInterval = setInterval(fetchThumbnailGenerationStatus, 1000)
    fetchThumbnailGenerationStatus() // Immediate first fetch
  } catch (err) {
    console.error(err)
    createNotification('Failed to start bulk thumbnail generation', NotificationType.ERROR)
    isGeneratingThumbnails.value = false
  }
}

async function clearAllPreviews() {
  if (!confirm('Are you sure you want to delete ALL generated previews and thumbnails? This cannot be undone.')) return
  
  isClearingPreviews.value = true
  try {
    const response = await fetch('/api/previews-clear', {
      method: 'POST',
      credentials: 'include'
    })

    if (!response.ok) throw new Error('Failed to clear previews and thumbnails')
    
    generationResults.value = null
    thumbnailGenerationResults.value = null
    createNotification('All previews and thumbnails cleared successfully', NotificationType.SUCCESS)
  } catch (err) {
    console.error(err)
    createNotification('Failed to clear previews and thumbnails', NotificationType.ERROR)
  } finally {
    isClearingPreviews.value = false
  }
}

async function refreshTagCache() {
  isRebuildingCache.value = true
  try {
    const response = await fetch('/api/tags/rebuild-cache', {
      method: 'POST',
      credentials: 'include'
    })

    if (!response.ok) throw new Error('Failed to rebuild tag cache')
    
    createNotification('Tag cache rebuild started', NotificationType.SUCCESS)
  } catch (err) {
    console.error(err)
    createNotification('Failed to rebuild tag cache', NotificationType.ERROR)
  } finally {
    isRebuildingCache.value = false
  }
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' })
    user.value = null
    navigateTo('/login')
  } catch (err) {
    createNotification('Failed to logout', NotificationType.ERROR)
  }
}
</script>

<<template>
  <div class="min-h-screen bg-base-300/40 flex flex-col font-sans text-base-content/90">
    <header class="sticky top-0 z-[40] w-full bg-base-100/70 backdrop-blur-md border-b border-base-content/5">
      <div class="w-full px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden hover:bg-base-content/10">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <Icon name="mdi:cog-outline" class="text-primary w-5 h-5" />
              </div>
              <div>
                <h1 class="text-base font-extrabold tracking-tight">System Settings</h1>
                <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest leading-none mt-0.5">Configuration</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-[800px] mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      <!-- Category Navigation Menu (Shown if activeCategory is null) -->
      <div v-if="activeCategory === null" class="space-y-6">
        <div class="flex flex-col gap-1">
          <h2 class="text-xl font-black tracking-tight">Cloud Control Panel</h2>
          <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">Select a settings category below to manage your cloud environment</p>
        </div>

        <div class="bg-base-100/60 backdrop-blur-md border border-base-content/5 rounded-2xl overflow-hidden shadow-sm divide-y divide-base-content/5">
          <!-- 1. Security & Authentication -->
          <button 
            @click="activeCategory = 'security'"
            class="w-full flex items-center justify-between p-5 hover:bg-base-content/5 active:bg-base-content/10 transition-colors text-left group"
          >
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/10 group-hover:scale-105 transition-transform duration-300">
                <Icon name="mdi:shield-lock-outline" class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-extrabold text-sm tracking-tight text-base-content">Security & Access</h3>
                <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider mt-0.5">Update credentials, configure 2FA, session control</p>
              </div>
            </div>
            <Icon name="mdi:chevron-right" class="w-5 h-5 text-base-content/30 group-hover:translate-x-1 transition-transform" />
          </button>

          <!-- 2. System & Storage -->
          <button 
            @click="activeCategory = 'system'"
            class="w-full flex items-center justify-between p-5 hover:bg-base-content/5 active:bg-base-content/10 transition-colors text-left group"
          >
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/10 group-hover:scale-105 transition-transform duration-300">
                <Icon name="mdi:server-network" class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-extrabold text-sm tracking-tight text-base-content">System & Storage</h3>
                <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider mt-0.5">Download paths, storage scan, maintenance</p>
              </div>
            </div>
            <Icon name="mdi:chevron-right" class="w-5 h-5 text-base-content/30 group-hover:translate-x-1 transition-transform" />
          </button>

          <!-- 3. Visuals & Identity -->
          <button 
            @click="activeCategory = 'appearance'"
            class="w-full flex items-center justify-between p-5 hover:bg-base-content/5 active:bg-base-content/10 transition-colors text-left group"
          >
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success border border-success/10 group-hover:scale-105 transition-transform duration-300">
                <Icon name="mdi:palette-outline" class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-extrabold text-sm tracking-tight text-base-content">Appearance & Tags</h3>
                <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider mt-0.5">Visual themes, predefined tag indexing</p>
              </div>
            </div>
            <Icon name="mdi:chevron-right" class="w-5 h-5 text-base-content/30 group-hover:translate-x-1 transition-transform" />
          </button>

          <!-- 4. Media Processing -->
          <button 
            @click="activeCategory = 'previews'"
            class="w-full flex items-center justify-between p-5 hover:bg-base-content/5 active:bg-base-content/10 transition-colors text-left group"
          >
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 border border-purple-500/10 group-hover:scale-105 transition-transform duration-300">
                <Icon name="mdi:movie-filter-outline" class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-extrabold text-sm tracking-tight text-base-content">Media Processing</h3>
                <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider mt-0.5">Previews generation, slide duration, processing threads</p>
              </div>
            </div>
            <Icon name="mdi:chevron-right" class="w-5 h-5 text-base-content/30 group-hover:translate-x-1 transition-transform" />
          </button>

          <!-- 5. Directory Rules -->
          <button 
            @click="activeCategory = 'directories'"
            class="w-full flex items-center justify-between p-5 hover:bg-base-content/5 active:bg-base-content/10 transition-colors text-left group"
          >
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center text-info border border-info/10 group-hover:scale-105 transition-transform duration-300">
                <Icon name="mdi:folder-outline" class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-extrabold text-sm tracking-tight text-base-content">Directory Rules</h3>
                <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider mt-0.5">Shorts preferences, folders and exclusions</p>
              </div>
            </div>
            <Icon name="mdi:chevron-right" class="w-5 h-5 text-base-content/30 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      <!-- Sub-settings View (Shown if activeCategory is not null) -->
      <div v-else class="space-y-6 animate-in fade-in duration-200">
        
        <!-- Back Navigation Bar -->
        <div class="flex items-center justify-between pb-2 border-b border-base-content/5">
          <button 
            @click="activeCategory = null"
            class="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary-focus transition-all group"
          >
            <Icon name="mdi:arrow-left" class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to categories
          </button>
          <span class="text-[9px] font-bold text-base-content/20 uppercase tracking-widest">Sub-menu Configuration</span>
        </div>

        <!-- Section Title -->
        <div class="flex flex-col gap-1">
          <h2 class="text-xl font-black tracking-tight">{{ getCategoryTitle(activeCategory) }}</h2>
          <p class="text-xs text-base-content/50 font-bold uppercase tracking-wide leading-tight">{{ getCategorySubtitle(activeCategory) }}</p>
        </div>

        <!-- Sub-setting groups -->

        <!-- 1. SECURITY SUB-MENU -->
        <div v-if="activeCategory === 'security'" class="space-y-6">
          <!-- Update Password Card -->
          <div class="bg-base-100/60 backdrop-blur-md border border-base-content/5 rounded-2xl overflow-hidden shadow-sm p-6 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                <Icon name="mdi:key-outline" class="w-4 h-4" />
              </div>
              <h3 class="text-xs font-black uppercase tracking-wider text-base-content/60">Update Credentials</h3>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div class="form-control">
                <label class="label py-1">
                  <span class="label-text font-bold text-[9px] uppercase tracking-widest text-base-content/40">New Secret Key</span>
                </label>
                <input 
                  v-model="newPassword" 
                  type="password" 
                  placeholder="Min. 6 characters" 
                  class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-xs h-10 rounded-xl border-base-content/5 focus:outline-none focus:ring-1 focus:ring-primary/20" 
                />
              </div>
              <div class="form-control">
                <label class="label py-1">
                  <span class="label-text font-bold text-[9px] uppercase tracking-widest text-base-content/40">Confirm Secret Key</span>
                </label>
                <input 
                  v-model="confirmPassword" 
                  type="password" 
                  class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-xs h-10 rounded-xl border-base-content/5 focus:outline-none focus:ring-1 focus:ring-primary/20" 
                />
              </div>
            </div>
            <button 
              class="btn btn-primary rounded-xl h-10 min-h-0 shadow-sm gap-2 font-bold text-[10px] uppercase tracking-widest w-full mt-2" 
              @click="changePassword" 
              :disabled="isChangingPassword"
            >
              <Icon v-if="!isChangingPassword" name="mdi:check-circle-outline" class="w-4 h-4" />
              <span v-else class="loading loading-spinner loading-xs"></span>
              Save new credentials
            </button>
          </div>

          <!-- Two-Factor Authentication Card -->
          <div class="bg-base-100/60 backdrop-blur-md border border-base-content/5 rounded-2xl overflow-hidden shadow-sm p-6 space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center text-success border border-success/10">
                  <Icon name="mdi:shield-lock-outline" class="w-4 h-4" />
                </div>
                <h3 class="text-xs font-black uppercase tracking-wider text-base-content/60">Two-Factor Authentication</h3>
              </div>
              <div :class="`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${is2faEnabled ? 'bg-success/15 text-success' : 'bg-base-200 text-base-content/30'}`">
                {{ is2faEnabled ? 'Enabled' : 'Disabled' }}
              </div>
            </div>

            <div v-if="!is2faEnabled" class="pt-2">
              <p class="text-[11px] text-base-content/50 font-bold leading-relaxed mb-4">
                Require a verification code from your authenticator app to authorize session access.
              </p>
              
              <button 
                v-if="!show2faSetup"
                class="btn btn-outline btn-primary rounded-xl h-10 min-h-0 w-full gap-2 font-bold text-[10px] uppercase tracking-widest"
                @click="setup2fa"
              >
                <Icon name="mdi:shield-plus-outline" class="w-4 h-4" />
                Configure 2FA MFA
              </button>

              <div v-else class="space-y-6 pt-2 animate-in fade-in duration-300">
                <div class="flex flex-col items-center gap-4 p-4 bg-base-300/40 rounded-xl border border-base-content/5">
                  <img :src="qrCodeUrl" class="w-36 h-36 rounded-lg shadow-sm border border-base-content/10" alt="2FA QR Code" />
                  <div class="text-center">
                    <p class="text-[8px] font-bold uppercase tracking-widest text-base-content/30 mb-1">Manual secret key</p>
                    <code class="text-[10px] font-mono font-black tracking-wider text-base-content/60">{{ totpSecret }}</code>
                  </div>
                </div>

                <div class="form-control">
                  <label class="label py-1">
                    <span class="label-text font-bold text-[9px] uppercase tracking-widest text-base-content/40">Verification Code</span>
                  </label>
                  <input 
                    v-model="totpCode"
                    type="text"
                    placeholder="000000"
                    class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-center text-base tracking-[0.3em] h-10 rounded-xl border-base-content/5"
                    maxlength="6"
                  />
                </div>

                <div class="flex gap-3">
                  <button class="btn btn-ghost flex-1 h-10 min-h-0 rounded-xl font-bold text-[10px] uppercase tracking-widest" @click="show2faSetup = false">Cancel</button>
                  <button 
                    class="btn btn-primary flex-1 h-10 min-h-0 rounded-xl shadow-sm font-bold text-[10px] uppercase tracking-widest"
                    @click="enable2fa"
                    :disabled="isVerifying2fa || totpCode.length < 6"
                  >
                    <span v-if="isVerifying2fa" class="loading loading-spinner loading-xs"></span>
                    Confirm enable
                  </button>
                </div>
              </div>
            </div>

            <div v-else class="pt-2">
              <div v-if="!showDisableConfirm">
                <p class="text-[11px] text-base-content/50 font-bold leading-relaxed mb-4">
                  Your account login is enforced with Google Authenticator TOTP token checks.
                </p>
                <button 
                  class="btn btn-error btn-outline rounded-xl h-10 min-h-0 w-full gap-2 font-bold text-[10px] uppercase tracking-widest"
                  @click="disable2fa"
                >
                  <Icon name="mdi:shield-off-outline" class="w-4 h-4" />
                  Disable 2FA Security
                </button>
              </div>
              
              <div v-else class="space-y-6 animate-in fade-in duration-300">
                <div class="p-4 bg-error/5 rounded-xl border border-error/10 text-center">
                  <p class="text-[9px] font-bold text-error uppercase tracking-widest mb-1">Confirm identity</p>
                  <p class="text-[10px] font-bold text-error/60">Enter verification token code from your authenticator device.</p>
                </div>

                <div class="form-control">
                  <label class="label py-1">
                    <span class="label-text font-bold text-[9px] uppercase tracking-widest text-base-content/40">Authenticator Code</span>
                  </label>
                  <input 
                    v-model="disableCode"
                    type="text"
                    placeholder="000000"
                    class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-center text-base tracking-[0.3em] h-10 rounded-xl border-base-content/5"
                    maxlength="6"
                  />
                </div>

                <div class="flex gap-3">
                  <button class="btn btn-ghost flex-1 h-10 min-h-0 rounded-xl font-bold text-[10px] uppercase tracking-widest" @click="showDisableConfirm = false">Cancel</button>
                  <button 
                    class="btn btn-error flex-1 h-10 min-h-0 rounded-xl shadow-sm font-bold text-[10px] uppercase tracking-widest text-white"
                    @click="confirmDisable2fa"
                    :disabled="isVerifying2fa || disableCode.length < 6"
                  >
                    <span v-if="isVerifying2fa" class="loading loading-spinner loading-xs"></span>
                    Confirm disable
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- App Quick Login -->
          <div class="bg-base-100/60 backdrop-blur-md border border-base-content/5 rounded-2xl overflow-hidden shadow-sm p-6 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                <Icon name="mdi:qrcode" class="w-4 h-4" />
              </div>
              <h3 class="text-xs font-black uppercase tracking-wider text-base-content/60">App Quick Login</h3>
            </div>
            <p class="text-[11px] text-base-content/50 font-bold leading-relaxed mb-2">
              Scan this QR code from the ClyoCloud or ClyoWallpaper mobile app login screen to automatically configure and authenticate the client.
            </p>

            <div class="flex flex-col items-center gap-4 pt-2">
              <button 
                v-if="!appQrCodeUrl"
                class="btn btn-outline btn-primary rounded-xl h-10 min-h-0 w-full gap-2 font-bold text-[10px] uppercase tracking-widest"
                @click="fetchAppQrCode"
                :disabled="isGeneratingAppQr"
              >
                <Icon v-if="!isGeneratingAppQr" name="mdi:qrcode-scan" class="w-4 h-4" />
                <span v-else class="loading loading-spinner loading-xs"></span>
                Generate Login QR Code
              </button>
              <div v-else class="flex flex-col items-center gap-4 w-full animate-in fade-in duration-300">
                <div class="p-4 bg-white rounded-xl border border-base-content/10 shadow-inner">
                  <img :src="appQrCodeUrl" class="w-44 h-44 object-contain" alt="App Login QR Code" />
                </div>
                <button 
                  class="btn btn-ghost rounded-xl h-10 min-h-0 text-[10px] font-bold uppercase tracking-widest" 
                  @click="appQrCodeUrl = ''"
                >
                  Hide QR Code
                </button>
              </div>
            </div>

            <!-- Connected Devices List -->
            <div v-if="devices.length > 0" class="pt-4 border-t border-base-content/5 space-y-3">
              <h4 class="text-[10px] font-black uppercase tracking-wider text-base-content/50">Registered Devices</h4>
              <div class="space-y-2">
                <div 
                  v-for="device in devices" 
                  :key="device.id" 
                  class="flex items-center justify-between p-3 rounded-xl bg-base-200/50 border border-base-content/5 text-xs animate-in fade-in duration-300"
                >
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <Icon name="mdi:cellphone" class="w-4 h-4 text-base-content/70" />
                      <span class="font-bold text-base-content/80">{{ device.model }}</span>
                    </div>
                    <div class="text-[9px] text-base-content/40 font-semibold space-x-2">
                      <span>Added: {{ new Date(device.createdAt).toLocaleDateString() }}</span>
                      <span>•</span>
                      <span>Last Active: {{ new Date(device.lastActive).toLocaleDateString() }}</span>
                    </div>
                  </div>
                  <button 
                    class="btn btn-ghost btn-xs text-error font-bold uppercase tracking-widest text-[9px] hover:bg-error/10 rounded-lg px-2"
                    @click="revokeDevice(device.id)"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Session Sign Out (Session Control) -->
          <div class="bg-error/5 border border-error/10 rounded-2xl p-6 space-y-4">
            <div class="flex items-center justify-between gap-4">
              <div>
                <h3 class="text-xs font-black uppercase tracking-wider text-base-content/70">Terminate session</h3>
                <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-widest mt-0.5">Disconnect from cloud cluster client</p>
              </div>
              <button class="btn btn-error btn-outline rounded-xl h-10 min-h-0 px-6 font-bold uppercase text-[10px] tracking-widest" @click="logout">
                Sign out
              </button>
            </div>
          </div>
        </div>

        <!-- 2. SYSTEM & STORAGE SUB-MENU -->
        <div v-if="activeCategory === 'system'" class="space-y-6">
          <!-- List based rows for System options -->
          <div class="bg-base-100/60 backdrop-blur-md border border-base-content/5 rounded-2xl overflow-hidden shadow-sm divide-y divide-base-content/5">
            
            <!-- Download path config -->
            <div class="p-5 space-y-3">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/10 shrink-0 mt-0.5">
                  <Icon name="mdi:folder-download-outline" class="w-4 h-4" />
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="text-xs font-extrabold tracking-wide">Custom Retrieval Path</h4>
                  <p class="text-[9px] text-base-content/40 font-bold uppercase tracking-widest mt-0.5">Download directory target relative to root storage</p>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-3 pt-2">
                <div class="flex-1 flex items-center bg-base-200/50 border border-base-content/5 rounded-xl focus-within:bg-base-100 focus-within:ring-1 focus-within:ring-primary/20 transition-all overflow-hidden px-4">
                   <span class="text-base-content/30 text-[11px] font-bold whitespace-nowrap select-none">
                     {{ user?.name }}/
                   </span>
                   <input 
                     v-model="downloadPath" 
                     type="text" 
                     placeholder="e.g. videos/youtube" 
                     class="bg-transparent border-none outline-none w-full font-bold text-xs h-10 pl-1 focus:ring-0 focus:outline-none" 
                   />
                </div>
                <button 
                  class="btn btn-primary h-10 min-h-0 rounded-xl px-6 shadow-sm gap-2 font-bold text-[10px] uppercase tracking-widest" 
                  @click="saveUserSettings" 
                  :disabled="isSavingSettings"
                >
                  <Icon v-if="!isSavingSettings" name="mdi:content-save-outline" class="w-4 h-4" />
                  <span v-else class="loading loading-spinner loading-xs"></span>
                  Save settings
                </button>
              </div>
            </div>

            <!-- Storage Diagnostics Scan -->
            <div class="p-5 flex items-center justify-between gap-4">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/10 shrink-0 mt-0.5">
                  <Icon name="mdi:magnify-scan" class="w-4 h-4" />
                </div>
                <div>
                  <h4 class="text-xs font-extrabold tracking-wide">Storage Diagnostics</h4>
                  <p class="text-[9px] text-base-content/40 font-bold uppercase tracking-widest mt-0.5">Scan cluster for old or oversized junk files</p>
                </div>
              </div>
              <button 
                class="btn btn-ghost border border-base-content/10 bg-base-200/40 rounded-xl h-10 min-h-0 px-4 font-bold text-[10px] uppercase tracking-widest shrink-0"
                @click="fetchCleanupData"
                :disabled="isScanningStorage"
              >
                <Icon name="mdi:magnify-scan" class="w-4 h-4" :class="{ 'animate-pulse': isScanningStorage }" />
                {{ isScanningStorage ? 'Scanning...' : 'Scan Storage' }}
              </button>
            </div>

            <!-- Tag Cache Index Rebuilding -->
            <div class="p-5 flex items-center justify-between gap-4">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center text-success border border-success/10 shrink-0 mt-0.5">
                  <Icon name="mdi:database-refresh-outline" class="w-4 h-4" />
                </div>
                <div>
                  <h4 class="text-xs font-extrabold tracking-wide">Rebuild Tag Cache</h4>
                  <p class="text-[9px] text-base-content/40 font-bold uppercase tracking-widest mt-0.5">Synchronize and update tag indexes</p>
                </div>
              </div>
              <button 
                class="btn btn-ghost border border-base-content/10 bg-base-200/40 rounded-xl h-10 min-h-0 px-4 font-bold text-[10px] uppercase tracking-widest shrink-0"
                @click="refreshTagCache"
                :disabled="isRebuildingCache"
              >
                <Icon name="mdi:cached" class="w-4 h-4" :class="{ 'animate-spin': isRebuildingCache }" />
                {{ isRebuildingCache ? 'Rebuilding...' : 'Refresh Cache' }}
              </button>
            </div>

            <!-- Duplicate scanner shortcut link -->
            <div class="p-5 flex items-center justify-between gap-4">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center text-info border border-info/10 shrink-0 mt-0.5">
                  <Icon name="mdi:content-copy" class="w-4 h-4" />
                </div>
                <div>
                  <h4 class="text-xs font-extrabold tracking-wide">Duplicate Media Scanner</h4>
                  <p class="text-[9px] text-base-content/40 font-bold uppercase tracking-widest mt-0.5">Find matching checksum assets</p>
                </div>
              </div>
              <NuxtLink 
                to="/duplicates" 
                class="btn btn-ghost border border-base-content/10 bg-base-200/40 rounded-xl h-10 min-h-0 px-4 font-bold text-[10px] uppercase tracking-widest shrink-0"
              >
                <Icon name="mdi:arrow-right" class="w-4 h-4" />
                Open tool
              </NuxtLink>
            </div>

            <!-- Duplicate scan limit -->
            <div class="p-5 flex items-center justify-between gap-4">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/10 shrink-0 mt-0.5">
                  <Icon name="mdi:numeric-10-box" class="w-4 h-4" />
                </div>
                <div>
                  <h4 class="text-xs font-extrabold tracking-wide">Duplicate Scan Limit</h4>
                  <p class="text-[9px] text-base-content/40 font-bold uppercase tracking-widest mt-0.5">Max duplicate groups displayed (10 to 1000)</p>
                </div>
              </div>
              <input 
                v-model.number="maxDuplicateResults" 
                type="number" 
                min="10" 
                max="1000" 
                @change="saveUserSettings"
                class="input input-bordered w-24 h-10 min-h-0 text-xs font-bold text-center bg-base-200/50 focus:bg-base-100 rounded-xl border-base-content/5" 
              />
            </div>
          </div>

          <!-- Diagnostics Loading/Scanning State details -->
          <div v-if="isScanningStorage" class="bg-base-100/60 border border-base-content/5 rounded-2xl p-8 flex flex-col items-center gap-4 animate-in fade-in duration-300">
            <span class="loading loading-spinner loading-md text-primary"></span>
            <div class="text-center">
              <p class="text-[10px] font-bold uppercase tracking-widest text-base-content/70">Analyzing Storage Cluster</p>
              <p class="text-[9px] font-bold text-base-content/30 mt-1 uppercase">{{ cleanupStatus?.totalFiles || 0 }} files discovered</p>
            </div>
          </div>

          <!-- Diagnostics Scan details output list -->
          <div v-if="cleanupData && !isScanningStorage" class="bg-base-100/60 border border-base-content/5 rounded-2xl p-6 space-y-4 animate-in fade-in duration-300">
            <h3 class="text-xs font-black uppercase tracking-wider text-base-content/60">Large Files Diagnostics</h3>
            <div class="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2 divide-y divide-base-content/5">
              <div v-for="file in cleanupData.largeFiles" :key="file.fullPath" class="flex items-center justify-between py-2 group">
                <div class="min-w-0 flex-1">
                   <p class="text-xs font-extrabold truncate">{{ file.name }}</p>
                   <p class="text-[9px] font-bold text-base-content/30 uppercase truncate mt-0.5">{{ formatSize(file.size) }}</p>
                </div>
                <button class="btn btn-ghost btn-circle btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity" @click="deleteCleanupFile(file)">
                  <Icon name="mdi:delete-outline" class="w-4 h-4" />
                </button>
              </div>
              <div v-if="cleanupData.largeFiles.length === 0" class="text-center py-8 text-[9px] font-bold text-base-content/30 uppercase tracking-widest italic">No optimization targets</div>
            </div>
          </div>
        </div>

        <!-- 3. APPEARANCE & TAGS SUB-MENU -->
        <div v-if="activeCategory === 'appearance'" class="space-y-6">
          <!-- Themes Selection Section -->
          <div class="bg-base-100/60 backdrop-blur-md border border-base-content/5 rounded-2xl p-6 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                <Icon name="mdi:palette-outline" class="w-4 h-4" />
              </div>
              <h3 class="text-xs font-black uppercase tracking-wider text-base-content/60">Visual Themes</h3>
            </div>
            
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              <div 
                v-for="t in ['onedev', 'light', 'dark', 'dracula', 'forest', 'retro', 'cyberpunk', 'valentine', 'aqua', 'nord', 'sunset', 'dim', 'coffee']" 
                :key="t"
                class="relative group cursor-pointer"
                @click="theme = t; saveUserSettings()"
              >
                <div 
                  class="h-16 rounded-xl border transition-all overflow-hidden flex flex-col"
                  :class="theme === t ? 'border-primary ring-2 ring-primary/20 shadow-sm' : 'border-base-content/5 hover:border-base-content/20 bg-base-200/50'"
                  :data-theme="t"
                >
                  <div class="flex-1 bg-base-100 p-2 flex items-center justify-between">
                     <span class="text-[9px] font-black uppercase tracking-widest text-base-content/70">
                       {{ t }}
                     </span>
                     <div class="flex gap-0.5">
                        <div class="w-1.5 h-1.5 rounded-full bg-primary"></div>
                        <div class="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                        <div class="w-1.5 h-1.5 rounded-full bg-accent"></div>
                     </div>
                  </div>
                </div>
                <div v-if="theme === t" class="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-content rounded-full flex items-center justify-center shadow-md animate-in zoom-in duration-200">
                  <Icon name="mdi:check" class="w-2.5 h-2.5" />
                </div>
              </div>
            </div>
          </div>

          <!-- Tag Library Card -->
          <div class="bg-base-100/60 backdrop-blur-md border border-base-content/5 rounded-2xl p-6 space-y-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center text-success border border-success/10">
                  <Icon name="mdi:tag-multiple-outline" class="w-4 h-4" />
                </div>
                <h3 class="text-xs font-black uppercase tracking-wider text-base-content/60">Predefined Tag Library</h3>
              </div>
              <span class="badge badge-sm font-bold text-[9px] uppercase tracking-widest bg-base-200 text-base-content/40 border-none">{{ tags.length }} Active</span>
            </div>

            <!-- Tag Pill Items -->
            <div class="flex flex-wrap gap-2 p-4 bg-base-200/30 rounded-xl border border-base-content/5 min-h-[70px] items-start content-start">
              <transition-group name="list">
                <div 
                  v-for="(tag, index) in tags" 
                  :key="tag.name" 
                  class="flex items-center gap-1.5 pl-2.5 pr-1 py-0.5 rounded-md text-white font-extrabold text-[8px] uppercase tracking-wider shadow-sm border border-white/10"
                  :style="{ backgroundColor: tag.color }"
                >
                  {{ tag.name }}
                  <button @click="removeTag(index)" class="w-3.5 h-3.5 rounded bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors">
                    <Icon name="mdi:close" class="w-2.5 h-2.5" />
                  </button>
                </div>
              </transition-group>
              <div v-if="tags.length === 0" class="w-full h-full flex flex-col items-center justify-center py-4 gap-2 opacity-30">
                 <Icon name="mdi:tag-off-outline" class="w-6 h-6" />
                 <p class="text-[9px] font-bold uppercase tracking-widest">No tags defined yet</p>
              </div>
            </div>

            <!-- New Tag Inputs -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div class="form-control">
                <label class="label py-1">
                  <span class="label-text font-bold text-[9px] uppercase tracking-widest text-base-content/40">Label Name</span>
                </label>
                <input 
                  v-model="newTagName" 
                  type="text" 
                  placeholder="e.g. Archives" 
                  class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-xs h-10 rounded-xl border-base-content/5 focus:outline-none" 
                />
              </div>
              <div class="form-control">
                <label class="label py-1">
                  <span class="label-text font-bold text-[9px] uppercase tracking-widest text-base-content/40">Label Color</span>
                </label>
                <div class="flex gap-2">
                  <input 
                    v-model="newTagColor" 
                    type="color" 
                    class="w-10 h-10 rounded-xl cursor-pointer border-none bg-base-200/50 shrink-0" 
                  />
                  <input 
                    v-model="newTagColor" 
                    type="text" 
                    class="input input-bordered flex-1 bg-base-200/50 focus:bg-base-100 transition-all font-mono text-[9px] font-bold h-10 rounded-xl border-base-content/5 focus:outline-none" 
                  />
                </div>
              </div>
            </div>
            
            <button 
              class="btn btn-secondary text-white rounded-xl h-10 min-h-0 w-full shadow-sm gap-2 font-bold text-[10px] uppercase tracking-widest mt-2" 
              @click="addTag" 
              :disabled="isSavingTags"
            >
              <Icon name="mdi:tag-plus" class="w-4 h-4" />
              Register New Tag
            </button>
          </div>
        </div>

        <!-- 4. MEDIA PROCESSING SUB-MENU -->
        <div v-if="activeCategory === 'previews'" class="space-y-6">
          <!-- Loading Skeleton -->
          <div v-if="isLoadingSettings" class="bg-base-100/60 backdrop-blur-md border border-base-content/5 rounded-2xl p-6 space-y-6 animate-pulse">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-base-content/10"></div>
                <div class="space-y-2">
                  <div class="h-3 w-32 bg-base-content/10 rounded"></div>
                  <div class="h-2 w-48 bg-base-content/5 rounded"></div>
                </div>
              </div>
              <div class="w-10 h-6 bg-base-content/10 rounded-md"></div>
            </div>
            <div class="space-y-3 pt-4 border-t border-base-content/5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-base-content/10"></div>
                  <div class="space-y-2">
                    <div class="h-3 w-32 bg-base-content/10 rounded"></div>
                    <div class="h-2 w-48 bg-base-content/5 rounded"></div>
                  </div>
                </div>
                <div class="w-12 h-4 bg-base-content/10 rounded-full"></div>
              </div>
              <div class="h-2 bg-base-content/10 rounded-full w-full"></div>
            </div>
            <div class="space-y-3 pt-4 border-t border-base-content/5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-base-content/10"></div>
                  <div class="space-y-2">
                    <div class="h-3 w-32 bg-base-content/10 rounded"></div>
                    <div class="h-2 w-48 bg-base-content/5 rounded"></div>
                  </div>
                </div>
                <div class="w-12 h-4 bg-base-content/10 rounded-full"></div>
              </div>
              <div class="h-2 bg-base-content/10 rounded-full w-full"></div>
            </div>
          </div>

          <!-- Media processing items styled as iOS lists -->
          <div v-else class="bg-base-100/60 backdrop-blur-md border border-base-content/5 rounded-2xl overflow-hidden shadow-sm divide-y divide-base-content/5">
            
            <!-- Mobile Auto-Preview -->
            <div class="flex items-center justify-between p-5 gap-4">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/10 shrink-0 mt-0.5">
                  <Icon name="mdi:cellphone-play" class="w-4 h-4" />
                </div>
                <div>
                  <h4 class="text-xs font-extrabold tracking-wide text-base-content">Mobile Auto-Preview</h4>
                  <p class="text-[9px] text-base-content/40 font-bold uppercase tracking-widest mt-0.5">Auto-play preview animations on mobile layouts</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                class="toggle toggle-primary toggle-sm rounded-md shrink-0" 
                v-model="mobileAutoPreview" 
                @change="saveUserSettings"
              />
            </div>

            <!-- Image Viewer Mobile Fullscreen -->
            <div class="flex items-center justify-between p-5 gap-4">
              <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/10 shrink-0 mt-0.5">
                  <Icon name="mdi:fullscreen" class="w-4 h-4" />
                </div>
                <div>
                  <h4 class="text-xs font-extrabold tracking-wide text-base-content">Image Viewer Mobile Fullscreen</h4>
                  <p class="text-[9px] text-base-content/40 font-bold uppercase tracking-widest mt-0.5">Automatically open media viewer in fullscreen on mobile devices</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                class="toggle toggle-primary toggle-sm rounded-md shrink-0" 
                v-model="imageViewerMobileFullscreen" 
                @change="saveUserSettings"
              />
            </div>

            <!-- Slideshow Frequency range slider -->
            <div class="p-5 space-y-3">
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/10 shrink-0 mt-0.5">
                    <Icon name="mdi:image-multiple-outline" class="w-4 h-4" />
                  </div>
                  <div>
                    <h4 class="text-xs font-extrabold tracking-wide text-base-content">Slideshow Frequency</h4>
                    <p class="text-[9px] text-base-content/40 font-bold uppercase tracking-widest mt-0.5">Create 1 slideshow every {{ slideshowFrequency }} entries</p>
                  </div>
                </div>
                <span class="badge badge-primary font-bold text-[9px] uppercase tracking-widest shrink-0">{{ slideshowFrequency }} items</span>
              </div>
              <div class="pt-2">
                <input 
                  type="range" 
                  min="2" 
                  max="50" 
                  v-model.number="slideshowFrequency" 
                  class="range range-primary range-xs" 
                  @change="saveUserSettings"
                />
              </div>
            </div>

            <!-- Thread limits slider -->
            <div class="p-5 space-y-3">
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center text-success border border-success/10 shrink-0 mt-0.5">
                    <Icon name="mdi:cpu-64-bit" class="w-4 h-4" />
                  </div>
                  <div>
                    <h4 class="text-xs font-extrabold tracking-wide text-base-content">Max Concurrent Threads</h4>
                    <p class="text-[9px] text-base-content/40 font-bold uppercase tracking-widest mt-0.5">
                      Limit concurrency of background ffmpeg tasks (Detected: {{ cpuCores }} CPU cores, dynamic ceiling: {{ serverMaxConcurrency }} threads)
                    </p>
                  </div>
                </div>
                <span class="badge badge-primary font-bold text-[9px] uppercase tracking-widest shrink-0">{{ maxConcurrentPreviews }} threads</span>
              </div>
              <div class="pt-2">
                <input 
                  type="range" 
                  min="1" 
                  :max="experimentalMode ? 200 : serverMaxConcurrency" 
                  v-model.number="maxConcurrentPreviews" 
                  class="range range-primary range-xs" 
                  @change="saveUserSettings"
                />
              </div>
            </div>
          </div>

          <!-- Thread generation tasks progress widgets -->
          <div 
            v-if="(generationResults && (generationResults.isProcessing || generationResults.processed > 0)) || (thumbnailGenerationResults && (thumbnailGenerationResults.isProcessing || thumbnailGenerationResults.processed > 0))" 
            class="bg-base-100/60 border border-base-content/5 rounded-2xl p-6 space-y-6"
          >
            <h3 class="text-xs font-black uppercase tracking-wider text-base-content/60">Background Tasks</h3>
            
            <!-- Video preview tasks progress -->
            <div v-if="generationResults && (generationResults.isProcessing || generationResults.processed > 0)" class="space-y-3 animate-in fade-in duration-300">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-[9px] font-bold uppercase tracking-widest">Video previews progress</span>
                  <span v-if="generationResults.isProcessing" class="loading loading-spinner loading-[10px] text-primary"></span>
                </div>
                <span class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">{{ generationResults.processed }} / {{ generationResults.total }}</span>
              </div>
              
              <div class="h-1.5 w-full bg-base-300 rounded-full overflow-hidden">
                <div 
                  class="h-full bg-primary transition-all duration-500 ease-out" 
                  :style="{ width: `${(generationResults.processed / (generationResults.total || 1)) * 100}%` }"
                ></div>
              </div>

              <div class="grid grid-cols-3 gap-2 pt-1 border-t border-base-content/5 mt-2">
                <div class="flex flex-col">
                  <span class="text-[8px] font-bold uppercase tracking-widest text-base-content/30">Created</span>
                  <span class="text-[10px] font-black text-success">{{ generationResults.generated }}</span>
                </div>
                <div class="flex flex-col border-l border-base-content/5 pl-3">
                  <span class="text-[8px] font-bold uppercase tracking-widest text-base-content/30">Skipped</span>
                  <span class="text-[10px] font-black text-base-content/50">{{ generationResults.skipped }}</span>
                </div>
                <div class="flex flex-col border-l border-base-content/5 pl-3">
                  <span class="text-[8px] font-bold uppercase tracking-widest text-base-content/30">Errors</span>
                  <span class="text-[10px] font-black text-error">{{ generationResults.errors }}</span>
                </div>
              </div>
            </div>

            <!-- Image thumbnail tasks progress -->
            <div v-if="thumbnailGenerationResults && (thumbnailGenerationResults.isProcessing || thumbnailGenerationResults.processed > 0)" class="space-y-3 animate-in fade-in duration-300">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-[9px] font-bold uppercase tracking-widest">Image thumbnails progress</span>
                  <span v-if="thumbnailGenerationResults.isProcessing" class="loading loading-spinner loading-[10px] text-primary"></span>
                </div>
                <span class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">{{ thumbnailGenerationResults.processed }} / {{ thumbnailGenerationResults.total }}</span>
              </div>
              
              <div class="h-1.5 w-full bg-base-300 rounded-full overflow-hidden">
                <div 
                  class="h-full bg-primary transition-all duration-500 ease-out" 
                  :style="{ width: `${(thumbnailGenerationResults.processed / (thumbnailGenerationResults.total || 1)) * 100}%` }"
                ></div>
              </div>

              <div class="grid grid-cols-3 gap-2 pt-1 border-t border-base-content/5 mt-2">
                <div class="flex flex-col">
                  <span class="text-[8px] font-bold uppercase tracking-widest text-base-content/30">Created</span>
                  <span class="text-[10px] font-black text-success">{{ thumbnailGenerationResults.generated }}</span>
                </div>
                <div class="flex flex-col border-l border-base-content/5 pl-3">
                  <span class="text-[8px] font-bold uppercase tracking-widest text-base-content/30">Skipped</span>
                  <span class="text-[10px] font-black text-base-content/50">{{ thumbnailGenerationResults.skipped }}</span>
                </div>
                <div class="flex flex-col border-l border-base-content/5 pl-3">
                  <span class="text-[8px] font-bold uppercase tracking-widest text-base-content/30">Errors</span>
                  <span class="text-[10px] font-black text-error">{{ thumbnailGenerationResults.errors }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Ffmpeg compiler trigger buttons -->
          <div class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                class="btn btn-primary rounded-xl h-11 min-h-0 shadow-sm gap-2 font-bold text-[10px] uppercase tracking-widest" 
                @click="generateAllPreviews" 
                :disabled="isGeneratingPreviews || isGeneratingThumbnails || isClearingPreviews"
              >
                <Icon v-if="!isGeneratingPreviews" name="mdi:movie-filter-outline" class="w-4 h-4" />
                <span v-else class="loading loading-spinner loading-xs"></span>
                Generate video previews
              </button>
              <button 
                class="btn btn-primary rounded-xl h-11 min-h-0 shadow-sm gap-2 font-bold text-[10px] uppercase tracking-widest" 
                @click="generateAllThumbnails" 
                :disabled="isGeneratingPreviews || isGeneratingThumbnails || isClearingPreviews"
              >
                <Icon v-if="!isGeneratingThumbnails" name="mdi:image-filter-hdr" class="w-4 h-4" />
                <span v-else class="loading loading-spinner loading-xs"></span>
                Generate image thumbs
              </button>
            </div>
            <button 
              class="btn btn-error rounded-xl h-11 min-h-0 shadow-sm gap-2 font-bold text-[10px] uppercase tracking-widest text-white w-full" 
              @click="clearAllPreviews" 
              :disabled="isGeneratingPreviews || isGeneratingThumbnails || isClearingPreviews"
            >
              <Icon v-if="!isClearingPreviews" name="mdi:trash-can-outline" class="w-4 h-4" />
              <span v-else class="loading loading-spinner loading-xs"></span>
              Clear previews & cache
            </button>
          </div>
        </div>

        <!-- 5. DIRECTORY RULES SUB-MENU -->
        <div v-if="activeCategory === 'directories'" class="space-y-6">
          <!-- Shorts Selection compilation feeds -->
          <div class="bg-base-100/60 backdrop-blur-md border border-base-content/5 rounded-2xl p-6 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                <Icon name="mdi:play-box-outline" class="w-4 h-4" />
              </div>
              <h3 class="text-xs font-black uppercase tracking-wider text-base-content/60">Shorts Sources</h3>
            </div>
            <p class="text-[11px] text-base-content/50 font-bold leading-relaxed mb-2">
              Select directories from which to show short video loops.
            </p>

            <div class="space-y-2 pt-2">
              <div 
                v-for="(path, index) in selectedShortsPaths" 
                :key="path" 
                class="flex items-center justify-between p-3.5 bg-base-200/50 rounded-xl border border-base-content/5 group"
              >
                <div class="min-w-0 flex-1">
                   <p class="text-xs font-extrabold truncate text-base-content">{{ path }}</p>
                </div>
                <button class="btn btn-ghost btn-circle btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity" @click="removeSelectedPath(index)">
                  <Icon name="mdi:delete-outline" class="w-4 h-4" />
                </button>
              </div>
              <div v-if="selectedShortsPaths.length === 0" class="text-center py-6 text-[9px] font-bold text-base-content/30 uppercase tracking-widest italic">No shorts targets configured</div>
            </div>
          </div>

          <!-- Media Exclusion paths list -->
          <div class="bg-base-100/60 backdrop-blur-md border border-base-content/5 rounded-2xl p-6 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 border border-orange-500/10">
                <Icon name="mdi:eye-off-outline" class="w-4 h-4" />
              </div>
              <h3 class="text-xs font-black uppercase tracking-wider text-base-content/60">Excluded Media Paths</h3>
            </div>
            <p class="text-[11px] text-base-content/50 font-bold leading-relaxed mb-2">
              Directories excluded from visual indices. Content within these folders is hidden.
            </p>

            <div class="space-y-2 pt-2">
              <div 
                v-for="(path, index) in excludedMediaPaths" 
                :key="path" 
                class="flex items-center justify-between p-3.5 bg-base-200/50 rounded-xl border border-base-content/5 group"
              >
                <div class="min-w-0 flex-1">
                   <p class="text-xs font-extrabold truncate text-base-content">{{ path }}</p>
                </div>
                <button class="btn btn-ghost btn-circle btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity" @click="removeExcludedMediaPath(index)">
                  <Icon name="mdi:delete-outline" class="w-4 h-4" />
                </button>
              </div>
              <div v-if="excludedMediaPaths.length === 0" class="text-center py-6 text-[9px] font-bold text-base-content/30 uppercase tracking-widest italic">No exclusions configured</div>
            </div>
          </div>
        </div>

      </div>

    </main>

    <footer class="pt-8 opacity-20 flex flex-col items-center gap-2 mt-auto">
       <div class="w-10 h-px bg-base-content"></div>
       <p class="text-[8px] font-bold uppercase tracking-[0.4em]">ClyoCloud - v{{ useRuntimeConfig().public.version }}</p>
    </footer>
  </div>
</template>

<style scoped>
.list-enter-active, .list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from, .list-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

input[type="color"]::-webkit-color-swatch-wrapper {
	padding: 0;
}
input[type="color"]::-webkit-color-swatch {
	border: none;
  border-radius: 12px;
}
</style>
