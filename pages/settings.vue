<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'
import { startOperation, updateOperation, completeOperation, failOperation } from '~/core/progressManager'
import type { Tag } from '~/types/File'
import { useState } from 'nuxt/app'

const newPassword = ref('')
const confirmPassword = ref('')
const isChangingPassword = ref(false)

const downloadPath = ref('')
const mobileAutoPreview = ref(true)
const maxConcurrentPreviews = ref(3)
const slideshowFrequency = ref(5)
const experimentalMode = ref(false)
const excludedShortsPaths = ref<string[]>([])
const theme = useState<string>('currentTheme')
const isSavingSettings = ref(false)
const isRebuildingCache = ref(false)

const removeExcludedPath = async (index: number) => {
  excludedShortsPaths.value.splice(index, 1)
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
      maxConcurrentPreviews.value = data.maxConcurrentPreviews || 3
      slideshowFrequency.value = data.slideshowFrequency || 5
      experimentalMode.value = data.experimentalMode || false
      excludedShortsPaths.value = data.excludedShortsPaths || []
      theme.value = data.theme || 'onedev'

    }
  } catch (err) {
    console.error('Error fetching user settings:', err)
  }
}

onMounted(() => {
  fetchTags()
  fetchUserSettings()
  fetch2faStatus()
  fetchGenerationStatus() // Check if a task is already running
})

