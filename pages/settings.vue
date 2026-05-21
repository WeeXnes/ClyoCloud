<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'
import type { Tag } from '~/types/File'
import { useState } from 'nuxt/app'

const newPassword = ref('')
const confirmPassword = ref('')
const isChangingPassword = ref(false)

const downloadPath = ref('')
const mobileAutoPreview = ref(true)
const maxConcurrentPreviews = ref(3)
const tvheadendHost = ref('')
const tvheadendPort = ref('9981')
const tvheadendUser = ref('')
const tvheadendPassword = ref('')
const isSavingSettings = ref(false)

const tags = ref<Tag[]>([])
const newTagName = ref('')
const newTagColor = ref('#4B5EAA')
const isSavingTags = ref(false)

const isGeneratingPreviews = ref(false)
const isClearingPreviews = ref(false)
const generationResults = ref<{ total: number, processed: number, generated: number, skipped: number, errors: number, isProcessing: boolean } | null>(null)
let statusPollingInterval: any = null

const fetchGenerationStatus = async () => {
  try {
    const response = await fetch('/api/previews-status', { credentials: 'include' })
    if (response.ok) {
      const status = await response.json()
      generationResults.value = status
      isGeneratingPreviews.value = status.isProcessing

      if (!status.isProcessing && statusPollingInterval) {
        clearInterval(statusPollingInterval)
        statusPollingInterval = null
        if (status.processed > 0) {
          createNotification(`Bulk generation complete! Processed: ${status.processed}`, NotificationType.SUCCESS)
        }
      }
    }
  } catch (err) {
    console.error('Error fetching generation status:', err)
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
      tvheadendHost.value = data.tvheadendHost || ''
      tvheadendPort.value = data.tvheadendPort || '9981'
      tvheadendUser.value = data.tvheadendUser || ''
      tvheadendPassword.value = data.tvheadendPassword || ''
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
        tvheadendHost: tvheadendHost.value,
        tvheadendPort: tvheadendPort.value,
        tvheadendUser: tvheadendUser.value,
        tvheadendPassword: tvheadendPassword.value
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
    <!-- Edge-to-Edge Sticky Header -->
    <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/5">
      <div class="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3">
          <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden">
            <Icon name="mdi:menu" class="w-5 h-5" />
          </label>
          <div>
            <h1 class="text-xl font-black tracking-tight flex items-center gap-2">
              <Icon name="mdi:cog-outline" class="text-primary w-6 h-6" />
              Settings
            </h1>
            <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">Configuration & Identity</p>
          </div>
        </div>
      </div>
    </header>

    <main class="w-full max-w-[1200px] mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <!-- Account Security -->
        <div class="lg:col-span-5 space-y-6">
          <div class="flex items-center gap-3 px-2">
             <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
               <Icon name="mdi:shield-lock-outline" class="text-primary w-5 h-5" />
             </div>
             <h2 class="text-sm font-black uppercase tracking-[0.2em] text-base-content/40">Security</h2>
          </div>

          <section class="bg-base-100 rounded-[2rem] shadow-xl shadow-base-content/5 border border-base-content/5 overflow-hidden">
             <div class="p-8 sm:p-10">
               <h3 class="text-lg font-black tracking-tight mb-6">Update Password</h3>
               
               <div class="space-y-4">
                 <div class="form-control">
                   <label class="label py-1">
                     <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">New Secret Key</span>
                   </label>
                   <input 
                     v-model="newPassword" 
                     type="password" 
                     placeholder="Min. 6 characters" 
                     class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-sm h-12 rounded-xl border-base-content/10" 
                   />
                 </div>
                 
                 <div class="form-control">
                   <label class="label py-1">
                     <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">Confirm Secret Key</span>
                   </label>
                   <input 
                     v-model="confirmPassword" 
                     type="password" 
                     class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-sm h-12 rounded-xl border-base-content/10" 
                   />
                 </div>

                 <div class="pt-6">
                   <button 
                     class="btn btn-primary btn-block h-12 rounded-xl shadow-lg shadow-primary/20 gap-2" 
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
          <section class="bg-base-100 rounded-[2rem] shadow-xl shadow-base-content/5 border border-base-content/5 overflow-hidden">
            <div class="p-8 sm:p-10">
              <div class="flex items-center justify-between mb-6">
                <h3 class="text-lg font-black tracking-tight">Two-Factor Auth</h3>
                <div :class="`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${is2faEnabled ? 'bg-success/10 text-success' : 'bg-base-200 text-base-content/40'}`">
                  {{ is2faEnabled ? 'Enabled' : 'Disabled' }}
                </div>
              </div>

              <div v-if="!is2faEnabled">
                <p class="text-xs font-medium text-base-content/50 mb-6 leading-relaxed">
                  Enhance your account security by requiring a code from your authenticator app when signing in.
                </p>
                <button 
                  v-if="!show2faSetup"
                  class="btn btn-outline btn-primary btn-block h-12 rounded-xl gap-2 border-2"
                  @click="setup2fa"
                >
                  <Icon name="mdi:shield-plus-outline" class="w-5 h-5" />
                  Configure 2FA
                </button>

                <div v-else class="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div class="flex flex-col items-center gap-4 p-4 bg-base-200/50 rounded-2xl">
                    <img :src="qrCodeUrl" class="w-48 h-48 rounded-lg shadow-sm" alt="2FA QR Code" />
                    <div class="text-center">
                      <p class="text-[10px] font-black uppercase tracking-widest text-base-content/30 mb-1">Manual Entry Code</p>
                      <code class="text-xs font-mono font-bold tracking-wider">{{ totpSecret }}</code>
                    </div>
                  </div>

                  <div class="form-control">
                    <label class="label py-1">
                      <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">Verification Code</span>
                    </label>
                    <input 
                      v-model="totpCode"
                      type="text"
                      placeholder="000 000"
                      class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-center text-lg tracking-[0.3em] h-12 rounded-xl border-base-content/10"
                      maxlength="6"
                    />
                  </div>

                  <div class="flex gap-3">
                    <button class="btn btn-ghost flex-1 h-12 rounded-xl" @click="show2faSetup = false">Cancel</button>
                    <button 
                      class="btn btn-primary flex-1 h-12 rounded-xl shadow-lg shadow-primary/20"
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
                  <p class="text-xs font-medium text-base-content/50 mb-6 leading-relaxed">
                    Your account is protected with two-factor authentication. You will need your authenticator app to log in.
                  </p>
                  <button 
                    class="btn btn-error btn-outline btn-block h-12 rounded-xl gap-2 border-2"
                    @click="disable2fa"
                  >
                    <Icon name="mdi:shield-off-outline" class="w-5 h-5" />
                    Disable 2FA
                  </button>
                </div>
                
                <div v-else class="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div class="p-4 bg-error/5 rounded-2xl border border-error/10 text-center">
                    <p class="text-xs font-bold text-error uppercase tracking-widest mb-2">Confirm Identity</p>
                    <p class="text-[10px] font-medium text-error/60">Please enter a code from your authenticator to disable security.</p>
                  </div>

                  <div class="form-control">
                    <label class="label py-1">
                      <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">Authenticator Code</span>
                    </label>
                    <input 
                      v-model="disableCode"
                      type="text"
                      placeholder="000 000"
                      class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-center text-lg tracking-[0.3em] h-12 rounded-xl border-base-content/10"
                      maxlength="6"
                    />
                  </div>

                  <div class="flex gap-3">
                    <button class="btn btn-ghost flex-1 h-12 rounded-xl" @click="showDisableConfirm = false">Cancel</button>
                    <button 
                      class="btn btn-error flex-1 h-12 rounded-xl shadow-lg shadow-error/20"
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

          <!-- Quick Actions / Danger Zone -->
          <section class="bg-error/5 rounded-[2rem] border border-error/10 p-8 sm:p-10">
            <h3 class="text-xs font-black uppercase tracking-[0.2em] text-error/60 mb-6">Session Control</h3>
            <div class="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div class="text-center sm:text-left">
                <p class="text-sm font-black tracking-tight">Logout everywhere</p>
                <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-1">Disconnect from this device</p>
              </div>
              <button class="btn btn-error btn-outline h-12 px-8 rounded-xl border-2 font-black uppercase text-[11px] tracking-widest" @click="logout">
                Sign Out
              </button>
            </div>
          </section>
        </div>

        <!-- Metadata & Tags -->
        <div class="lg:col-span-7 space-y-6">
          <div class="flex items-center gap-3 px-2">
             <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
               <Icon name="mdi:television-classic" class="text-primary w-5 h-5" />
             </div>
             <h2 class="text-sm font-black uppercase tracking-[0.2em] text-base-content/40">TV Integration</h2>
          </div>

          <section class="bg-base-100 rounded-[2.5rem] shadow-xl shadow-base-content/5 border border-base-content/5 overflow-hidden">
             <div class="p-8 sm:p-10">
               <h3 class="text-lg font-black tracking-tight mb-6">TVHeadend Connection</h3>
               <div class="space-y-4">
                 <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div class="form-control">
                     <label class="label py-1">
                       <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">Host / IP</span>
                     </label>
                     <input 
                       v-model="tvheadendHost" 
                       type="text" 
                       placeholder="e.g. 192.168.1.10" 
                       class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-sm h-12 rounded-xl border-base-content/10" 
                     />
                   </div>
                   <div class="form-control">
                     <label class="label py-1">
                       <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">Port</span>
                     </label>
                     <input 
                       v-model="tvheadendPort" 
                       type="text" 
                       placeholder="9981" 
                       class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-sm h-12 rounded-xl border-base-content/10" 
                     />
                   </div>
                 </div>

                 <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div class="form-control">
                     <label class="label py-1">
                       <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">Username</span>
                     </label>
                     <input 
                       v-model="tvheadendUser" 
                       type="text" 
                       placeholder="tvheadend" 
                       class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-sm h-12 rounded-xl border-base-content/10" 
                     />
                   </div>
                   <div class="form-control">
                     <label class="label py-1">
                       <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">Password</span>
                     </label>
                     <input 
                       v-model="tvheadendPassword" 
                       type="password" 
                       placeholder="••••••••" 
                       class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-sm h-12 rounded-xl border-base-content/10" 
                     />
                   </div>
                 </div>

                 <div class="pt-4">
                   <button 
                     class="btn btn-primary btn-block h-12 rounded-xl shadow-lg shadow-primary/20 gap-2" 
                     @click="saveUserSettings" 
                     :disabled="isSavingSettings"
                   >
                     <Icon v-if="!isSavingSettings" name="mdi:content-save-outline" class="w-4 h-4" />
                     <span v-else class="loading loading-spinner loading-xs"></span>
                     Save Connection Settings
                   </button>
                 </div>
               </div>
             </div>
          </section>

          <div class="flex items-center gap-3 px-2 pt-4">
             <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
               <Icon name="mdi:tag-multiple-outline" class="text-primary w-5 h-5" />
             </div>
             <h2 class="text-sm font-black uppercase tracking-[0.2em] text-base-content/40">Organization</h2>
          </div>

          <section class="bg-base-100 rounded-[2.5rem] shadow-xl shadow-base-content/5 border border-base-content/5 overflow-hidden">
             <div class="p-8 sm:p-10">
               <h3 class="text-lg font-black tracking-tight mb-6">Download Configuration</h3>
               <div class="form-control">
                 <label class="label py-1">
                   <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">Custom Download Path</span>
                 </label>
                 <div class="flex flex-col sm:flex-row gap-3">
                   <div class="flex-1 flex items-center bg-base-200/50 border border-base-content/10 rounded-xl focus-within:bg-base-100 focus-within:ring-1 focus-within:ring-primary/30 transition-all overflow-hidden px-4">
                      <span class="text-base-content/30 text-xs font-bold whitespace-nowrap select-none">
                        {{ user?.name }}/
                      </span>
                      <input 
                        v-model="downloadPath" 
                        type="text" 
                        placeholder="e.g. videos/youtube" 
                        class="bg-transparent border-none outline-none w-full font-bold text-sm h-12 pl-1 focus:ring-0" 
                      />
                   </div>
                   <button 
                     class="btn btn-primary h-12 rounded-xl px-8 shadow-lg shadow-primary/20 gap-2" 
                     @click="saveUserSettings" 
                     :disabled="isSavingSettings"
                   >
                     <Icon v-if="!isSavingSettings" name="mdi:content-save-outline" class="w-4 h-4" />
                     <span v-else class="loading loading-spinner loading-xs"></span>
                     Save
                   </button>
                 </div>
                 <p class="mt-3 text-[10px] font-medium text-base-content/40 px-2 italic">Relative to your root storage folder. Leave empty for root.</p>
               </div>
             </div>
          </section>

          <section class="bg-base-100 rounded-[2.5rem] shadow-xl shadow-base-content/5 border border-base-content/5 overflow-hidden">
             <div class="p-8 sm:p-10">
               <div class="flex items-center justify-between mb-8">
                 <div>
                   <h3 class="text-lg font-black tracking-tight">Bulk Preview Generation</h3>
                   <p class="text-xs font-medium text-base-content/40">Generate previews for all videos at once</p>
                 </div>
               </div>

               <div class="space-y-6">
                 <p class="text-xs font-medium text-base-content/50 leading-relaxed">
                   Scan your entire storage and generate animated GIF previews for all video files. This ensures previews are ready without having to hover over each video manually.
                 </p>

                 <div class="flex items-center justify-between p-4 bg-base-200/50 rounded-2xl border border-base-content/5">
                    <div>
                      <p class="text-xs font-bold uppercase tracking-widest">Mobile Auto-Preview</p>
                      <p class="text-[10px] font-medium text-base-content/40">Automatically play previews when scrolling on mobile</p>
                    </div>
                    <input 
                      type="checkbox" 
                      class="toggle toggle-primary" 
                      v-model="mobileAutoPreview" 
                      @change="saveUserSettings"
                    />
                 </div>

                 <div class="space-y-3 p-4 bg-base-200/50 rounded-2xl border border-base-content/5">
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="text-xs font-bold uppercase tracking-widest">Max Concurrent Processes</p>
                        <p class="text-[10px] font-medium text-base-content/40">Speed up generation with more parallel workers</p>
                      </div>
                      <span class="badge badge-primary font-bold">{{ maxConcurrentPreviews }}</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      v-model.number="maxConcurrentPreviews" 
                      class="range range-primary range-xs" 
                      @change="saveUserSettings"
                    />
                    <div class="flex justify-between px-1 text-[8px] font-bold text-base-content/20 uppercase tracking-tighter">
                      <span>Quiet</span>
                      <span>Balanced</span>
                      <span>Aggressive</span>
                    </div>
                 </div>

                 <div v-if="generationResults && (generationResults.total > 0 || generationResults.isProcessing)" class="space-y-4 animate-in fade-in slide-in-from-top-2">
                   <div v-if="generationResults.isProcessing" class="space-y-2">
                      <div class="flex justify-between items-end">
                        <span class="text-[10px] font-black uppercase tracking-widest text-primary">Processing Library...</span>
                        <span class="text-xs font-bold">{{ Math.round((generationResults.processed / generationResults.total) * 100) }}%</span>
                      </div>
                      <progress class="progress progress-primary w-full h-3 rounded-full bg-base-200" :value="generationResults.processed" :max="generationResults.total"></progress>
                      <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest text-center">
                        {{ generationResults.processed }} of {{ generationResults.total }} videos analyzed
                      </p>
                   </div>

                   <div class="bg-base-200/50 p-6 rounded-2xl border border-base-content/5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div class="flex flex-col">
                      <span class="text-[9px] font-black uppercase tracking-widest text-base-content/30">Total</span>
                      <span class="text-lg font-black">{{ generationResults.total }}</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[9px] font-black uppercase tracking-widest text-success/60">Generated</span>
                      <span class="text-lg font-black text-success">{{ generationResults.generated }}</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[9px] font-black uppercase tracking-widest text-base-content/30">Skipped</span>
                      <span class="text-lg font-black">{{ generationResults.skipped }}</span>
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[9px] font-black uppercase tracking-widest text-error/60">Errors</span>
                      <span class="text-lg font-black text-error">{{ generationResults.errors }}</span>
                    </div>
                   </div>
                 </div>

                 <div class="flex flex-col sm:flex-row gap-3">
                   <button 
                     class="btn btn-primary flex-1 h-14 rounded-2xl shadow-lg gap-3" 
                     @click="generateAllPreviews" 
                     :disabled="isGeneratingPreviews || isClearingPreviews"
                   >
                     <Icon v-if="!isGeneratingPreviews" name="mdi:movie-filter-outline" class="w-5 h-5" />
                     <span v-else class="loading loading-spinner loading-xs"></span>
                     <span class="font-black tracking-tight uppercase text-xs">
                       {{ isGeneratingPreviews ? 'Generating...' : 'Generate All' }}
                     </span>
                   </button>

                   <button 
                     class="btn btn-ghost border-2 border-error/20 text-error flex-1 h-14 rounded-2xl gap-3 hover:bg-error/10 hover:border-error" 
                     @click="clearAllPreviews" 
                     :disabled="isGeneratingPreviews || isClearingPreviews"
                   >
                     <Icon v-if="!isClearingPreviews" name="mdi:delete-sweep-outline" class="w-5 h-5" />
                     <span v-else class="loading loading-spinner loading-xs"></span>
                     <span class="font-black tracking-tight uppercase text-xs">
                       {{ isClearingPreviews ? 'Clearing...' : 'Clear All Previews' }}
                     </span>
                   </button>
                 </div>
               </div>
             </div>
          </section>

          <section class="bg-base-100 rounded-[2.5rem] shadow-xl shadow-base-content/5 border border-base-content/5 overflow-hidden">
             <div class="p-8 sm:p-10">
               <div class="flex items-center justify-between mb-8">
                 <div>
                   <h3 class="text-lg font-black tracking-tight">Predefined Tags</h3>
                   <p class="text-xs font-medium text-base-content/40">Standard labels for your library</p>
                 </div>
                 <div class="bg-base-200/50 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-base-content/40 border border-base-content/5">
                   {{ tags.length }} Active
                 </div>
               </div>
               
               <div class="flex flex-wrap gap-2.5 mb-10 p-6 bg-base-200/50 rounded-[1.5rem] border border-base-content/5 min-h-[100px] items-start content-start">
                 <transition-group name="list">
                   <div 
                     v-for="(tag, index) in tags" 
                     :key="tag.name" 
                     class="flex items-center gap-2 pl-3.5 pr-1.5 py-1.5 rounded-full text-white font-black text-[10px] uppercase tracking-wider shadow-sm ring-1 ring-white/10"
                     :style="{ backgroundColor: tag.color }"
                   >
                     {{ tag.name }}
                     <button @click="removeTag(index)" class="w-5 h-5 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors">
                       <Icon name="mdi:close" class="w-3 h-3" />
                     </button>
                   </div>
                 </transition-group>
                 <div v-if="tags.length === 0" class="w-full h-full flex flex-col items-center justify-center py-4 gap-2 opacity-30">
                    <Icon name="mdi:tag-off-outline" class="w-8 h-8" />
                    <p class="text-[10px] font-black uppercase tracking-widest text-center">No standard tags established</p>
                 </div>
               </div>

               <div class="relative py-4 mb-6">
                 <div class="absolute inset-0 flex items-center">
                   <div class="w-full border-t border-base-content/5"></div>
                 </div>
                 <div class="relative flex justify-center">
                   <span class="bg-base-100 px-4 text-[9px] font-black uppercase tracking-[0.3em] text-base-content/20">Establish New Identity</span>
                 </div>
               </div>

               <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div class="form-control">
                   <label class="label py-1">
                     <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">Identity Label</span>
                   </label>
                   <input 
                     v-model="newTagName" 
                     type="text" 
                     placeholder="e.g. Archives" 
                     class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-sm h-12 rounded-xl border-base-content/10" 
                   />
                 </div>
                 <div class="form-control">
                   <label class="label py-1">
                     <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">Visual Chroma</span>
                   </label>
                   <div class="flex gap-3">
                     <input 
                       v-model="newTagColor" 
                       type="color" 
                       class="w-12 h-12 rounded-xl cursor-pointer border-none bg-base-200/50" 
                     />
                     <input 
                       v-model="newTagColor" 
                       type="text" 
                       class="input input-bordered flex-1 bg-base-200/50 focus:bg-base-100 transition-all font-mono text-[11px] font-bold h-12 rounded-xl border-base-content/10" 
                     />
                   </div>
                 </div>
               </div>
               
               <div class="mt-8">
                 <button 
                   class="btn btn-secondary btn-block h-14 rounded-2xl shadow-lg gap-2 text-white" 
                   @click="addTag" 
                   :disabled="isSavingTags"
                 >
                   <Icon name="mdi:tag-plus" class="w-5 h-5" />
                   <span class="font-black tracking-tight uppercase text-xs">Establish Tag</span>
                 </button>
               </div>
             </div>
          </section>
        </div>
      </div>
      
      <!-- System Info -->
      <footer class="pt-8 opacity-20 flex flex-col items-center gap-2">
         <div class="w-12 h-px bg-base-content"></div>
         <p class="text-[9px] font-black uppercase tracking-[0.4em]">ClyoCloud v{{ useRuntimeConfig().public.version }} • Core Terminal</p>
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
