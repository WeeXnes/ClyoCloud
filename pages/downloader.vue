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
              <Icon name="mdi:cloud-download" class="text-primary w-6 h-6" />
              Downloader
            </h1>
            <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">yt-dlp Frontend</p>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 p-4 sm:p-8 max-w-5xl mx-auto w-full space-y-6">
      <!-- Input Section -->
      <div class="p-6 bg-base-100 border border-base-content/5 rounded-3xl shadow-sm">
        <h3 class="text-lg font-black tracking-tight mb-4">Start New Download</h3>
        <div class="flex flex-col sm:flex-row gap-3">
          <input 
            v-model="downloadUrl" 
            type="text" 
            placeholder="Paste YouTube, Twitter, or any supported URL..." 
            class="input input-bordered flex-1 bg-base-200/50 focus:bg-base-100 transition-all rounded-2xl"
            :disabled="isDownloading"
            @keyup.enter="startDownload"
          />
          <button 
            v-if="!isDownloading"
            @click="startDownload" 
            class="btn btn-primary rounded-2xl gap-2 shadow-lg shadow-primary/20"
            :disabled="!downloadUrl"
          >
            <Icon name="mdi:download" class="w-5 h-5" />
            Download
          </button>
          <button 
            v-else
            @click="stopDownload" 
            class="btn btn-error rounded-2xl gap-2 shadow-lg shadow-error/20"
          >
            <Icon name="mdi:stop-circle" class="w-5 h-5" />
            Stop Download
          </button>
        </div>
      </div>

      <!-- Progress Section -->
      <div v-if="isDownloading || lastDownloadStatus" class="p-6 bg-base-100 border border-base-content/5 rounded-3xl shadow-sm space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Icon :name="statusIcon" class="w-6 h-6" :class="{ 'animate-pulse': isDownloading }" />
            </div>
            <div>
              <p class="font-black text-sm uppercase tracking-wider">{{ statusTitle }}</p>
              <p class="text-xs text-base-content/40 font-bold uppercase tracking-widest">{{ statusSubtitle }}</p>
            </div>
          </div>
          <div v-if="progressData.percent" class="text-right">
            <p class="text-2xl font-black text-primary">{{ progressData.percent }}</p>
            <p class="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">{{ progressData.speed }} • {{ progressData.eta }}</p>
          </div>
        </div>

        <div v-if="isDownloading" class="w-full bg-base-200 rounded-full h-3 overflow-hidden">
          <div 
            class="bg-primary h-full transition-all duration-300 ease-out"
            :style="{ width: progressData.percent || '0%' }"
          ></div>
        </div>
      </div>

      <!-- Terminal / Logs -->
      <div class="bg-[#0d1117] rounded-3xl overflow-hidden shadow-2xl border border-white/5 flex flex-col h-[500px]">
        <div class="bg-white/5 px-6 py-3 flex items-center justify-between border-b border-white/5">
          <div class="flex items-center gap-2">
            <div class="flex gap-1.5">
              <div class="w-3 h-3 rounded-full bg-error/50"></div>
              <div class="w-3 h-3 rounded-full bg-warning/50"></div>
              <div class="w-3 h-3 rounded-full bg-success/50"></div>
            </div>
            <span class="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-2">yt-dlp-output.log</span>
          </div>
          <button @click="logs = []" class="text-[10px] font-black text-white/40 hover:text-white transition-colors uppercase tracking-widest">Clear</button>
        </div>
        
        <div ref="logContainer" class="flex-1 overflow-y-auto p-6 font-mono text-sm space-y-1 custom-scrollbar">
          <div v-if="logs.length === 0" class="text-white/20 italic">Awaiting download...</div>
          <div v-for="(log, index) in logs" :key="index" :class="{
            'text-blue-400': log.type === 'info',
            'text-green-400': log.type === 'success',
            'text-red-400': log.type === 'error',
            'text-gray-400': log.type === 'log',
            'text-yellow-400': log.type === 'warning'
          }" class="break-all">
            <span class="opacity-30 mr-2">[{{ new Date().toLocaleTimeString() }}]</span>
            {{ log.message }}
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'

