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
                <Icon name="mdi:cloud-download" class="text-primary w-5 h-5" />
                Downloader
              </h1>
            </div>
            <p class="text-[9px] md:text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">yt-dlp Frontend</p>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 p-4 sm:p-8 max-w-5xl mx-auto w-full space-y-6">
      <!-- Input Section -->
      <div class="p-6 bg-base-100 border border-base-content/10 rounded-xl shadow-sm">
        <h3 class="text-base font-bold tracking-tight mb-4 text-base-content">Start New Download</h3>
        <div class="flex flex-col sm:flex-row gap-3">
          <input 
            v-model="downloadUrl" 
            type="text" 
            placeholder="Paste YouTube, Twitter, or any supported URL..." 
            class="input input-bordered flex-1 bg-base-200/50 focus:bg-base-100 transition-all rounded-lg font-bold text-xs"
            :disabled="isDownloading"
            @keyup.enter="startDownload"
          />
          <button 
            v-if="!isDownloading"
            @click="startDownload" 
            class="btn btn-primary rounded-lg gap-2 shadow-sm font-bold text-[10px] uppercase tracking-widest px-6"
            :disabled="!downloadUrl"
          >
            <Icon name="mdi:download" class="w-4 h-4" />
            Download
          </button>
          <div v-else class="flex gap-2">
            <button 
              @click="stopDownload" 
              class="btn btn-error rounded-lg gap-2 shadow-sm font-bold text-[10px] uppercase tracking-widest px-6"
            >
              <Icon name="mdi:stop-circle" class="w-4 h-4" />
              Stop
            </button>
          </div>
        </div>
      </div>

      <!-- Progress Section -->
      <div v-if="isDownloading || lastDownloadStatus" class="p-6 bg-base-100 border border-base-content/10 rounded-xl shadow-sm space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
              <Icon :name="statusIcon" class="w-5 h-5" :class="{ 'animate-pulse': isDownloading }" />
            </div>
            <div>
              <p class="font-bold text-xs uppercase tracking-wider text-base-content">Retrieving Content</p>
              <p class="text-[9px] text-base-content/40 font-bold uppercase tracking-widest">Active Download Job</p>
            </div>
          </div>
          <div class="flex items-center gap-6">
            <div v-if="progressData.percent" class="text-right">
              <p class="text-xl font-bold text-primary">{{ progressData.percent }}</p>
              <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest">{{ progressData.speed }} • {{ progressData.eta }}</p>
            </div>
            <button v-if="!isDownloading" @click="clearJobState" class="btn btn-ghost btn-xs btn-circle" title="Dismiss">
              <Icon name="mdi:close" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div v-if="isDownloading" class="w-full bg-base-200 rounded-full h-2 overflow-hidden">
          <div 
            class="bg-primary h-full transition-all duration-300 ease-out"
            :style="{ width: progressData.percent || '0%' }"
          ></div>
        </div>
      </div>

      <!-- Terminal / Logs -->
      <div class="bg-[#0d1117] rounded-xl overflow-hidden shadow-lg border border-white/5 flex flex-col h-[500px]">
        <div class="bg-white/5 px-6 py-2.5 flex items-center justify-between border-b border-white/5">
          <div class="flex items-center gap-2">
            <div class="flex gap-1.5">
              <div class="w-2.5 h-2.5 rounded-full bg-error/50"></div>
              <div class="w-2.5 h-2.5 rounded-full bg-warning/50"></div>
              <div class="w-2.5 h-2.5 rounded-full bg-success/50"></div>
            </div>
            <span class="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] ml-2">yt-dlp-output.log</span>
          </div>
          <button @click="logs = []" class="text-[9px] font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest">Clear</button>
        </div>
        
        <div ref="logContainer" class="flex-1 overflow-y-auto p-6 font-mono text-[11px] space-y-1 custom-scrollbar">
          <div v-if="logs.length === 0" class="text-white/20 italic">Awaiting download...</div>
          <div v-for="(log, index) in logs" :key="index" :class="{
            'text-blue-400': log.type === 'info',
            'text-green-400': log.type === 'success',
            'text-red-400': log.type === 'error',
            'text-gray-400': log.type === 'log',
            'text-yellow-400': log.type === 'warning'
          }" class="break-all">
            <span class="opacity-30 mr-2">[{{ log.time }}]</span>
            {{ log.message }}
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'

const downloadUrl = ref('')
const isDownloading = ref(false)
const lastDownloadStatus = ref<'success' | 'error' | 'cancelled' | null>(null)
const logs = ref<{ type: string, message: string }[]>([])
const logContainer = ref<HTMLElement | null>(null)
const detectedFilename = ref('')

