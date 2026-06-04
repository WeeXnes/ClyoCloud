<template>
  <div class="min-h-screen bg-base-200/50 flex flex-col font-sans">
    <!-- Header Area -->
    <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/10">
      <div class="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3">
          <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden">
            <Icon name="mdi:menu" class="w-5 h-5" />
          </label>
          <div>
            <h1 class="text-lg font-bold tracking-tight flex items-center gap-2 text-base-content">
              <Icon name="mdi:view-dashboard-outline" class="text-primary w-5 h-5" />
              Dashboard
            </h1>
            <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest pl-1">System Overview</p>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-[1400px] mx-auto px-4 py-6 sm:px-8 space-y-8">
      <!-- Welcome Section -->
      <section class="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 class="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-base-content">Welcome back, <span class="text-primary">{{ stats?.username || 'User' }}</span></h2>
          <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">Your personal cloud is synchronized and secure</p>
        </div>
        <div class="flex items-center gap-4">
           <NuxtLink to="/files" class="btn btn-primary rounded-lg px-6 shadow-sm gap-2 font-bold text-xs uppercase tracking-wider">
             <Icon name="mdi:cloud-upload" class="w-4 h-4" />
             Upload New
           </NuxtLink>
        </div>
      </section>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        <!-- Main Column (Storage & CPU) -->
        <div class="lg:col-span-7 flex flex-col gap-6">
          <!-- Multi-Drive Storage Section -->
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-2 px-1">
               <Icon name="mdi:harddisk" class="text-base-content/30 w-4 h-4" />
               <h2 class="text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/40">System Storage</h2>
            </div>

            <!-- Drive Grid -->
            <div class="grid grid-cols-1 gap-6">
              <template v-if="isLoading">
                <div v-for="i in 2" :key="i" class="bg-base-100 rounded-xl p-6 border border-base-content/10 animate-pulse h-40"></div>
              </template>
              <template v-else>
                <section 
                  v-for="drive in stats?.drives" 
                  :key="drive.mount"
                  class="bg-base-100 rounded-xl shadow-sm border border-base-content/10 p-6 sm:p-8 flex flex-col justify-between"
                >
                  <div class="flex items-center justify-between mb-6">
                    <div class="flex items-center gap-4">
                      <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon :name="drive.mount === '/' ? 'mdi:folder-home' : 'mdi:database-outline'" class="text-primary w-5 h-5" />
                      </div>
                      <div>
                        <h3 class="font-bold text-base tracking-tight text-base-content">{{ drive.mount }}</h3>
                        <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">{{ drive.label }}</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <span class="text-xl font-bold tracking-tight text-base-content">{{ Math.round(drive.use) }}%</span>
                    </div>
                  </div>

                  <div class="space-y-4">
                    <div class="relative">
                      <div class="overflow-hidden h-2.5 text-xs flex rounded-full bg-base-200">
                        <div 
                          :style="{ width: drive.use + '%' }" 
                          class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-1000 ease-out"
                          :class="{ '!bg-error': drive.use > 90, '!bg-warning': drive.use > 75 }"
                        ></div>
                      </div>
                    </div>

                    <div class="grid grid-cols-3 gap-4">
                      <div class="flex flex-col gap-0.5">
                        <span class="text-[9px] font-bold uppercase tracking-widest text-base-content/30">Used</span>
                        <span class="text-sm font-bold text-base-content/70">{{ formatSize(drive.used) }}</span>
                      </div>
                      <div class="flex flex-col gap-0.5">
                        <span class="text-[9px] font-bold uppercase tracking-widest text-base-content/30">Available</span>
                        <span class="text-sm font-bold text-base-content/70">{{ formatSize(drive.available) }}</span>
                      </div>
                      <div class="flex flex-col gap-0.5 text-right">
                        <span class="text-[9px] font-bold uppercase tracking-widest text-base-content/30">Total</span>
                        <span class="text-sm font-bold text-base-content/40">{{ formatSize(drive.total) }}</span>
                      </div>
                    </div>
                  </div>
                </section>
              </template>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <!-- CPU Card -->
            <section class="bg-base-100 rounded-xl shadow-sm border border-base-content/10 p-6 flex flex-col justify-between">
              <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Icon name="mdi:cpu-64-bit" class="text-orange-500 w-5 h-5" />
                  </div>
                  <div>
                    <h3 class="font-bold text-sm tracking-tight text-base-content">CPU Load</h3>
                    <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">Processor</p>
                  </div>
                </div>
                <div v-if="!isLoading" class="text-right">
                  <span class="text-xl font-bold tracking-tight text-base-content">{{ cpuPercentage }}%</span>
                </div>
              </div>

              <div v-if="isLoading" class="space-y-2">
                 <div class="h-2.5 w-full bg-base-200 animate-pulse rounded-full"></div>
              </div>
              <div v-else class="space-y-4">
                <div class="relative">
                  <div class="overflow-hidden h-2.5 text-xs flex rounded-full bg-base-200">
                    <div 
                      :style="{ width: cpuPercentage + '%' }" 
                      class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-orange-500 transition-all duration-1000 ease-out"
                    ></div>
                  </div>
                </div>
                <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest truncate">{{ stats?.cpu.model }}</p>
              </div>
            </section>

            <!-- Memory Card -->
            <section class="bg-base-100 rounded-xl shadow-sm border border-base-content/10 p-6 flex flex-col justify-between">
              <div class="flex items-center justify-between mb-6">
                 <div class="flex items-center gap-3">
                   <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon name="mdi:memory" class="text-primary w-5 h-5" />
                   </div>
                   <div>
                     <h3 class="font-bold text-sm tracking-tight text-base-content">RAM Load</h3>
                     <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">Memory</p>
                   </div>
                 </div>
                 <div v-if="!isLoading" class="text-right">
                   <span class="text-xl font-bold tracking-tight text-base-content">{{ ramPercentage }}%</span>
                 </div>
              </div>

              <div v-if="isLoading" class="space-y-2">
                 <div class="h-2.5 w-full bg-base-200 animate-pulse rounded-full"></div>
              </div>
              <div v-else class="space-y-4">
                 <div class="relative">
                   <div class="overflow-hidden h-2.5 text-xs flex rounded-full bg-base-200">
                     <div 
                       :style="{ width: ramPercentage + '%' }" 
                       class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-1000 ease-out"
                     ></div>
                   </div>
                 </div>
                 <div class="flex justify-between text-[10px] font-bold text-base-content/40 uppercase tracking-widest">
                   <span>{{ formatSize(stats?.ram.used || 0) }} used</span>
                   <span>{{ formatSize(stats?.ram.total || 0) }} total</span>
                 </div>
              </div>
            </section>
          </div>

          <!-- Storage Distribution -->
          <section class="bg-base-100 rounded-xl shadow-sm border border-base-content/10 p-6 flex flex-col gap-6">
            <div class="flex items-center justify-between">
               <div class="flex items-center gap-3">
                 <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon name="mdi:chart-tree" class="text-primary w-5 h-5" />
                 </div>
                 <div>
                   <h3 class="font-bold text-sm tracking-tight text-base-content">Storage Distribution</h3>
                   <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">Resource Allocation</p>
                 </div>
               </div>
            </div>

            <div v-if="isLoading" class="h-48 flex items-center justify-center">
              <div class="loading loading-spinner loading-md text-primary"></div>
            </div>
            <div v-else class="flex flex-col gap-6">
              <div class="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 auto-rows-[80px] gap-2">
                <div 
                  v-for="(node, index) in treemapNodes" 
                  :key="node.name"
                  class="rounded-lg p-3 transition-all duration-200 hover:brightness-110 cursor-pointer flex flex-col justify-end group border border-white/5"
                  :class="[
                    getTreemapColor(index),
                    index === 0 ? 'col-span-4 row-span-2 sm:col-span-4' : 
                    index === 1 ? 'col-span-2 row-span-2' : 
                    'col-span-2 row-span-1'
                  ]"
                  @mouseenter="hoveredNode = node"
                  @mouseleave="hoveredNode = null"
                >
                  <div class="flex flex-col min-w-0 text-white">
                    <span class="text-[9px] font-bold uppercase tracking-widest opacity-70 truncate">{{ formatSize(node.size) }}</span>
                    <h4 class="text-[11px] font-bold truncate">{{ node.name }}</h4>
                  </div>
                </div>
              </div>

              <div class="bg-base-200/50 rounded-lg p-4 border border-base-content/5 min-h-[80px] flex flex-col justify-center">
                <div v-if="hoveredNode" class="animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <h4 class="font-bold text-sm text-primary truncate">{{ hoveredNode.name }}</h4>
                  <div class="flex items-baseline gap-2 mt-0.5">
                    <p class="text-lg font-bold tracking-tight text-base-content">{{ formatSize(hoveredNode.size) }}</p>
                    <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest">
                      ~{{ storageMapData ? ((hoveredNode.size / storageMapData.size) * 100).toFixed(1) : 0 }}% of total
                    </p>
                  </div>
                </div>
                <div v-else class="flex items-center justify-between opacity-30">
                  <p class="text-[10px] font-bold text-base-content uppercase tracking-widest">Hover items to explore allocation</p>
                  <Icon name="mdi:gesture-tap" class="w-4 h-4" />
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Secondary Column (Quick Actions & Activity) -->
        <div class="lg:col-span-5 flex flex-col gap-6">
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-2 px-1">
               <Icon name="mdi:chevron-right" class="text-base-content/30 w-4 h-4" />
               <h2 class="text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/40">Quick Actions</h2>
            </div>

            <div class="grid grid-cols-2 gap-3">
               <NuxtLink to="/files" class="group bg-base-100 p-5 rounded-xl border border-base-content/10 shadow-sm hover:border-primary/30 transition-all duration-200">
                  <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                    <Icon name="mdi:folder-multiple-outline" class="text-blue-500 w-4 h-4" />
                  </div>
                  <h4 class="font-bold text-xs uppercase tracking-tight text-base-content">Explore Files</h4>
                  <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest mt-0.5">Manage Storage</p>
               </NuxtLink>

               <NuxtLink to="/media" class="group bg-base-100 p-5 rounded-xl border border-base-content/10 shadow-sm hover:border-primary/30 transition-all duration-200">
                  <div class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                    <Icon name="mdi:play-box-multiple-outline" class="text-purple-500 w-4 h-4" />
                  </div>
                  <h4 class="font-bold text-xs uppercase tracking-tight text-base-content">Media Library</h4>
                  <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest mt-0.5">Direct Playback</p>
               </NuxtLink>

               <NuxtLink to="/shared" class="group bg-base-100 p-5 rounded-xl border border-base-content/10 shadow-sm hover:border-primary/30 transition-all duration-200">
                  <div class="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center mb-3">
                    <Icon name="mdi:share-variant-outline" class="text-success w-4 h-4" />
                  </div>
                  <h4 class="font-bold text-xs uppercase tracking-tight text-base-content">Shared</h4>
                  <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest mt-0.5">Manage Public</p>
               </NuxtLink>

               <NuxtLink to="/downloader" class="group bg-base-100 p-5 rounded-xl border border-base-content/10 shadow-sm hover:border-primary/30 transition-all duration-200">
                  <div class="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center mb-3">
                    <Icon name="mdi:cloud-download-outline" class="text-orange-500 w-4 h-4" />
                  </div>
                  <h4 class="font-bold text-xs uppercase tracking-tight text-base-content">Downloader</h4>
                  <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest mt-0.5">Remote Ingest</p>
               </NuxtLink>
            </div>
          </div>

          <!-- Recent Activity -->
          <div class="flex flex-col gap-4 flex-1">
            <div class="flex items-center justify-between px-1">
              <div class="flex items-center gap-2">
                 <Icon name="mdi:history" class="text-base-content/30 w-4 h-4" />
                 <h2 class="text-[10px] font-bold uppercase tracking-[0.2em] text-base-content/40">Recent Activity</h2>
              </div>
              <NuxtLink to="/files" class="text-[9px] font-bold uppercase tracking-widest text-primary hover:underline">View All</NuxtLink>
            </div>

            <div class="bg-base-100 rounded-xl border border-base-content/10 shadow-sm overflow-hidden flex-1">
              <div v-if="isLoading" class="p-4 space-y-3">
                 <div v-for="i in 5" :key="i" class="h-10 w-full bg-base-200 animate-pulse rounded-lg"></div>
              </div>
              <div v-else-if="activities.length" class="divide-y divide-base-content/5">
                 <div v-for="(activity, index) in activities" :key="index" class="p-3.5 flex items-center gap-3 hover:bg-base-200/50 transition-colors group">
                    <div :class="`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getActionColor(activity.action)}`">
                       <Icon :name="getActionIcon(activity.action)" class="w-4 h-4" />
                    </div>
                    <div class="flex-grow min-w-0">
                       <div class="flex items-center justify-between gap-2">
                          <h4 class="text-xs font-bold truncate text-base-content">{{ activity.path }}</h4>
                          <span class="text-[9px] font-bold text-base-content/30 whitespace-nowrap">{{ formatTime(activity.timestamp) }}</span>
                       </div>
                       <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest truncate">
                          {{ activity.action }} {{ activity.details ? '• ' + activity.details : '' }}
                       </p>
                    </div>
                 </div>
              </div>
              <div v-else class="h-48 flex flex-col items-center justify-center text-center p-6">
                 <Icon name="mdi:tray-blank-outline" class="w-10 h-10 text-base-content/10 mb-2" />
                 <p class="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">No recent activity detected</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <footer class="w-full py-6 px-8 flex flex-col items-center gap-2 mt-auto">
       <div class="flex items-center gap-4 opacity-20">
          <span class="text-[8px] font-bold uppercase tracking-[0.4em]">ClyoCloud - v{{ useRuntimeConfig().public.version }}</span>
       </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

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
    load_raw: number
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
const activities = ref<ActivityEntry[]>([])
const storageMapData = ref<{ name: string; size: number; children: any[] } | null>(null)
const isLoading = ref(true)
const hoveredNode = ref<any>(null)
let pollingInterval: any = null

