<template>
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
                <Icon name="mdi:view-dashboard-outline" class="text-primary w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 class="text-base font-extrabold tracking-tight">System Status</h1>
                <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest leading-none mt-0.5">Overview</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-[1400px] mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
      
      <!-- Welcome Section -->
      <section class="relative bg-gradient-to-br from-primary/10 via-base-100 to-base-100 rounded-2xl p-6 sm:p-8 border border-base-content/5 overflow-hidden shadow-md group">
        <!-- Glow backgrounds -->
        <div class="absolute -right-24 -top-24 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-primary/15 transition-all duration-700"></div>
        <div class="absolute -left-20 -bottom-20 w-60 h-60 bg-secondary/5 rounded-full blur-[80px] pointer-events-none"></div>
        
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-success/15 text-success border border-success/10">
                <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-success animate-pulse"></span>
                Storage online
              </span>
            </div>
            <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">
              Welcome back, <span class="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{{ userState?.name || stats?.username || 'User' }}</span>
            </h2>
            <p class="text-xs text-base-content/50 font-bold uppercase tracking-wider pl-0.5">ClyoCloud is fully synchronized and secure</p>
          </div>
          <div>
            <NuxtLink to="/files" class="btn btn-primary rounded-xl px-6 shadow-md hover:shadow-primary/20 transition-all duration-200 hover:scale-[1.02] gap-2 font-bold text-xs uppercase tracking-wider">
              <Icon name="mdi:cloud-upload" class="w-4 h-4" />
              Upload files
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        <!-- Main Column (Storage & Hardware Core) -->
        <div class="lg:col-span-7 flex flex-col gap-8">
          
          <!-- Storage Drives -->
          <div class="space-y-4">
            <div class="flex items-center gap-2 px-1">
               <Icon name="mdi:harddisk" class="text-base-content/40 w-4 h-4" />
               <h2 class="text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/40">Mounted Storage Units</h2>
            </div>

            <div class="grid grid-cols-1 gap-6">
              <template v-if="isLoading">
                <div v-for="i in 2" :key="i" class="bg-base-100/60 rounded-2xl p-6 border border-base-content/5 animate-pulse h-40"></div>
              </template>
              <template v-else>
                <div 
                  v-for="drive in stats?.drives" 
                  :key="drive.mount"
                  class="bg-base-100/60 backdrop-blur-md rounded-2xl border border-base-content/5 p-6 flex flex-col justify-between hover:border-primary/20 hover:shadow-md transition-all duration-300 group"
                >
                  <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-4">
                      <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/10 group-hover:scale-105 transition-transform duration-300">
                        <Icon :name="drive.mount === '/' ? 'mdi:folder-home-outline' : 'mdi:database-outline'" class="text-primary w-5 h-5" />
                      </div>
                      <div>
                        <h3 class="font-extrabold text-base tracking-tight">{{ drive.mount }}</h3>
                        <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest">{{ drive.label }}</p>
                      </div>
                    </div>

                    <!-- SVG Radial Circle Progress -->
                    <div class="relative w-14 h-14 flex items-center justify-center">
                      <svg class="w-full h-full transform -rotate-90">
                        <circle cx="28" cy="28" r="22" stroke="currentColor" class="text-base-content/5" stroke-width="4.5" fill="transparent" />
                        <circle 
                          cx="28" 
                          cy="28" 
                          r="22" 
                          stroke="currentColor" 
                          :class="drive.use > 90 ? 'text-error' : drive.use > 75 ? 'text-warning' : 'text-primary'" 
                          stroke-width="4.5" 
                          fill="transparent" 
                          stroke-dasharray="138.23" 
                          :stroke-dashoffset="138.23 * (1 - drive.use / 100)" 
                          stroke-linecap="round"
                          class="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <span class="absolute text-[10px] font-black">{{ Math.round(drive.use) }}%</span>
                    </div>
                  </div>

                  <!-- Details Grid -->
                  <div class="border-t border-base-content/5 pt-4 mt-2">
                    <div class="grid grid-cols-3 gap-2">
                      <div class="flex flex-col gap-0.5">
                        <span class="text-[8px] font-bold uppercase tracking-widest text-base-content/30">Used</span>
                        <span class="text-xs font-extrabold text-base-content/70">{{ formatSize(drive.used) }}</span>
                      </div>
                      <div class="flex flex-col gap-0.5 border-l border-base-content/5 pl-4">
                        <span class="text-[8px] font-bold uppercase tracking-widest text-base-content/30">Available</span>
                        <span class="text-xs font-extrabold text-base-content/70">{{ formatSize(drive.available) }}</span>
                      </div>
                      <div class="flex flex-col gap-0.5 border-l border-base-content/5 pl-4 text-right">
                        <span class="text-[8px] font-bold uppercase tracking-widest text-base-content/30">Total Size</span>
                        <span class="text-xs font-bold text-base-content/40">{{ formatSize(drive.total) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Hardware load: CPU & RAM -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <!-- CPU Load Card -->
            <div class="bg-base-100/60 backdrop-blur-md rounded-2xl border border-base-content/5 p-6 flex flex-col justify-between hover:border-orange-500/20 hover:shadow-md transition-all duration-300 group">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/10 group-hover:scale-105 transition-transform duration-300">
                    <Icon name="mdi:cpu-64-bit" class="text-orange-500 w-5 h-5" />
                  </div>
                  <div>
                    <h3 class="font-extrabold text-sm tracking-tight">CPU Usage</h3>
                    <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest">Processor Load</p>
                  </div>
                </div>

                <!-- CPU Radial Ring -->
                <div v-if="!isLoading" class="relative w-12 h-12 flex items-center justify-center">
                  <svg class="w-full h-full transform -rotate-90">
                    <circle cx="24" cy="24" r="19" stroke="currentColor" class="text-base-content/5" stroke-width="4" fill="transparent" />
                    <circle 
                      cx="24" 
                      cy="24" 
                      r="19" 
                      stroke="currentColor" 
                      class="text-orange-500 transition-all duration-1000 ease-out" 
                      stroke-width="4" 
                      fill="transparent" 
                      stroke-dasharray="119.38" 
                      :stroke-dashoffset="119.38 * (1 - cpuPercentage / 100)" 
                      stroke-linecap="round"
                    />
                  </svg>
                  <span class="absolute text-[9px] font-black text-orange-500">{{ cpuPercentage }}%</span>
                </div>
              </div>

              <div class="border-t border-base-content/5 pt-4 mt-2">
                <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest truncate" :title="stats?.cpu.model">
                  {{ stats?.cpu.model || 'Unknown CPU Core' }}
                </p>
              </div>
            </div>

            <!-- RAM Load Card -->
            <div class="bg-base-100/60 backdrop-blur-md rounded-2xl border border-base-content/5 p-6 flex flex-col justify-between hover:border-primary/20 hover:shadow-md transition-all duration-300 group">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/10 group-hover:scale-105 transition-transform duration-300">
                    <Icon name="mdi:memory" class="text-primary w-5 h-5" />
                  </div>
                  <div>
                    <h3 class="font-extrabold text-sm tracking-tight">RAM Usage</h3>
                    <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest">System Memory</p>
                  </div>
                </div>

                <!-- RAM Radial Ring -->
                <div v-if="!isLoading" class="relative w-12 h-12 flex items-center justify-center">
                  <svg class="w-full h-full transform -rotate-90">
                    <circle cx="24" cy="24" r="19" stroke="currentColor" class="text-base-content/5" stroke-width="4" fill="transparent" />
                    <circle 
                      cx="24" 
                      cy="24" 
                      r="19" 
                      stroke="currentColor" 
                      class="text-primary transition-all duration-1000 ease-out" 
                      stroke-width="4" 
                      fill="transparent" 
                      stroke-dasharray="119.38" 
                      :stroke-dashoffset="119.38 * (1 - ramPercentage / 100)" 
                      stroke-linecap="round"
                    />
                  </svg>
                  <span class="absolute text-[9px] font-black text-primary">{{ ramPercentage }}%</span>
                </div>
              </div>

              <!-- Details -->
              <div class="border-t border-base-content/5 pt-4 mt-2">
                <div class="flex justify-between text-[9px] font-bold text-base-content/40 uppercase tracking-widest">
                  <span>{{ formatSize(stats?.ram.used || 0) }} used</span>
                  <span>{{ formatSize(stats?.ram.total || 0) }} total</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Storage Distribution Treemap -->
          <div class="bg-base-100/60 backdrop-blur-md rounded-2xl border border-base-content/5 p-6 flex flex-col gap-6 hover:border-base-content/10 transition-all">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/10">
                <Icon name="mdi:chart-tree" class="text-primary w-5 h-5" />
              </div>
              <div>
                <h3 class="font-extrabold text-sm tracking-tight">Storage Allocation</h3>
                <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest">Filesystem distribution</p>
              </div>
            </div>

            <div v-if="isLoading" class="h-48 flex items-center justify-center">
              <span class="loading loading-spinner loading-md text-primary"></span>
            </div>
            <div v-else class="flex flex-col gap-6">
              <!-- Treemap Blocks -->
              <div class="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 auto-rows-[80px] gap-2">
                <div 
                  v-for="(node, index) in treemapNodes" 
                  :key="node.name"
                  class="rounded-xl p-3.5 transition-all duration-300 hover:scale-[1.02] hover:brightness-110 cursor-pointer flex flex-col justify-end group border border-white/5 shadow-sm"
                  :class="[
                    getTreemapColor(index),
                    index === 0 ? 'col-span-4 row-span-2 sm:col-span-4' : 
                    index === 1 ? 'col-span-2 row-span-2' : 
                    'col-span-2 row-span-1'
                  ]"
                  @mouseenter="hoveredNode = node"
                  @mouseleave="hoveredNode = null"
                >
                  <div class="flex flex-col min-w-0 text-white select-none">
                    <span class="text-[8px] font-bold uppercase tracking-widest opacity-80 truncate">{{ formatSize(node.size) }}</span>
                    <h4 class="text-[10px] font-black truncate leading-tight mt-0.5">{{ node.name }}</h4>
                  </div>
                </div>
              </div>

              <!-- Treemap Details Display -->
              <div class="bg-base-300/40 rounded-xl p-4 border border-base-content/5 min-h-[85px] flex flex-col justify-center transition-all duration-300">
                <div v-if="hoveredNode" class="animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <h4 class="font-extrabold text-sm text-primary truncate">{{ hoveredNode.name }}</h4>
                  <div class="flex items-baseline gap-2 mt-0.5">
                    <p class="text-lg font-black tracking-tight">{{ formatSize(hoveredNode.size) }}</p>
                    <p class="text-[8px] font-bold text-base-content/30 uppercase tracking-widest">
                      ~{{ storageMapData && storageMapData.size > 0 ? ((hoveredNode.size / storageMapData.size) * 100).toFixed(1) : '0.0' }}% of total cluster
                    </p>
                  </div>
                </div>
                <div v-else class="flex items-center justify-between opacity-40">
                  <p class="text-[9px] font-bold text-base-content uppercase tracking-widest pl-1">Hover over allocation tiles to explore</p>
                  <Icon name="mdi:gesture-tap" class="w-4 h-4 animate-bounce" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Secondary Column (Quick Actions & Activity Log) -->
        <div class="lg:col-span-5 flex flex-col gap-8">
          
          <!-- Quick Actions Grid -->
          <div class="space-y-4">
            <div class="flex items-center gap-2 px-1">
               <Icon name="mdi:chevron-right" class="text-base-content/40 w-4 h-4" />
               <h2 class="text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/40">Quick Access Tools</h2>
            </div>

            <div class="grid grid-cols-2 gap-4">
               <NuxtLink to="/files" class="group bg-base-100/60 backdrop-blur-md p-5 rounded-2xl border border-base-content/5 shadow-sm hover:border-blue-500/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <div class="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/10 mb-4 group-hover:scale-105 transition-transform duration-300">
                    <Icon name="mdi:folder-multiple-outline" class="text-blue-500 w-5 h-5" />
                  </div>
                  <h4 class="font-extrabold text-xs tracking-tight">Explore Files</h4>
                  <p class="text-[8px] font-bold text-base-content/30 uppercase tracking-widest mt-0.5">Manage storage</p>
               </NuxtLink>

               <NuxtLink to="/media" class="group bg-base-100/60 backdrop-blur-md p-5 rounded-2xl border border-base-content/5 shadow-sm hover:border-purple-500/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <div class="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/10 mb-4 group-hover:scale-105 transition-transform duration-300">
                    <Icon name="mdi:play-box-multiple-outline" class="text-purple-500 w-5 h-5" />
                  </div>
                  <h4 class="font-extrabold text-xs tracking-tight">Media Library</h4>
                  <p class="text-[8px] font-bold text-base-content/30 uppercase tracking-widest mt-0.5">Direct streams</p>
               </NuxtLink>

               <NuxtLink to="/shared" class="group bg-base-100/60 backdrop-blur-md p-5 rounded-2xl border border-base-content/5 shadow-sm hover:border-success/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <div class="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center border border-success/10 mb-4 group-hover:scale-105 transition-transform duration-300">
                    <Icon name="mdi:share-variant-outline" class="text-success w-5 h-5" />
                  </div>
                  <h4 class="font-extrabold text-xs tracking-tight">Shared Files</h4>
                  <p class="text-[8px] font-bold text-base-content/30 uppercase tracking-widest mt-0.5">Public assets</p>
               </NuxtLink>

               <NuxtLink to="/downloader" class="group bg-base-100/60 backdrop-blur-md p-5 rounded-2xl border border-base-content/5 shadow-sm hover:border-orange-500/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                  <div class="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/10 mb-4 group-hover:scale-105 transition-transform duration-300">
                    <Icon name="mdi:cloud-download-outline" class="text-orange-500 w-5 h-5" />
                  </div>
                  <h4 class="font-extrabold text-xs tracking-tight">Downloader</h4>
                  <p class="text-[8px] font-bold text-base-content/30 uppercase tracking-widest mt-0.5">Web Downloads</p>
               </NuxtLink>
            </div>
          </div>

          <!-- Recent Activity Log (Developer timeline) -->
          <div class="flex flex-col gap-4 flex-1">
            <div class="flex items-center justify-between px-1">
              <div class="flex items-center gap-2">
                 <Icon name="mdi:history" class="text-base-content/40 w-4 h-4" />
                 <h2 class="text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/40">Recent Activity</h2>
              </div>
              <NuxtLink to="/files" class="text-[8px] font-bold uppercase tracking-widest text-primary hover:underline transition-all">Explore all</NuxtLink>
            </div>

            <div class="bg-base-100/60 backdrop-blur-md rounded-2xl border border-base-content/5 shadow-sm overflow-hidden flex-grow flex flex-col min-h-[350px]">
              <div v-if="isLoading" class="p-6 space-y-4 flex-1">
                 <div v-for="i in 5" :key="i" class="h-12 w-full bg-base-200 animate-pulse rounded-xl"></div>
              </div>
              <div v-else-if="activities.length" class="p-6 overflow-y-auto custom-scrollbar flex-1 relative max-h-[500px]">
                 <!-- Vertical Timeline Line -->
                 <div class="absolute left-9 top-8 bottom-8 w-px bg-base-content/5"></div>
                 
                 <!-- Timeline Entries -->
                 <div class="space-y-6">
                   <div 
                     v-for="(activity, index) in activities" 
                     :key="index" 
                     class="flex gap-4 relative items-start group hover:-translate-x-0.5 transition-transform duration-200"
                   >
                     <!-- Colored Circle with Icon -->
                     <div :class="`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border relative z-10 ${getActionColor(activity.action)} border-base-content/5 group-hover:scale-105 transition-transform`">
                        <Icon :name="getActionIcon(activity.action)" class="w-3.5 h-3.5" />
                     </div>

                     <!-- Event Details -->
                     <div class="flex-grow min-w-0">
                        <div class="flex items-baseline justify-between gap-4">
                           <h4 class="text-xs font-extrabold truncate text-base-content/90" :title="activity.path">{{ activity.path }}</h4>
                           <span class="text-[8px] font-bold text-base-content/30 whitespace-nowrap uppercase tracking-wider">{{ formatTime(activity.timestamp) }}</span>
                        </div>
                        <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest mt-0.5 leading-relaxed truncate">
                           {{ activity.action }} {{ activity.details ? '• ' + activity.details : '' }}
                        </p>
                     </div>
                   </div>
                 </div>
              </div>
              <div v-else class="flex-1 flex flex-col items-center justify-center text-center p-6 min-h-[300px]">
                 <div class="w-12 h-12 rounded-2xl bg-base-content/5 flex items-center justify-center mb-4">
                   <Icon name="mdi:tray-blank-outline" class="w-6 h-6 text-base-content/20" />
                 </div>
                 <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest">No activities detected</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="w-full py-8 flex flex-col items-center gap-2 mt-auto">
       <div class="w-12 h-px bg-base-content/10"></div>
       <span class="text-[8px] font-bold uppercase tracking-[0.4em] text-base-content/20">ClyoCloud - v{{ useRuntimeConfig().public.version }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

useHead({
  title: 'Dashboard'
})

interface Stats {
  used: number
  total: number
  free: number
  drives: Array<{
    mount: string
    label: string
    total: number
    used: number
    available: number
    use: number
  }>
  cpu: {
    model: string
    cores: number
    load: number
  }
  ram: {
    total: number
    used: number
    free: number
  }
  username: string
}

interface ActivityEntry {
  action: string
  path: string
  timestamp: number
  details?: string
}

const stats = ref<Stats | null>(null)
const userState = useState<{ name: string } | null>('user')
const activities = ref<ActivityEntry[]>([])
const storageMapData = ref<{ name: string; size: number; children: any[] } | null>(null)
const isLoading = ref(true)
const hoveredNode = ref<any>(null)
let pollingInterval: any = null

async function fetchData() {
  try {
    const [statsRes, activityRes, storageRes] = await Promise.allSettled([
      fetch('/api/stats', { credentials: 'include' }).then(async r => r.ok ? await r.json() : null),
      fetch('/api/activity', { credentials: 'include' }).then(async r => r.ok ? await r.json() : []),
      fetch('/api/storage-map', { credentials: 'include' }).then(async r => r.ok ? await r.json() : null)
    ])
    
    if (statsRes.status === 'fulfilled' && statsRes.value) stats.value = statsRes.value
    if (activityRes.status === 'fulfilled' && activityRes.value) activities.value = activityRes.value
    if (storageRes.status === 'fulfilled' && storageRes.value) storageMapData.value = storageRes.value
  } catch (err) {
    console.error('Dashboard fetch error:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchData()
  pollingInterval = setInterval(fetchData, 5000)
})

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval)
})