const progressData = ref({
  bytes: '',
  total: '',
  eta: '',
  speed: '',
  percent: '',
  playlistIndex: null as number | null,
  playlistCount: null as number | null
})

let pollInterval: any = null

const statusIcon = computed(() => {
  if (isDownloading.value) return 'mdi:sync'
  if (lastDownloadStatus.value === 'success') return 'mdi:check-decagram'
  if (lastDownloadStatus.value === 'error') return 'mdi:alert-circle'
  if (lastDownloadStatus.value === 'cancelled') return 'mdi:stop-circle-outline'
  return 'mdi:console-line'
})

const statusTitle = computed(() => {
  if (isDownloading.value) {
    if (progressData.value.playlistIndex && progressData.value.playlistCount) {
      return `Downloading Item ${progressData.value.playlistIndex} of ${progressData.value.playlistCount}`
    }
    return 'Download in Progress'
  }
  if (lastDownloadStatus.value === 'success') return 'Download Completed'
  if (lastDownloadStatus.value === 'error') return 'Download Failed'
  if (lastDownloadStatus.value === 'cancelled') return 'Download Cancelled'
  return 'Ready'
})

const statusSubtitle = computed(() => {
  if (detectedFilename.value) {
    const sizeInfo = progressData.value.total ? ` (${progressData.value.total})` : ''
    return detectedFilename.value + sizeInfo
  }
  if (isDownloading.value) return 'Fetching media data...'
  if (lastDownloadStatus.value === 'success') return 'File saved to your storage'
  if (lastDownloadStatus.value === 'error') return 'Check logs for details'
  if (lastDownloadStatus.value === 'cancelled') return 'Process terminated'
  return 'Enter a URL to begin'
})

watch(logs, () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}, { deep: true })

async function checkStatus() {
  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status' })
    })

    if (!response.ok) return

    const data = await response.json()
    if (data.status === 'idle') {
      isDownloading.value = false
      return
    }

    const wasRunning = isDownloading.value
    isDownloading.value = data.status === 'running'
    
    if (data.status === 'completed') lastDownloadStatus.value = 'success'
    else if (data.status === 'error') lastDownloadStatus.value = 'error'
    else if (data.status === 'cancelled') lastDownloadStatus.value = 'cancelled'
    else lastDownloadStatus.value = null

    // Only update logs if length changed to prevent flickering/re-scrolling
    if (data.logs && data.logs.length !== logs.value.length) {
      logs.value = data.logs
    }

    if (data.progress) {
      progressData.value = {
        ...data.progress,
        percent: data.progress.percent ? (data.progress.percent.endsWith('%') ? data.progress.percent : data.progress.percent + '%') : '0%'
      }
      if (data.progress.filename) {
        detectedFilename.value = data.progress.filename
      }
    }

    // If it just stopped, we can clear the interval or slow it down
    if (wasRunning && !isDownloading.value) {
       // Optional: small delay then one final check
    }

  } catch (err) {
    console.error('Status check failed:', err)
  }
}

async function startDownload() {
  if (!downloadUrl.value || isDownloading.value) return

  isDownloading.value = true
  lastDownloadStatus.value = null
  logs.value = []
  detectedFilename.value = ''
  progressData.value = { bytes: '', total: '', eta: '', speed: '', percent: '', playlistIndex: null, playlistCount: null }

  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: downloadUrl.value })
    })

    if (!response.ok) throw new Error('Failed to start download')
    
    // Start polling immediately
    checkStatus()
  } catch (err: any) {
    createNotification(err.message || 'Failed to start download', NotificationType.ERROR)
    isDownloading.value = false
  }
}

async function stopDownload() {
  try {
    const response = await fetch('/api/download-stop', { method: 'POST' })
    if (response.ok) {
      createNotification('Download stopping...', NotificationType.WARNING)
      checkStatus()
    }
  } catch (err) {
    createNotification('Failed to stop download', NotificationType.ERROR)
  }
}

async function clearJobState() {
  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear' })
    })
    if (response.ok) {
      lastDownloadStatus.value = null
      logs.value = []
      detectedFilename.value = ''
      progressData.value = { bytes: '', total: '', eta: '', speed: '', percent: '', playlistIndex: null, playlistCount: null }
      checkStatus()
    }
  } catch (err) {
    console.error('Failed to clear job:', err)
  }
}

onMounted(() => {
  checkStatus()
  pollInterval = setInterval(checkStatus, 1000)
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