async function fetchData() {
  try {
    const [statsRes, activityRes, storageRes] = await Promise.all([
      fetch('/api/stats', { credentials: 'include' }),
      fetch('/api/activity', { credentials: 'include' }),
      fetch('/api/storage-map', { credentials: 'include' })
    ])
    
    if (statsRes.ok) stats.value = await statsRes.json()
    if (activityRes.ok) activities.value = await activityRes.json()
    if (storageRes.ok) storageMapData.value = await storageRes.json()
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

const cpuPercentage = computed(() => stats.value ? Math.round(stats.value.cpu.load_raw * 100) : 0)
const ramPercentage = computed(() => {
  if (!stats.value) return 0
  return Math.round((stats.value.ram.used / stats.value.ram.total) * 100)
})

const treemapNodes = computed(() => {
  if (!storageMapData.value) return []
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
  const a = action.toLowerCase()
  if (a.includes('upload') || a.includes('create')) return 'bg-success/10 text-success'
  if (a.includes('delete')) return 'bg-error/10 text-error'
  if (a.includes('move') || a.includes('rename')) return 'bg-primary/10 text-primary'
  return 'bg-base-content/10 text-base-content/40'
}

function getActionIcon(action: string) {
  const a = action.toLowerCase()
  if (a.includes('upload')) return 'mdi:cloud-upload'
  if (a.includes('delete')) return 'mdi:delete'
  if (a.includes('move')) return 'mdi:folder-move'
  if (a.includes('rename')) return 'mdi:pencil'
  if (a.includes('create')) return 'mdi:folder-plus'
  return 'mdi:history'
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
