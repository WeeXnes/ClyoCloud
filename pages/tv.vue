<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'
import type { Channel, EpgEvent } from '~/types/Tvheadend'

const channels = ref<Channel[]>([])
const epgEvents = ref<EpgEvent[]>([])
const recordings = ref<any[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const selectedChannel = ref<Channel | null>(null)
const searchQuery = ref('')
const epgInterval = ref<any>(null)
const tvPlayer = ref<HTMLVideoElement | null>(null)
const isBuffering = ref(false)
const isStopping = ref(false)

function stopPlayback() {
  isStopping.value = true
  if (tvPlayer.value) {
    const video = tvPlayer.value
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
}

async function selectChannel(channel: Channel) {
  selectedChannel.value = channel
  isBuffering.value = true
  isStopping.value = false
  
  await nextTick()
  
  if (tvPlayer.value) {
    const video = tvPlayer.value
    // Stop current playback properly
    stopPlayback()
    isStopping.value = false // Allow new stream to report errors
    
    // Set new source - using matroska for proven container compatibility
    video.src = getStreamUrl(channel.uuid)
    video.load()
    
    // Logic: Wait for 'canplay', then play immediately to preserve user gesture context
    const startPlayback = () => {
      if (isStopping.value) return
      console.log('[TV] Stream ready, starting playback')
      isBuffering.value = false
      video.play().catch(e => {
          if (isStopping.value) return
          console.warn('[TV] Playback blocked, requiring user interaction:', e)
          isBuffering.value = false
      })
      video.removeEventListener('canplay', startPlayback)
    }
    
    video.addEventListener('canplay', startPlayback)
    
    video.onwaiting = () => { if (!isStopping.value) isBuffering.value = true }
    video.onplaying = () => { isBuffering.value = false }
    video.onerror = () => {
        if (isStopping.value) return
        isBuffering.value = false
        createNotification('Stream error occurred', NotificationType.ERROR)
    }
  }
}

async function fetchData() {
  try {
    isLoading.value = true
    error.value = null
    
    const [channelsRes, epgRes, recordingsRes] = await Promise.all([
      fetch('/api/tv/channels', { credentials: 'include' }),
      fetch('/api/tv/epg', { credentials: 'include' }),
      fetch('/api/tv/recordings', { credentials: 'include' })
    ])

    if (!channelsRes.ok) throw new Error('Failed to fetch channels')
    if (!epgRes.ok) throw new Error('Failed to fetch EPG')
    if (!recordingsRes.ok) throw new Error('Failed to fetch recordings')

    const channelsData = await channelsRes.json()
    const epgData = await epgRes.json()
    const recordingsData = await recordingsRes.json()

    channels.value = (channelsData.entries || []).sort((a: Channel, b: Channel) => a.number - b.number)
    epgEvents.value = epgData.entries || []
    recordings.value = recordingsData.entries || []

    if (channels.value.length > 0 && !selectedChannel.value) {
      // Trigger the smart buffering for the first channel
      selectChannel(channels.value[0])
    }
  } catch (err: any) {
    console.error('Error fetching TV data:', err)
    error.value = err.message || 'Failed to connect to Tvheadend. Please check your settings.'
  } finally {
    isLoading.value = false
  }
}

async function startRecording(channelUuid: string, title: string) {
  try {
    const res = await fetch('/api/tv/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelUuid, title })
    })
    if (!res.ok) throw new Error('Failed to start recording')
    createNotification('Recording started in Cloud', NotificationType.SUCCESS)
    fetchRecordingsOnly()
  } catch (err) {
    createNotification('Failed to start cloud recording', NotificationType.ERROR)
  }
}

async function stopRecording(channelUuid: string) {
  try {
    const res = await fetch('/api/tv/record-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelUuid })
    })
    if (!res.ok) throw new Error('Failed to stop recording')

    // Proactively remove from UI immediately
    recordings.value = recordings.value.filter(r => r.uuid !== channelUuid)
    createNotification('Cloud recording stopped', NotificationType.INFO)
    
    // Slight delay before refreshing from backend to ensure state consistency
    setTimeout(fetchRecordingsOnly, 500)
  } catch (err) {
    createNotification('Failed to stop recording', NotificationType.ERROR)
  }
}