const cpuPercentage = computed(() => stats.value ? Math.round(stats.value.cpu.load) : 0)
const ramPercentage = computed(() => {
  if (!stats.value) return 0
  return Math.round((stats.value.ram.used / stats.value.ram.total) * 100)
})

const treemapNodes = computed(() => {
  if (!storageMapData.value || !storageMapData.value.children) return []
  return [...storageMapData.value.children]
    .sort((a, b) => b.size - a.size)
    .slice(0, 12)
})

function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let val = bytes
  let i = 0
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024
    i++
  }
  return `${val.toFixed(1)} ${units[i]}`
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getActionColor(action: string) {
  switch (action) {
    case 'UPLOAD': return 'text-blue-500 bg-blue-500/10'
    case 'DOWNLOAD':
    case 'ZIP_DOWNLOAD':
    case 'PUBLIC_ZIP_DOWNLOAD': return 'text-sky-500 bg-sky-500/10'
    case 'DELETE': return 'text-red-500 bg-red-500/10'
    case 'RENAME':
    case 'MOVE': return 'text-orange-500 bg-orange-500/10'
    case 'MKDIR': return 'text-purple-500 bg-purple-500/10'
    case 'TAG': return 'text-primary bg-primary/10'
    case 'SHARE':
    case 'PUBLIC_ACCESS': return 'text-success bg-success/10'
    case 'FAVORITE': return 'text-orange-400 bg-orange-400/10'
    case 'LOGIN_SUCCESS': return 'text-success bg-success/10'
    case 'LOGIN_FAIL':
    case '2FA_FAIL': return 'text-error bg-error/10'
    case 'LOGIN_STEP1': return 'text-primary bg-primary/10'
    case 'PASSWORD_CHANGE': return 'text-warning bg-warning/10'
    default: return 'text-base-content/40 bg-base-content/5'
  }
}