onUnmounted(() => {
  if (statusPollingInterval) clearInterval(statusPollingInterval)
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
        maxConcurrentPreviews: maxConcurrentPreviews.value,
        slideshowFrequency: slideshowFrequency.value,
        experimentalMode: experimentalMode.value,
        excludedShortsPaths: excludedShortsPaths.value,
        theme: theme.value,

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

async function clearAllPreviews() {
  if (!confirm('Are you sure you want to delete ALL generated previews? This cannot be undone.')) return
  
  isClearingPreviews.value = true
  try {
    const response = await fetch('/api/previews-clear', {
      method: 'POST',
      credentials: 'include'
    })

    if (!response.ok) throw new Error('Failed to clear previews')
    
    generationResults.value = null
    createNotification('All previews cleared successfully', NotificationType.SUCCESS)
  } catch (err) {
    console.error(err)
    createNotification('Failed to clear previews', NotificationType.ERROR)
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
                <Icon name="mdi:cog-outline" class="text-primary w-5 h-5" />
                Settings
              </h1>
            </div>
            <p class="text-[9px] md:text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">Configuration & Identity</p>
          </div>
        </div>
      </div>
    </header>

    <main class="w-full max-w-[1200px] mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        <!-- Left Column: Core & System -->
        <div class="space-y-6">
          <div class="flex items-center gap-3 px-2">
             <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
               <Icon name="mdi:shield-lock-outline" class="text-primary w-5 h-5" />
             </div>
             <h2 class="text-xs font-bold uppercase tracking-[0.2em] text-base-content/40">Security & Core</h2>
          </div>

          <!-- Password Section -->
          <section class="bg-base-100 rounded-xl shadow-sm border border-base-content/10 overflow-hidden">
             <div class="p-8 sm:p-10">
               <h3 class="text-base font-bold tracking-tight mb-6 text-base-content">Update Password</h3>
               
               <div class="space-y-4">
                 <div class="form-control">
                   <label class="label py-1">
                     <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">New Secret Key</span>
                   </label>
                   <input 
                     v-model="newPassword" 
                     type="password" 
                     placeholder="Min. 6 characters" 
                     class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-xs h-11 rounded-lg border-base-content/10" 
                   />
                 </div>
                 
                 <div class="form-control">
                   <label class="label py-1">
                     <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">Confirm Secret Key</span>
                   </label>
                   <input 
                     v-model="confirmPassword" 
                     type="password" 
                     class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-xs h-11 rounded-lg border-base-content/10" 
                   />
                 </div>

                 <div class="pt-6">
                   <button 
                     class="btn btn-primary btn-block h-11 rounded-lg shadow-sm gap-2 font-bold text-[10px] uppercase tracking-widest" 
                     @click="changePassword" 
                     :disabled="isChangingPassword"
                   >
                     <Icon v-if="!isChangingPassword" name="mdi:check-circle-outline" class="w-4 h-4" />
                     <span v-else class="loading loading-spinner loading-xs"></span>
                     Update Credentials
                   </button>
                 </div>
               </div>
             </div>
          </section>

          <!-- 2FA Section -->
          <section class="bg-base-100 rounded-xl shadow-sm border border-base-content/10 overflow-hidden">
            <div class="p-8 sm:p-10">
              <div class="flex items-center justify-between mb-6">
                <h3 class="text-base font-bold tracking-tight text-base-content">Two-Factor Auth</h3>
                <div :class="`px-3 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest ${is2faEnabled ? 'bg-success/10 text-success' : 'bg-base-200 text-base-content/40'}`">
                  {{ is2faEnabled ? 'Enabled' : 'Disabled' }}
                </div>
              </div>

              <div v-if="!is2faEnabled">
                <p class="text-[11px] font-bold text-base-content/50 mb-6 leading-relaxed">
                  Enhance your account security by requiring a code from your authenticator app when signing in.
                </p>
                <button 
                  v-if="!show2faSetup"
                  class="btn btn-outline btn-primary btn-block h-11 rounded-lg gap-2 font-bold text-[10px] uppercase tracking-widest"
                  @click="setup2fa"
                >
                  <Icon name="mdi:shield-plus-outline" class="w-4 h-4" />
                  Configure 2FA
                </button>

                <div v-else class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div class="flex flex-col items-center gap-4 p-4 bg-base-200/50 rounded-lg">
                    <img :src="qrCodeUrl" class="w-40 h-40 rounded-lg shadow-sm" alt="2FA QR Code" />
                    <div class="text-center">
                      <p class="text-[9px] font-bold uppercase tracking-widest text-base-content/30 mb-1">Manual Entry Code</p>
                      <code class="text-[10px] font-mono font-bold tracking-wider text-base-content/60">{{ totpSecret }}</code>
                    </div>
                  </div>

                  <div class="form-control">
                    <label class="label py-1">
                      <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">Verification Code</span>
                    </label>
                    <input 
                      v-model="totpCode"
                      type="text"
                      placeholder="000 000"
                      class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-center text-lg tracking-[0.3em] h-11 rounded-lg border-base-content/10"
                      maxlength="6"
                    />
                  </div>

                  <div class="flex gap-3">
                    <button class="btn btn-ghost flex-1 h-11 rounded-lg font-bold text-[10px] uppercase tracking-widest" @click="show2faSetup = false">Cancel</button>
                    <button 
                      class="btn btn-primary flex-1 h-11 rounded-lg shadow-sm font-bold text-[10px] uppercase tracking-widest"
                      @click="enable2fa"
                      :disabled="isVerifying2fa || totpCode.length < 6"
                    >
                      <span v-if="isVerifying2fa" class="loading loading-spinner loading-xs"></span>
                      Confirm
                    </button>
                  </div>
                </div>
              </div>

              <div v-else>
                <div v-if="!showDisableConfirm">
                  <p class="text-[11px] font-bold text-base-content/50 mb-6 leading-relaxed">
                    Your account is protected with two-factor authentication. You will need your authenticator app to log in.
                  </p>
                  <button 
                    class="btn btn-error btn-outline btn-block h-11 rounded-lg gap-2 font-bold text-[10px] uppercase tracking-widest"
                    @click="disable2fa"
                  >
                    <Icon name="mdi:shield-off-outline" class="w-4 h-4" />
                    Disable 2FA
                  </button>
                </div>
                
                <div v-else class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div class="p-4 bg-error/5 rounded-lg border border-error/10 text-center">
                    <p class="text-[9px] font-bold text-error uppercase tracking-widest mb-2">Confirm Identity</p>
                    <p class="text-[10px] font-bold text-error/60">Please enter a code from your authenticator to disable security.</p>
                  </div>

                  <div class="form-control">
                    <label class="label py-1">
                      <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">Authenticator Code</span>
                    </label>
                    <input 
                      v-model="disableCode"
                      type="text"
                      placeholder="000 000"
                      class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-center text-lg tracking-[0.3em] h-11 rounded-lg border-base-content/10"
                      maxlength="6"
                    />
                  </div>

                  <div class="flex gap-3">
                    <button class="btn btn-ghost flex-1 h-11 rounded-lg font-bold text-[10px] uppercase tracking-widest" @click="showDisableConfirm = false">Cancel</button>
                    <button 
                      class="btn btn-error flex-1 h-11 rounded-lg shadow-sm font-bold text-[10px] uppercase tracking-widest"
                      @click="confirmDisable2fa"
                      :disabled="isVerifying2fa || disableCode.length < 6"
                    >
                      <span v-if="isVerifying2fa" class="loading loading-spinner loading-xs"></span>
                      Disable Now
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>



          <!-- Download Configuration -->
          <section class="bg-base-100 rounded-xl shadow-sm border border-base-content/10 overflow-hidden">
             <div class="p-8 sm:p-10">
               <h3 class="text-base font-bold tracking-tight mb-6 text-base-content">Download Preferences</h3>
               <div class="form-control">
                 <label class="label py-1">
                   <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">Custom Retrieval Path</span>
                 </label>
                 <div class="flex flex-col sm:flex-row gap-3">
                   <div class="flex-1 flex items-center bg-base-200/50 border border-base-content/10 rounded-lg focus-within:bg-base-100 focus-within:ring-1 focus-within:ring-primary/30 transition-all overflow-hidden px-4">
                      <span class="text-base-content/30 text-[11px] font-bold whitespace-nowrap select-none">
                        {{ user?.name }}/
                      </span>
                      <input 
                        v-model="downloadPath" 
                        type="text" 
                        placeholder="e.g. videos/youtube" 
                        class="bg-transparent border-none outline-none w-full font-bold text-xs h-11 pl-1 focus:ring-0" 
                      />
                   </div>
                   <button 
                     class="btn btn-primary h-11 rounded-lg px-8 shadow-sm gap-2 font-bold text-[10px] uppercase tracking-widest" 
                     @click="saveUserSettings" 
                     :disabled="isSavingSettings"
                   >
                     <Icon v-if="!isSavingSettings" name="mdi:content-save-outline" class="w-4 h-4" />
                     <span v-else class="loading loading-spinner loading-xs"></span>
                     Save
                   </button>
                 </div>
                 <p class="mt-3 text-[9px] font-bold text-base-content/40 px-2 italic uppercase tracking-wider">Relative to your root storage. Leave empty for root.</p>
               </div>
             </div>
          </section>

          <!-- Danger Zone -->
          <section class="bg-error/5 rounded-xl border border-error/10 p-8 sm:p-10">
            <h3 class="text-[10px] font-bold uppercase tracking-[0.2em] text-error/60 mb-6">Session Control</h3>
            <div class="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div class="text-center sm:text-left">
                <p class="text-sm font-bold tracking-tight text-base-content">Terminate Session</p>
                <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest mt-1">Disconnect from media cluster</p>
              </div>
              <button class="btn btn-error btn-outline h-11 px-8 rounded-lg font-bold uppercase text-[10px] tracking-widest" @click="logout">
                Sign Out
              </button>
            </div>
          </section>
        </div>

        <!-- Right Column: Features & Maintenance -->
        <div class="space-y-6">
          <div class="flex items-center gap-3 px-2">
             <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
               <Icon name="mdi:palette-outline" class="text-primary w-5 h-5" />
             </div>
             <h2 class="text-xs font-bold uppercase tracking-[0.2em] text-base-content/40">Interface</h2>
          </div>

          <!-- Themes Section -->
          <section class="bg-base-100 rounded-xl shadow-sm border border-base-content/10 overflow-hidden">
            <div class="p-8 sm:p-10">
              <h3 class="text-base font-bold tracking-tight mb-6 text-base-content">Visual Identity</h3>
              <p class="text-[11px] font-bold text-base-content/50 mb-8 leading-relaxed">
                Customize the visual Chroma of your workspace.
              </p>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div 
                  v-for="t in ['onedev', 'light', 'dark', 'dracula', 'forest', 'retro', 'cyberpunk', 'valentine', 'aqua', 'nord', 'sunset', 'dim', 'coffee']" 
                  :key="t"
                  class="relative group cursor-pointer"
                  @click="theme = t; saveUserSettings()"
                >
                  <div 
                    class="h-20 rounded-lg border transition-all overflow-hidden flex flex-col"
                    :class="theme === t ? 'border-primary ring-2 ring-primary/20 shadow-sm' : 'border-base-content/10 hover:border-base-content/30'"
                    :data-theme="t"
                  >
                    <div class="flex-1 bg-base-100 p-2">
                       <div class="flex gap-1">
                          <div class="w-2 h-2 rounded-full bg-primary"></div>
                          <div class="w-2 h-2 rounded-full bg-secondary"></div>
                          <div class="w-2 h-2 rounded-full bg-accent"></div>
                       </div>
                    </div>
                    <div class="bg-base-200 p-2 text-[8px] font-bold uppercase tracking-widest text-center text-base-content/60">
                      {{ t }}
                    </div>
                  </div>
                  <div v-if="theme === t" class="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary text-primary-content rounded-full flex items-center justify-center shadow-md animate-in zoom-in duration-200">
                    <Icon name="mdi:check" class="w-3 h-3" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Predefined Tags -->
          <section class="bg-base-100 rounded-xl shadow-sm border border-base-content/10 overflow-hidden">
             <div class="p-8 sm:p-10">
               <div class="flex items-center justify-between mb-8">
                 <div>
                   <h3 class="text-base font-bold tracking-tight text-base-content">Tag Library</h3>
                   <p class="text-[11px] font-bold text-base-content/40">Standard labels for classification</p>
                 </div>
                 <div class="bg-base-200/50 px-3 py-1.5 rounded-md text-[9px] font-bold uppercase tracking-widest text-base-content/40 border border-base-content/5">
                   {{ tags.length }} Active
                 </div>
               </div>
               
               <div class="flex flex-wrap gap-2 mb-10 p-5 bg-base-200/30 rounded-lg border border-base-content/5 min-h-[80px] items-start content-start">
                 <transition-group name="list">
                   <div 
                     v-for="(tag, index) in tags" 
                     :key="tag.name" 
                     class="flex items-center gap-2 pl-3 pr-1 py-1 rounded-md text-white font-bold text-[9px] uppercase tracking-wider shadow-sm ring-1 ring-white/10"
                     :style="{ backgroundColor: tag.color }"
                   >
                     {{ tag.name }}
                     <button @click="removeTag(index)" class="w-4 h-4 rounded-sm bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors">
                       <Icon name="mdi:close" class="w-3 h-3" />
                     </button>
                   </div>
                 </transition-group>
                 <div v-if="tags.length === 0" class="w-full h-full flex flex-col items-center justify-center py-4 gap-2 opacity-30">
                    <Icon name="mdi:tag-off-outline" class="w-8 h-8" />
                    <p class="text-[9px] font-bold uppercase tracking-widest text-center">No identities established</p>
                 </div>
               </div>

               <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div class="form-control">
                   <label class="label py-1">
                     <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">Identity Label</span>
                   </label>
                   <input 
                     v-model="newTagName" 
                     type="text" 
                     placeholder="e.g. Archives" 
                     class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-xs h-11 rounded-lg border-base-content/10" 
                   />
                 </div>
                 <div class="form-control">
                   <label class="label py-1">
                     <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">Visual Chroma</span>
                   </label>
                   <div class="flex gap-2">
                     <input 
                       v-model="newTagColor" 
                       type="color" 
                       class="w-11 h-11 rounded-lg cursor-pointer border-none bg-base-200/50" 
                     />
                     <input 
                       v-model="newTagColor" 
                       type="text" 
                       class="input input-bordered flex-1 bg-base-200/50 focus:bg-base-100 transition-all font-mono text-[10px] font-bold h-11 rounded-lg border-base-content/10" 
                     />
                   </div>
                 </div>
               </div>
               
               <div class="mt-8">
                 <button 
                   class="btn btn-secondary btn-block h-12 rounded-lg shadow-sm gap-2 text-white font-bold text-[10px] uppercase tracking-widest" 
                   @click="addTag" 
                   :disabled="isSavingTags"
                 >
                   <Icon name="mdi:tag-plus" class="w-4 h-4" />
                   Create Tag
                 </button>
               </div>
             </div>
          </section>

          <!-- Previews Section -->
          <section class="bg-base-100 rounded-xl shadow-sm border border-base-content/10 overflow-hidden">
             <div class="p-8 sm:p-10">
               <h3 class="text-base font-bold tracking-tight mb-6 text-base-content">Media Processing</h3>

               <div class="space-y-6">
                 <div class="flex items-center justify-between p-4 bg-base-200/50 rounded-lg border border-base-content/5">
                    <div>
                      <p class="text-xs font-bold uppercase tracking-widest text-base-content">Mobile Auto-Preview</p>
                    </div>
                    <input 
                      type="checkbox" 
                      class="toggle toggle-primary toggle-sm rounded-sm" 
                      v-model="mobileAutoPreview" 
                      @change="saveUserSettings"
                    />
                 </div>

                 <div class="space-y-3 p-4 bg-base-200/50 rounded-lg border border-base-content/5">
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="text-xs font-bold uppercase tracking-widest text-base-content">Slideshow Frequency</p>
                        <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">1 slideshow every {{ slideshowFrequency }} items</p>
                      </div>
                      <span class="badge badge-primary font-bold text-[10px]">{{ slideshowFrequency }}</span>
                    </div>
                    <input 
                      type="range" 
                      min="2" 
                      max="50" 
                      v-model.number="slideshowFrequency" 
                      class="range range-primary range-xs" 
                      @change="saveUserSettings"
                    />
                 </div>

                 <div class="space-y-3 p-4 bg-base-200/50 rounded-lg border border-base-content/5">
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="text-xs font-bold uppercase tracking-widest text-base-content">Max Concurrent Threads</p>
                      </div>
                      <span class="badge badge-primary font-bold text-[10px]">{{ maxConcurrentPreviews }}</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      :max="experimentalMode ? 200 : 10" 
                      v-model.number="maxConcurrentPreviews" 
                      class="range range-primary range-xs" 
                      @change="saveUserSettings"
                    />
                 </div>

                 <div v-if="generationResults && (generationResults.isProcessing || generationResults.processed > 0)" class="space-y-3 p-4 bg-base-200/50 rounded-lg border border-base-content/5 animate-in fade-in duration-300">
                   <div class="flex items-center justify-between">
                     <div class="flex items-center gap-2">
                       <span class="text-[9px] font-bold uppercase tracking-widest text-base-content">Generation Progress</span>
                       <span v-if="generationResults.isProcessing" class="loading loading-spinner loading-[10px] text-primary"></span>
                     </div>
                     <span class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">{{ generationResults.processed }} / {{ generationResults.total }}</span>
                   </div>
                   
                   <div class="h-1.5 w-full bg-base-300 rounded-full overflow-hidden">
                     <div 
                       class="h-full bg-primary transition-all duration-500 ease-out" 
                       :style="{ width: `${(generationResults.processed / generationResults.total) * 100}%` }"
                     ></div>
                   </div>

                   <div class="grid grid-cols-3 gap-2 pt-1">
                     <div class="flex flex-col">
                       <span class="text-[8px] font-bold uppercase tracking-widest text-base-content/30">Created</span>
                       <span class="text-[10px] font-bold text-success">{{ generationResults.generated }}</span>
                     </div>
                     <div class="flex flex-col">
                       <span class="text-[8px] font-bold uppercase tracking-widest text-base-content/30">Skipped</span>
                       <span class="text-[10px] font-bold text-base-content/60">{{ generationResults.skipped }}</span>
                     </div>
                     <div class="flex flex-col">
                       <span class="text-[8px] font-bold uppercase tracking-widest text-base-content/30">Errors</span>
                       <span class="text-[10px] font-bold text-error">{{ generationResults.errors }}</span>
                     </div>
                   </div>
                 </div>

                 <div class="flex flex-col sm:flex-row gap-3">
                   <button 
                     class="btn btn-primary flex-1 h-12 rounded-lg shadow-sm gap-2 font-bold text-[10px] uppercase tracking-widest" 
                     @click="generateAllPreviews" 
                     :disabled="isGeneratingPreviews || isClearingPreviews"
                   >
                     <Icon v-if="!isGeneratingPreviews" name="mdi:movie-filter-outline" class="w-4 h-4" />
                     <span v-else class="loading loading-spinner loading-xs"></span>
                     Initialize All
                   </button>
                 </div>
               </div>
             </div>
          </section>

          <!-- Shorts Exclusion -->
          <section class="bg-base-100 rounded-xl shadow-sm border border-base-content/10 overflow-hidden">
             <div class="p-8 sm:p-10">
               <h3 class="text-base font-bold tracking-tight mb-6 text-base-content">Shorts Exclusion</h3>
               <p class="text-[11px] font-bold text-base-content/50 mb-6 leading-relaxed">
                 Manage directories excluded from the Shorts feed.
               </p>

               <div class="space-y-3">
                 <div v-for="(path, index) in excludedShortsPaths" :key="path" class="flex items-center justify-between p-3 bg-base-200/50 rounded-lg border border-base-content/5 group hover:bg-base-200 transition-all">
                    <div class="min-w-0 flex-1">
                       <p class="text-[11px] font-bold truncate text-base-content">{{ path }}</p>
                    </div>
                    <button class="btn btn-ghost btn-circle btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity" @click="removeExcludedPath(index)">
                      <Icon name="mdi:delete-outline" class="w-4 h-4" />
                    </button>
                 </div>
                 <div v-if="excludedShortsPaths.length === 0" class="text-center py-8 text-[9px] font-bold text-base-content/30 uppercase tracking-widest italic">No paths excluded</div>
               </div>
             </div>
          </section>

          <!-- Storage Health -->
          <section class="bg-base-100 rounded-xl shadow-sm border border-base-content/10 overflow-hidden">
             <div class="p-8 sm:p-10">
               <div class="flex items-center justify-between mb-8">
                 <div>
                   <h3 class="text-base font-bold tracking-tight text-base-content">Storage Maintenance</h3>
                   <p class="text-[11px] font-bold text-base-content/40">Optimize cluster efficiency</p>
                 </div>
                 <button 
                  class="btn btn-ghost btn-sm gap-2 border border-base-content/10 bg-base-100/50 rounded-lg h-9"
                  @click="fetchCleanupData"
                  :disabled="isScanningStorage"
                 >
                   <Icon name="mdi:magnify-scan" class="w-4 h-4" :class="{ 'animate-pulse': isScanningStorage }" />
                   <span class="text-[9px] font-bold uppercase tracking-widest">{{ isScanningStorage ? 'Scanning...' : 'Scan Storage' }}</span>
                 </button>
                 <button 
                  class="btn btn-ghost btn-sm gap-2 border border-base-content/10 bg-base-100/50 rounded-lg h-9"
                  @click="refreshTagCache"
                  :disabled="isRebuildingCache"
                 >
                   <Icon name="mdi:cached" class="w-4 h-4" :class="{ 'animate-spin': isRebuildingCache }" />
                   <span class="text-[9px] font-bold uppercase tracking-widest">{{ isRebuildingCache ? 'Rebuilding...' : 'Refresh Tag Cache' }}</span>
                 </button>
               </div>

               <div v-if="isScanningStorage" class="py-10 flex flex-col items-center gap-4 animate-in fade-in duration-300">
                  <div class="w-10 h-10 rounded-full border-2 border-primary/10 border-t-primary animate-spin"></div>
                  <div class="text-center">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-base-content/60">Analyzing Storage Cluster</p>
                    <p class="text-[9px] font-bold text-base-content/30 mt-1 uppercase">{{ cleanupStatus?.totalFiles || 0 }} files discovered</p>
                  </div>
               </div>

               <div v-if="cleanupData && !isScanningStorage" class="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <!-- Large Files Section -->
                  <div class="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                       <div v-for="file in cleanupData.largeFiles" :key="file.fullPath" class="flex items-center justify-between p-3 bg-base-200/50 rounded-lg border border-base-content/5 group hover:bg-base-200 transition-all">
                          <div class="min-w-0 flex-1">
                             <p class="text-[11px] font-bold truncate text-base-content">{{ file.name }}</p>
                             <p class="text-[9px] font-bold text-base-content/30 uppercase truncate">{{ formatSize(file.size) }}</p>
                          </div>
                          <button class="btn btn-ghost btn-circle btn-xs text-error opacity-0 group-hover:opacity-100 transition-opacity" @click="deleteCleanupFile(file)">
                            <Icon name="mdi:delete-outline" class="w-4 h-4" />
                          </button>
                       </div>
                       <div v-if="cleanupData.largeFiles.length === 0" class="text-center py-8 text-[9px] font-bold text-base-content/30 uppercase tracking-widest italic">No optimization targets</div>
                  </div>
               </div>
             </div>
          </section>
        </div>
      </div>
      
      <!-- System Info -->
      <footer class="pt-8 opacity-20 flex flex-col items-center gap-2">
         <div class="w-10 h-px bg-base-content"></div>
         <p class="text-[8px] font-bold uppercase tracking-[0.4em]">ClyoCloud - v{{ useRuntimeConfig().public.version }}</p>
      </footer>
    </main>
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