async function fetchRecordingsOnly() {
  try {
    const res = await fetch('/api/tv/recordings', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      recordings.value = data.entries || []
    }
  } catch (err) {
    console.error('Error refreshing recordings:', err)
  }
}

function getEventRecording(channelUuid: string) {
  return recordings.value.find(r => r.uuid === channelUuid)
}

function isEventRecording(channelUuid: string) {
  return recordings.value.some(r => r.uuid === channelUuid)
}

onMounted(() => {
  fetchData()
  // Refresh EPG and recordings every 5 minutes
  epgInterval.value = setInterval(() => {
    fetchEpgOnly()
    fetchRecordingsOnly()
  }, 5 * 60 * 1000)
})

onUnmounted(() => {
  if (epgInterval.value) clearInterval(epgInterval.value)
  stopPlayback()
})

async function fetchEpgOnly() {
  try {
    const res = await fetch('/api/tv/epg', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      epgEvents.value = data.entries || []
    }
  } catch (err) {
    console.error('Error refreshing EPG:', err)
  }
}

const filteredChannels = computed(() => {
  if (!searchQuery.value.trim()) return channels.value
  const query = searchQuery.value.toLowerCase()
  return channels.value.filter(c => 
    c.name.toLowerCase().includes(query) || 
    c.number.toString().includes(query)
  )
})

const currentEvents = computed(() => {
  const now = Math.floor(Date.now() / 1000)
  return epgEvents.value.filter(e => e.start <= now && e.stop > now)
})

const getChannelEvent = (channelUuid: string) => {
  return currentEvents.value.find(e => e.channelUuid === channelUuid)
}

const getSelectedChannelEpg = computed(() => {
  if (!selectedChannel.value) return []
  return epgEvents.value
    .filter(e => e.channelUuid === selectedChannel.value!.uuid)
    .sort((a, b) => a.start - b.start)
})

const getIconUrl = (url?: string) => {
  if (!url) return null
  if (url.startsWith('http')) {
    // If it's a full URL, we might still need to proxy it if it's on the local tvheadend IP
    try {
        const u = new URL(url)
        return `/tv/icon${u.pathname}${u.search}`
    } catch {
        return url
    }
  }
  return `/tv/icon/${url.startsWith('/') ? url.slice(1) : url}`
}

const getStreamUrl = (channelUuid: string) => {
  // Using 'matroska' profile - usually just re-muxes with minimal CPU and is browser-friendly
  return `/tv/stream/channel/${channelUuid}?profile=matroska`
}

const activeTab = ref<'guide' | 'recordings'>('guide')

function formatTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatProgress(start: number, stop: number) {
  const now = Math.floor(Date.now() / 1000)
  const total = stop - start
  const elapsed = now - start
  return Math.min(Math.max((elapsed / total) * 100, 0), 100)
}
</script>