function getActionIcon(action: string) {
  switch (action) {
    case 'UPLOAD': return 'mdi:cloud-upload'
    case 'DELETE': return 'mdi:delete'
    case 'RENAME': return 'mdi:pencil'
    case 'MOVE': return 'mdi:file-move'
    case 'MKDIR': return 'mdi:folder-plus'
    case 'TAG': return 'mdi:tag'
    case 'SHARE': return 'mdi:share-variant'
    case 'FAVORITE': return 'mdi:star'
    case 'DOWNLOAD': return 'mdi:download'
    case 'ZIP_DOWNLOAD': return 'mdi:folder-zip'
    case 'PUBLIC_ACCESS': return 'mdi:eye'
    case 'PUBLIC_ZIP_DOWNLOAD': return 'mdi:folder-zip'
    case 'REMOTE_DOWNLOAD_START': return 'mdi:cloud-download'
    case 'LOGIN_SUCCESS': return 'mdi:shield-check'
    case 'LOGIN_FAIL': return 'mdi:shield-alert'
    case 'LOGIN_STEP1': return 'mdi:shield-outline'
    case '2FA_FAIL': return 'mdi:shield-lock'
    case 'PASSWORD_CHANGE': return 'mdi:key-variant'
    default: return 'mdi:history'
  }
}

function getTreemapColor(index: number) {
  const colors = [
    'bg-primary', 
    'bg-secondary', 
    'bg-accent', 
    'bg-blue-500', 
    'bg-purple-500', 
    'bg-orange-500', 
    'bg-green-500', 
    'bg-rose-500'
  ]
  return colors[index % colors.length]
}
</script>
