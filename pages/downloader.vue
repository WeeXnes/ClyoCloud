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
                <h1 class="text-[15px] font-medium tracking-section text-fg leading-tight">Downloader</h1>
                <p class="hidden sm:block text-[13px] text-fg-3 leading-tight">yt-dlp Frontend</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full page-wrap py-12 space-y-16">
      <!-- New download -->
      <section class="max-w-form">
        <h2 class="page-title mb-2">Download from the web</h2>
        <p class="text-fg-2 mb-8">Paste a link from YouTube, X or any site yt-dlp supports.</p>
        <label for="download-url" class="block text-[13px] text-fg-2 mb-1.5">URL</label>
        <div class="flex flex-col sm:flex-row gap-3">
          <input
            id="download-url"
            v-model="downloadUrl"
            type="text"
            placeholder="https://"
            class="input flex-1"
            :disabled="isDownloading"
            @keyup.enter="startDownload"
          />
          <button
            v-if="!isDownloading"
            @click="startDownload"
            class="btn btn-primary gap-2 h-10 min-h-10"
            :disabled="!downloadUrl"
          >
            <Icon name="mdi:download" class="w-4 h-4" />
            Download
          </button>
          <button
            v-else
            @click="stopDownload"
            class="btn btn-error gap-2 h-10 min-h-10"
          >
            <Icon name="mdi:stop" class="w-4 h-4" />
            Stop
          </button>
        </div>
      </section>

      <!-- Progress -->
      <section v-if="isDownloading || lastDownloadStatus" class="border-y border-line py-6">
        <div class="flex items-start justify-between gap-6">
          <div class="min-w-0">
            <p class="flex items-center gap-2 text-[14px] text-fg">
              <span v-if="isDownloading" class="loading loading-spinner loading-xs"></span>
              <span v-else class="dot" :class="lastDownloadStatus === 'success' ? 'text-success' : lastDownloadStatus === 'error' ? 'text-error' : 'text-fg-3'"></span>
              {{ isDownloading ? 'Downloading' : lastDownloadStatus === 'success' ? 'Finished' : lastDownloadStatus === 'error' ? 'Failed' : 'Stopped' }}
            </p>
            <p v-if="detectedFilename" class="text-[13px] text-fg-3 truncate mt-0.5">{{ detectedFilename }}</p>
          </div>
          <div class="flex items-start gap-4 shrink-0">
            <div v-if="progressData.percent" class="text-right">
              <p class="num text-4xl font-medium text-fg tracking-title leading-none">{{ progressData.percent }}</p>
              <p class="micro num mt-2">{{ progressData.speed }} · {{ progressData.eta }}</p>
            </div>
            <button v-if="!isDownloading" @click="clearJobState" class="btn btn-ghost btn-sm btn-circle" title="Dismiss" aria-label="Dismiss">
              <Icon name="mdi:close" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <div v-if="isDownloading" class="w-full bg-surface-2 rounded-full h-1 overflow-hidden mt-6">
          <div class="bg-invert h-full" :style="{ width: progressData.percent || '0%' }"></div>
        </div>
      </section>

      <!-- Output -->
      <section>
        <div class="flex items-baseline justify-between mb-4">
          <h2 class="section-title">Output</h2>
          <button @click="logs = []" class="text-[13px] text-fg-2 hover:text-fg transition-colors">Clear</button>
        </div>
        <div ref="logContainer" class="bg-base-200 border border-line rounded-xl h-[420px] overflow-y-auto p-4 font-mono text-[12px] leading-relaxed space-y-0.5">
          <div v-if="logs.length === 0" class="text-fg-3">Waiting for a download.</div>
          <div v-for="(log, index) in logs" :key="index" :class="{
            'text-fg-2': log.type === 'info' || log.type === 'log',
            'text-success': log.type === 'success',
            'text-error': log.type === 'error',
            'text-warning': log.type === 'warning'
          }" class="break-all">
            <span class="text-fg-3 mr-2 num">{{ log.time }}</span>{{ log.message }}
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue'

useHead({
  title: 'Downloader'
})
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'
import { startOperation, updateOperation, completeOperation, failOperation, ProgressManager } from '~/core/progressManager'

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
    const opId = 'downloader-job'

    if (data.status === 'idle') {
      isDownloading.value = false
      const op = ProgressManager.operations.find(o => o.id === opId)
      if (op && op.status === 'processing') {
         completeOperation(opId)
      }
      return
    }

    const wasRunning = isDownloading.value
    isDownloading.value = data.status === 'running'
    
    if (data.status === 'completed') {
      lastDownloadStatus.value = 'success'
      completeOperation(opId)
    }
    else if (data.status === 'error') {
      lastDownloadStatus.value = 'error'
      failOperation(opId)
    }
    else if (data.status === 'cancelled') {
      lastDownloadStatus.value = 'cancelled'
      failOperation(opId)
    }
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

      const percentValue = parseFloat(progressData.value.percent.replace('%', '')) || 0
      const existingOp = ProgressManager.operations.find(o => o.id === opId)
      
      if (!existingOp && isDownloading.value) {
        startOperation(opId, 'Downloader: ' + (detectedFilename.value || 'Retrieving...'), 100)
      } else if (existingOp) {
        if (detectedFilename.value && existingOp.title !== 'Downloader: ' + detectedFilename.value) {
          existingOp.title = 'Downloader: ' + detectedFilename.value
        }
        updateOperation(opId, percentValue)
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
  background: var(--line-strong);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--line-strong);
}
</style>