<template>
  <div class="min-h-screen bg-base-200/50 flex flex-col font-sans">
    <!-- Edge-to-Edge Sticky Header -->
    <header class="sticky top-0 z-[40] w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/10">
      <div class="w-full px-4 py-3 md:py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div class="flex flex-col gap-0.5 md:gap-1 min-w-0">
            <div class="flex items-center gap-2">
              <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-xs md:btn-sm lg:hidden">
                <Icon name="mdi:menu" class="w-5 h-5" />
              </label>
              <h1 class="text-base md:text-lg font-bold tracking-tight flex items-center gap-2 text-base-content">
                <Icon name="mdi:television-classic" class="text-primary w-5 h-5" />
                Live TV
              </h1>
            </div>
            <p class="text-[9px] md:text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">
              {{ channels.length }} channels available
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2 md:gap-3">
             <div class="relative flex-1 md:flex-none md:min-w-[240px]">
                <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Icon name="mdi:magnify" class="w-4 h-4 text-base-content/30" />
                </div>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search channels..."
                  class="input input-xs md:input-sm input-bordered w-full pl-9 bg-base-100/50 focus:bg-base-100 transition-all border-base-content/10 font-bold text-xs h-8 md:h-10"
                />
             </div>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-[1800px] mx-auto p-4 sm:p-6 lg:p-8">
      <div v-if="isLoading && channels.length === 0" class="flex flex-col items-center justify-center py-24">
        <span class="loading loading-spinner loading-lg text-primary"></span>
        <p class="mt-4 font-bold text-base-content/40 uppercase tracking-widest text-[10px]">Connecting to backend...</p>
      </div>

      <div v-else-if="error" class="flex flex-col items-center justify-center py-24 text-center">
        <div class="bg-error/10 p-6 rounded-xl mb-4">
          <Icon name="mdi:television-off" class="w-12 h-12 text-error/40" />
        </div>
        <h3 class="text-lg font-bold text-base-content">Connection Failed</h3>
        <p class="text-xs font-bold text-base-content/40 uppercase tracking-widest max-w-xs mt-2">{{ error }}</p>
        <NuxtLink to="/settings" class="btn btn-primary btn-sm mt-6 rounded-lg font-bold text-[10px] uppercase tracking-widest">Check Settings</NuxtLink>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <!-- Sidebar -->
        <aside class="lg:col-span-3 xl:col-span-3 bg-base-100 rounded-xl border border-base-content/10 overflow-hidden flex flex-col shadow-sm">
          <div class="p-2 border-b border-base-content/5 bg-base-200/30 flex gap-1">
            <button 
              @click="activeTab = 'guide'"
              :class="`flex-1 py-2.5 px-3 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${activeTab === 'guide' ? 'bg-primary text-primary-content shadow-sm' : 'hover:bg-base-100/50 text-base-content/40'}`"
            >
              <Icon name="mdi:format-list-bulleted" class="w-4 h-4 mr-1" /> Guide
            </button>
            <button 
              @click="activeTab = 'recordings'"
              :class="`flex-1 py-2.5 px-3 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${activeTab === 'recordings' ? 'bg-primary text-primary-content shadow-sm' : 'hover:bg-base-100/50 text-base-content/40'}`"
            >
              <Icon name="mdi:record-rec" class="w-4 h-4 mr-1" /> Records
            </button>
          </div>

          <!-- Channel Guide Tab -->
          <div v-if="activeTab === 'guide'" class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            <div 
              v-for="channel in filteredChannels" 
              :key="channel.uuid"
              @click="selectChannel(channel)"
              :class="`group flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all duration-200 ${selectedChannel?.uuid === channel.uuid ? 'bg-primary text-primary-content shadow-sm' : 'hover:bg-base-200'}`"
            >
              <div class="w-10 h-10 rounded-lg bg-base-200 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform border border-base-content/5">
                <img v-if="channel.icon_public_url" :src="getIconUrl(channel.icon_public_url)!" class="w-8 h-8 object-contain" alt="" />
                <Icon v-else name="mdi:television" class="w-5 h-5 opacity-20" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span :class="`text-[9px] font-bold px-1 py-0.5 rounded ${selectedChannel?.uuid === channel.uuid ? 'bg-white/20' : 'bg-base-200 text-base-content/40'}`">
                    {{ channel.number }}
                  </span>
                  <h4 class="font-bold text-xs truncate">{{ channel.name }}</h4>
                </div>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <p v-if="getChannelEvent(channel.uuid)" :class="`text-[9px] font-bold uppercase tracking-wide truncate ${selectedChannel?.uuid === channel.uuid ? 'text-white/70' : 'text-base-content/30'}`">
                    {{ getChannelEvent(channel.uuid)?.title }}
                  </p>
                  <Icon v-if="isEventRecording(channel.uuid)" name="mdi:circle" class="w-1.5 h-1.5 text-error animate-pulse shrink-0" />
                </div>
              </div>
            </div>
            
            <div v-if="filteredChannels.length === 0" class="flex flex-col items-center justify-center py-12 opacity-30">
              <Icon name="mdi:magnify-close" class="w-10 h-10 mb-2" />
              <p class="text-[9px] font-bold uppercase tracking-widest">No channels found</p>
            </div>
          </div>

          <!-- Recordings Tab -->
          <div v-else class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
            <div 
              v-for="record in recordings" 
              :key="record.uuid"
              class="group flex flex-col gap-2 p-3 rounded-lg bg-base-200/50 border border-base-content/10"
            >
              <div class="flex justify-between items-start">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest bg-error text-white animate-pulse">
                      RECORDING
                    </span>
                  </div>
                  <h4 class="font-bold text-xs line-clamp-1 text-base-content">{{ record.title }}</h4>
                </div>
                <button 
                  @click="stopRecording(record.uuid)"
                  class="btn btn-ghost btn-circle btn-xs text-error/40 hover:text-error hover:bg-error/10"
                >
                  <Icon name="mdi:stop-circle-outline" class="w-4 h-4" />
                </button>
              </div>
            </div>

            <div v-if="recordings.length === 0" class="flex flex-col items-center justify-center py-12 opacity-30 text-center px-4">
              <Icon name="mdi:video-off-outline" class="w-10 h-10 mb-2" />
              <p class="text-[9px] font-bold uppercase tracking-widest">No active recordings</p>
            </div>
          </div>
        </aside>

        <!-- Main Player Area -->
        <div class="lg:col-span-9 xl:col-span-9 space-y-6">
          <div v-if="selectedChannel" class="space-y-6 animate-in fade-in duration-300">
            <!-- Player Wrapper -->
            <div class="relative group aspect-video bg-black rounded-xl overflow-hidden shadow-lg border border-white/5">
              <video
                ref="tvPlayer"
                controls
                preload="auto"
                class="w-full h-full"
              >
                Your browser does not support video.
              </video>

              <!-- Buffering Overlay -->
              <div v-if="isBuffering" class="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 animate-in fade-in duration-300 pointer-events-none">
                <span class="loading loading-spinner loading-lg text-primary"></span>
                <p class="mt-6 font-bold text-[10px] uppercase tracking-[0.3em] text-white/70">
                  Stabilizing Stream...
                </p>
              </div>
            </div>

            <!-- Current Program Info -->
            <div class="bg-base-100 rounded-xl p-6 sm:p-8 shadow-sm border border-base-content/10">
              <div v-if="getChannelEvent(selectedChannel.uuid)" class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <h2 class="text-2xl font-bold tracking-tight text-base-content leading-tight">
                      {{ getChannelEvent(selectedChannel.uuid)?.title }}
                    </h2>
                    <p class="text-primary font-bold text-xs uppercase tracking-wider mt-1">
                      {{ getChannelEvent(selectedChannel.uuid)?.subtitle || 'Live Broadcast' }}
                    </p>
                  </div>
                  <div class="flex items-center gap-4">
                    <button 
                      @click="isEventRecording(selectedChannel.uuid) ? stopRecording(selectedChannel.uuid) : startRecording(selectedChannel.uuid, getChannelEvent(selectedChannel.uuid)?.title || 'Live TV')"
                      :class="`btn btn-sm gap-2 rounded-lg px-6 font-bold text-[10px] uppercase tracking-widest ${isEventRecording(selectedChannel.uuid) ? 'btn-error' : 'btn-outline'}`"
                    >
                      <Icon :name="isEventRecording(selectedChannel.uuid) ? 'mdi:stop-circle' : 'mdi:record-rec'" class="w-4 h-4" />
                      {{ isEventRecording(selectedChannel.uuid) ? 'Stop Recording' : 'Record to Cloud' }}
                    </button>
                    <div class="text-right border-l border-base-content/10 pl-4">
                      <p class="text-[9px] font-bold uppercase tracking-widest text-base-content/30 mb-0.5">Duration</p>
                      <p class="font-bold text-xs text-base-content">
                        {{ formatTime(getChannelEvent(selectedChannel.uuid)!.start) }} - {{ formatTime(getChannelEvent(selectedChannel.uuid)!.stop) }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Progress Bar -->
                <div class="space-y-2">
                  <div class="w-full bg-base-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      class="bg-primary h-full transition-all duration-1000"
                      :style="{ width: `${formatProgress(getChannelEvent(selectedChannel.uuid)!.start, getChannelEvent(selectedChannel.uuid)!.stop)}%` }"
                    ></div>
                  </div>
                </div>

                <div class="pt-4 border-t border-base-content/5">
                  <p class="text-xs font-bold leading-relaxed text-base-content/60">
                    {{ getChannelEvent(selectedChannel.uuid)?.description }}
                  </p>
                </div>
              </div>
              
              <div v-else class="flex flex-col items-center justify-center py-8 opacity-40">
                <Icon name="mdi:information-outline" class="w-10 h-10 mb-3" />
                <h3 class="font-bold uppercase tracking-widest text-[10px]">No Schedule Available</h3>
                <p class="text-[9px] font-bold mt-1 uppercase">Channel: {{ selectedChannel.name }}</p>
              </div>
            </div>

            <!-- Coming Up / EPG for Channel -->
            <div class="space-y-4">
              <h3 class="text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/30 pl-1">Coming Up Next</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div 
                  v-for="event in getSelectedChannelEpg.filter(e => e.start > Math.floor(Date.now() / 1000)).slice(0, 6)" 
                  :key="event.eventId"
                  class="bg-base-100 p-4 rounded-xl border border-base-content/10 shadow-sm hover:border-primary/30 transition-all group relative overflow-hidden"
                >
                  <div class="flex justify-between items-start mb-3">
                    <span class="text-[9px] font-bold uppercase tracking-widest bg-base-200 px-2 py-1 rounded text-base-content/50 border border-base-content/5">
                      {{ formatTime(event.start) }}
                    </span>
                    <button 
                      @click="isEventRecording(event.channelUuid) ? stopRecording(event.channelUuid) : startRecording(event.channelUuid, event.title)"
                      :class="`btn btn-circle btn-xs ${isEventRecording(event.channelUuid) ? 'btn-error' : 'btn-ghost bg-base-200 hover:bg-primary/10 hover:text-primary'}`"
                    >
                      <Icon :name="isEventRecording(event.channelUuid) ? 'mdi:stop-circle' : 'mdi:record-rec'" class="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <h4 class="font-bold text-xs line-clamp-1 group-hover:text-primary transition-colors text-base-content">{{ event.title }}</h4>
                  <p class="text-[10px] font-bold text-base-content/30 mt-1 line-clamp-2 uppercase tracking-wide leading-tight">{{ event.description }}</p>
                  
                  <div v-if="isEventRecording(event.channelUuid)" class="absolute top-0 right-0 p-1">
                    <Icon name="mdi:circle" class="w-1.5 h-1.5 text-error animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="flex flex-col items-center justify-center h-[60vh] text-center opacity-30">
            <Icon name="mdi:television-play" class="w-20 h-20 mb-6" />
            <h2 class="text-xl font-bold uppercase tracking-widest">Select a channel</h2>
            <p class="font-bold text-[10px] uppercase tracking-widest mt-2">Enjoy your Live TV</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 10px;
}

.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