const downloadUrl = ref('')
const isDownloading = ref(false)
const lastDownloadStatus = ref<'success' | 'error' | null>(null)
const logs = ref<{ type: string, message: string }[]>([])
const logContainer = ref<HTMLElement | null>(null)
const detectedFilename = ref('')
const abortController = ref<AbortController | null>(null)

const progressData = ref({
  bytes: '',
  total: '',
  eta: '',
  speed: '',
  percent: '',
  playlistIndex: null as number | null,
  playlistCount: null as number | null
})

const statusIcon = computed(() => {
  if (isDownloading.value) return 'mdi:sync'
  if (lastDownloadStatus.value === 'success') return 'mdi:check-decagram'
  if (lastDownloadStatus.value === 'error') return 'mdi:alert-circle'
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
  return 'Enter a URL to begin'
})

function stopDownload() {
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
    isDownloading.value = false
    logs.value.push({ type: 'warning', message: 'Download cancelled by user.' })
    createNotification('Download stopped', NotificationType.WARNING)
  }
}

watch(logs, () => {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight
    }
  })
}, { deep: true })

async function startDownload() {
  if (!downloadUrl.value || isDownloading.value) return

  isDownloading.value = true
  lastDownloadStatus.value = null
  logs.value = []
  detectedFilename.value = ''
  progressData.value = { bytes: '', total: '', eta: '', speed: '', percent: '', playlistIndex: null, playlistCount: null }
  
  abortController.value = new AbortController()
  logs.value.push({ type: 'info', message: `Initializing download for: ${downloadUrl.value}` })

  try {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: downloadUrl.value }),
      signal: abortController.value.signal
    })

    if (!response.ok) throw new Error('Failed to connect to download server')

    const reader = response.body?.getReader()
    if (!reader) throw new Error('ReadableStream not supported')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            handleEvent(data)
          } catch (e) {
            console.error('Failed to parse event:', e)
          }
        }
      }
    }
  } catch (err: any) {
    logs.value.push({ type: 'error', message: err.message || 'Unknown error occurred' })
    lastDownloadStatus.value = 'error'
    createNotification('Download failed', NotificationType.ERROR)
  } finally {
    isDownloading.value = false
    if (!lastDownloadStatus.value) lastDownloadStatus.value = 'success'
  }
}

function handleEvent(data: any) {
  if (data.type === 'log') {
    if (data.message.startsWith('progress:')) {
      const content = data.message.slice(9) // Remove "progress:"
      const parts = content.split('|')
      // [0]downloaded/total | [1]eta | [2]speed | [3]percent | [4]playlist_index | [5]playlist_count
      if (parts.length >= 4) {
        const sizeParts = parts[0].split('/')
        progressData.value.bytes = sizeParts[0]
        progressData.value.total = (sizeParts[1] === 'NA' || !sizeParts[1]) ? '' : sizeParts[1]
        progressData.value.eta = parts[1] === 'NA' ? '--:--' : parts[1]
        progressData.value.speed = parts[2] === 'NA' ? '0KiB/s' : parts[2]
        
        let pct = parts[3].trim()
        if (pct === 'NA' || !pct) pct = '0%'
        if (!pct.endsWith('%')) pct += '%'
        progressData.value.percent = pct

        if (parts[4] && parts[4] !== 'NA') progressData.value.playlistIndex = parseInt(parts[4])
        if (parts[5] && parts[5] !== 'NA') progressData.value.playlistCount = parseInt(parts[5])
      }
    } else {
      logs.value.push({ type: 'log', message: data.message })
      
      // Extract filename if present
      if (data.message.includes('[download] Destination:')) {
        const fullPath = data.message.split('Destination:')[1].trim()
        const filename = fullPath.split('/').pop()
        if (filename) {
          detectedFilename.value = filename
        }
      }
    }
  } else if (data.type === 'error') {
    logs.value.push({ type: 'warning', message: data.message })
  } else if (data.type === 'close') {
    if (data.code === 0) {
      logs.value.push({ type: 'success', message: 'Download process finished successfully.' })
      lastDownloadStatus.value = 'success'
      createNotification('Download complete!', NotificationType.SUCCESS)
    } else {
      logs.value.push({ type: 'error', message: `Process exited with code ${data.code}` })
      lastDownloadStatus.value = 'error'
      createNotification('Download failed', NotificationType.ERROR)
    }
  }
}
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
