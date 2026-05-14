<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'
import type { Channel, EpgEvent } from '~/types/Tvheadend'

const channels = ref<Channel[]>([])
const epgEvents = ref<EpgEvent[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const selectedChannel = ref<Channel | null>(null)
const searchQuery = ref('')
const epgInterval = ref<any>(null)

async function fetchData() {
  try {
    isLoading.value = true
    error.value = null
    
    const [channelsRes, epgRes] = await Promise.all([
      fetch('/api/tv/channels', { credentials: 'include' }),
      fetch('/api/tv/epg', { credentials: 'include' })
    ])

    if (!channelsRes.ok) throw new Error('Failed to fetch channels')
    if (!epgRes.ok) throw new Error('Failed to fetch EPG')

    const channelsData = await channelsRes.json()
    const epgData = await epgRes.json()

    channels.value = (channelsData.entries || []).sort((a: Channel, b: Channel) => a.number - b.number)
    epgEvents.value = epgData.entries || []

    if (channels.value.length > 0 && !selectedChannel.value) {
      selectedChannel.value = channels.value[0]
    }
  } catch (err: any) {
    console.error('Error fetching TV data:', err)
    error.value = err.message || 'Failed to connect to Tvheadend. Please check your settings.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchData()
  // Refresh EPG every 5 minutes
  epgInterval.value = setInterval(() => {
    fetchEpgOnly()
  }, 5 * 60 * 1000)
})

onUnmounted(() => {
  if (epgInterval.value) clearInterval(epgInterval.value)
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

const selectChannel = (channel: Channel) => {
  selectedChannel.value = channel
}

const getStreamUrl = (channelUuid: string) => {
  // Using /channel/ instead of /channelid/ for UUIDs
  return `/tv/stream/channel/${channelUuid}?profile=webtv-vp8-vorbis-webm`
}

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
    <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/5">
      <div class="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            <div>
              <h1 class="text-xl font-black tracking-tight flex items-center gap-2">
                <Icon name="mdi:television-classic" class="text-primary w-6 h-6" />
                Live TV
              </h1>
              <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">
                {{ channels.length }} channels available
              </p>
            </div>
          </div>

          <div class="relative w-full sm:max-w-xs lg:max-w-md">
            <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Icon name="mdi:magnify" class="w-5 h-5 text-base-content/40" />
            </div>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search channels..."
              class="input input-bordered w-full pl-10 bg-base-100/50 focus:bg-base-100 transition-all border-base-content/10"
            />
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-[1800px] mx-auto p-4 sm:p-6 lg:p-8">
      <div v-if="isLoading && channels.length === 0" class="flex flex-col items-center justify-center py-24">
        <span class="loading loading-ring loading-lg text-primary"></span>
        <p class="mt-4 font-bold text-base-content/40 uppercase tracking-widest text-xs">Connecting to Tvheadend...</p>
      </div>

      <div v-else-if="error" class="flex flex-col items-center justify-center py-24 text-center">
        <div class="bg-error/10 p-6 rounded-full mb-4">
          <Icon name="mdi:television-off" class="w-16 h-16 text-error/40" />
        </div>
        <h3 class="text-xl font-bold">Connection Failed</h3>
        <p class="text-base-content/60 max-w-xs mt-2">{{ error }}</p>
        <NuxtLink to="/settings" class="btn btn-primary mt-6 rounded-xl">Check Settings</NuxtLink>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
        <!-- Channel Sidebar -->
        <aside class="lg:col-span-3 xl:col-span-3 bg-base-100 rounded-[2rem] border border-base-content/5 overflow-hidden flex flex-col shadow-xl shadow-base-content/5">
          <div class="p-6 border-b border-base-content/5 bg-base-200/30">
            <h3 class="text-xs font-black uppercase tracking-widest text-base-content/40 flex items-center gap-2">
              <Icon name="mdi:format-list-bulleted" class="w-4 h-4" />
              Channel Guide
            </h3>
          </div>
          <div class="flex-1 overflow-y-auto custom-scrollbar p-2">
            <div 
              v-for="channel in filteredChannels" 
              :key="channel.uuid"
              @click="selectChannel(channel)"
              :class="`group flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all duration-200 ${selectedChannel?.uuid === channel.uuid ? 'bg-primary text-primary-content shadow-lg shadow-primary/20' : 'hover:bg-base-200'}`"
            >
              <div class="w-12 h-12 rounded-xl bg-base-200 flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform">
                <img v-if="channel.icon_public_url" :src="getIconUrl(channel.icon_public_url)!" class="w-10 h-10 object-contain" alt="" />
                <Icon v-else name="mdi:television" class="w-6 h-6 opacity-20" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span :class="`text-[10px] font-black px-1.5 py-0.5 rounded ${selectedChannel?.uuid === channel.uuid ? 'bg-white/20' : 'bg-base-200 text-base-content/40'}`">
                    {{ channel.number }}
                  </span>
                  <h4 class="font-bold text-sm truncate">{{ channel.name }}</h4>
                </div>
                <p v-if="getChannelEvent(channel.uuid)" :class="`text-[10px] font-medium truncate mt-0.5 ${selectedChannel?.uuid === channel.uuid ? 'text-white/70' : 'text-base-content/40'}`">
                  {{ getChannelEvent(channel.uuid)?.title }}
                </p>
              </div>
            </div>
            
            <div v-if="filteredChannels.length === 0" class="flex flex-col items-center justify-center py-12 opacity-30">
              <Icon name="mdi:magnify-close" class="w-12 h-12 mb-2" />
              <p class="text-[10px] font-black uppercase tracking-widest">No channels found</p>
            </div>
          </div>
        </aside>

        <!-- Main Player Area -->
        <div class="lg:col-span-9 xl:col-span-9 space-y-6">
          <div v-if="selectedChannel" class="space-y-6 animate-in fade-in duration-500">
            <!-- Player Wrapper -->
            <div class="relative group aspect-video bg-black rounded-[2.5rem] overflow-hidden shadow-2xl ring-1 ring-white/5">
              <video
                controls
                autoplay
                class="w-full h-full"
                :key="selectedChannel.uuid"
              >
                <source :src="getStreamUrl(selectedChannel.uuid)" type="video/webm" />
                Your browser does not support the video tag.
              </video>
            </div>

            <!-- Current Program Info -->
            <div class="bg-base-100 rounded-[2.5rem] p-8 shadow-xl shadow-base-content/5 border border-base-content/5">
              <div v-if="getChannelEvent(selectedChannel.uuid)" class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 class="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                      {{ getChannelEvent(selectedChannel.uuid)?.title }}
                    </h2>
                    <p class="text-primary font-bold text-sm mt-1">
                      {{ getChannelEvent(selectedChannel.uuid)?.subtitle }}
                    </p>
                  </div>
                  <div class="flex items-center gap-3">
                    <div class="text-right">
                      <p class="text-[10px] font-black uppercase tracking-widest text-base-content/30">On Air</p>
                      <p class="font-bold text-sm">
                        {{ formatTime(getChannelEvent(selectedChannel.uuid)!.start) }} - {{ formatTime(getChannelEvent(selectedChannel.uuid)!.stop) }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Progress Bar -->
                <div class="space-y-2">
                  <div class="w-full bg-base-200 h-2 rounded-full overflow-hidden">
                    <div 
                      class="bg-primary h-full transition-all duration-1000"
                      :style="{ width: `${formatProgress(getChannelEvent(selectedChannel.uuid)!.start, getChannelEvent(selectedChannel.uuid)!.stop)}%` }"
                    ></div>
                  </div>
                </div>

                <div class="pt-4 border-t border-base-content/5">
                  <p class="text-sm font-medium leading-relaxed text-base-content/70">
                    {{ getChannelEvent(selectedChannel.uuid)?.description }}
                  </p>
                </div>
              </div>
              
              <div v-else class="flex flex-col items-center justify-center py-8 opacity-40">
                <Icon name="mdi:information-outline" class="w-12 h-12 mb-3" />
                <h3 class="font-black uppercase tracking-widest text-xs">No EPG data available</h3>
                <p class="text-[10px] font-bold mt-1">Currently playing: {{ selectedChannel.name }}</p>
              </div>
            </div>

            <!-- Coming Up / EPG for Channel -->
            <div class="space-y-4">
              <h3 class="text-xs font-black uppercase tracking-[0.2em] text-base-content/30 pl-2">Coming Up Next</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <div 
                  v-for="event in getSelectedChannelEpg.filter(e => e.start > Math.floor(Date.now() / 1000)).slice(0, 6)" 
                  :key="event.uuid"
                  class="bg-base-100 p-5 rounded-3xl border border-base-content/5 shadow-sm hover:shadow-md transition-shadow group"
                >
                  <div class="flex justify-between items-start mb-2">
                    <span class="text-[10px] font-black uppercase tracking-widest bg-base-200 px-2 py-1 rounded text-base-content/50">
                      {{ formatTime(event.start) }}
                    </span>
                  </div>
                  <h4 class="font-black text-sm line-clamp-1 group-hover:text-primary transition-colors">{{ event.title }}</h4>
                  <p class="text-[11px] font-medium text-base-content/40 mt-1 line-clamp-2">{{ event.description }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="flex flex-col items-center justify-center h-[60vh] text-center opacity-30">
            <Icon name="mdi:television-play" class="w-24 h-24 mb-6" />
            <h2 class="text-2xl font-black uppercase tracking-widest">Select a channel to begin</h2>
            <p class="font-bold text-sm mt-2">Enjoy your integrated TV experience</p>
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
