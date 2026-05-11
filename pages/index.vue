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
  ram: {
    total: number
    used: number
    free: number
  }
  cpu: {
    model: string
    cores: number
    load: number
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
const isLoading = ref(true)
let refreshInterval: any = null

const fetchStats = async (silent = false) => {
  if (!silent) isLoading.value = true
  try {
    const [statsData, activityData] = await Promise.all([
      $fetch<Stats>('/api/stats'),
      $fetch<ActivityEntry[]>('/api/activity')
    ])
    stats.value = statsData
    activities.value = activityData
  } catch (err) {
    console.error('Failed to fetch dashboard data:', err)
  } finally {
    if (!silent) isLoading.value = false
  }
}

const getActionIcon = (action: string) => {
  switch (action) {
    case 'UPLOAD': return 'mdi:cloud-upload'
    case 'DELETE': return 'mdi:delete'
    case 'RENAME': return 'mdi:pencil'
    case 'MKDIR': return 'mdi:folder-plus'
    case 'TAG': return 'mdi:tag'
    case 'SHARE': return 'mdi:share-variant'
    case 'FAVORITE': return 'mdi:star'
    default: return 'mdi:history'
  }
}

const getActionColor = (action: string) => {
  switch (action) {
    case 'UPLOAD': return 'text-blue-500 bg-blue-500/10'
    case 'DELETE': return 'text-red-500 bg-red-500/10'
    case 'RENAME': return 'text-orange-500 bg-orange-500/10'
    case 'MKDIR': return 'text-purple-500 bg-purple-500/10'
    case 'TAG': return 'text-primary bg-primary/10'
    case 'SHARE': return 'text-success bg-success/10'
    case 'FAVORITE': return 'text-orange-400 bg-orange-400/10'
    default: return 'text-base-content/40 bg-base-content/5'
  }
}

const formatTime = (timestamp: number) => {
  const diff = Date.now() - timestamp
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(timestamp).toLocaleDateString()
}

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

const ramPercentage = computed(() => {
  if (!stats.value?.ram) return 0
  return Math.min(100, Math.round((stats.value.ram.used / stats.value.ram.total) * 100))
})

const cpuPercentage = computed(() => {
  if (!stats.value?.cpu) return 0
  return Math.min(100, Math.round(stats.value.cpu.load))
})

onMounted(() => {
  fetchStats()
  // Refresh every 10 seconds
  refreshInterval = setInterval(() => fetchStats(true), 10000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<template>
  <div class="min-h-screen bg-base-200/50 flex flex-col font-sans">
    <!-- Header Area -->
    <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/5">
      <div class="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3">
          <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden">
            <Icon name="mdi:menu" class="w-5 h-5" />
          </label>
          <div>
            <h1 class="text-xl font-black tracking-tight flex items-center gap-2">
              <Icon name="mdi:view-dashboard-outline" class="text-primary w-6 h-6" />
              Dashboard
            </h1>
            <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">System Overview</p>
          </div>
        </div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-[1400px] mx-auto px-4 py-8 sm:px-8 space-y-10">
      <!-- Welcome Section -->
      <section class="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 class="text-3xl sm:text-4xl font-black tracking-tight mb-2">Welcome back, <span class="text-primary">{{ stats?.username || 'User' }}</span></h2>
          <p class="text-sm font-bold text-base-content/40 uppercase tracking-widest">Your personal cloud is synchronized and secure</p>
        </div>
        <div class="flex items-center gap-4">
           <NuxtLink to="/files" class="btn btn-primary rounded-2xl px-8 shadow-lg shadow-primary/20 gap-2">
             <Icon name="mdi:cloud-upload" class="w-5 h-5" />
             Upload New
           </NuxtLink>
        </div>
      </section>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        <!-- Main Column (Storage & CPU) -->
        <div class="lg:col-span-7 flex flex-col gap-8">
          <!-- Multi-Drive Storage Section -->
          <div class="flex flex-col gap-6">
            <div class="flex items-center gap-3 px-2">
               <div class="w-8 h-8 rounded-lg bg-base-content/5 flex items-center justify-center">
                 <Icon name="mdi:harddisk" class="text-base-content/40 w-5 h-5" />
               </div>
               <h2 class="text-sm font-black uppercase tracking-[0.2em] text-base-content/40">System Storage</h2>
            </div>

            <!-- Drive Grid -->
            <div class="grid grid-cols-1 gap-6">
              <template v-if="isLoading">
                <div v-for="i in 2" :key="i" class="bg-base-100 rounded-[2.5rem] p-8 border border-base-content/5 animate-pulse h-48"></div>
              </template>
              <template v-else>
                <section 
                  v-for="drive in stats?.drives" 
                  :key="drive.mount"
                  class="bg-base-100 rounded-[2.5rem] shadow-xl shadow-base-content/5 border border-base-content/5 p-8 sm:p-10 flex flex-col justify-between"
                >
                  <div class="flex items-center justify-between mb-8">
                    <div class="flex items-center gap-4">
                      <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Icon :name="drive.mount === '/' ? 'mdi:folder-home' : 'mdi:database-outline'" class="text-primary w-6 h-6" />
                      </div>
                      <div>
                        <h3 class="font-black text-lg tracking-tight">{{ drive.mount }}</h3>
                        <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">{{ drive.label }}</p>
                      </div>
                    </div>
                    <div class="text-right">
                      <span class="text-2xl font-black tracking-tight">{{ Math.round(drive.use) }}%</span>
                    </div>
                  </div>

                  <div class="space-y-6">
                    <div class="relative pt-1">
                      <div class="overflow-hidden h-4 text-xs flex rounded-full bg-base-200 shadow-inner">
                        <div 
                          :style="{ width: drive.use + '%' }" 
                          class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-1000 ease-out"
                          :class="{ '!bg-error': drive.use > 90, '!bg-warning': drive.use > 75 }"
                        ></div>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-6">
                      <div class="flex flex-col gap-1">
                        <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Used</span>
                        <span class="text-base font-bold">{{ formatSize(drive.used) }}</span>
                      </div>
                      <div class="flex flex-col gap-1">
                        <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Available</span>
                        <span class="text-base font-bold">{{ formatSize(drive.available) }}</span>
                      </div>
                      <div class="flex flex-col gap-1 col-span-2 sm:col-span-1">
                        <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Total</span>
                        <span class="text-base font-bold text-base-content/60">{{ formatSize(drive.total) }}</span>
                      </div>
                    </div>
                  </div>
                </section>
              </template>
            </div>
          </div>

          <!-- CPU Card -->
          <section class="flex-1 bg-base-100 rounded-[2.5rem] shadow-xl shadow-base-content/5 border border-base-content/5 p-8 sm:p-10 flex flex-col justify-between">
            <div class="flex items-center justify-between mb-8">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                  <Icon name="mdi:cpu-64-bit" class="text-orange-500 w-6 h-6" />
                </div>
                <div>
                  <h3 class="font-black text-lg tracking-tight">Processor Load</h3>
                  <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">Computational Power</p>
                </div>
              </div>
              <div v-if="!isLoading" class="text-right">
                <span class="text-2xl font-black tracking-tight">{{ cpuPercentage }}%</span>
              </div>
            </div>

            <div v-if="isLoading" class="space-y-4">
               <div class="h-4 w-full bg-base-200 animate-pulse rounded-full"></div>
            </div>

            <div v-else class="space-y-6">
              <div class="relative pt-1">
                <div class="overflow-hidden h-4 text-xs flex rounded-full bg-base-200 shadow-inner">
                  <div 
                    :style="{ width: cpuPercentage + '%' }" 
                    class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-orange-500 transition-all duration-1000 ease-out"
                  ></div>
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Model Identity</span>
                <span class="text-sm font-bold truncate max-w-full">{{ stats?.cpu.model }}</span>
                <div class="flex items-center gap-4 mt-1 text-base-content/40">
                  <span class="text-[10px] font-bold uppercase tracking-widest">{{ stats?.cpu.cores }} Logical Cores</span>
                  <span class="w-1 h-1 rounded-full bg-base-content/20"></span>
                  <span class="text-[10px] font-bold uppercase tracking-widest">Load: {{ stats?.cpu.load.toFixed(2) }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Memory Load Card -->
          <section class="flex-1 bg-base-100 rounded-[2.5rem] shadow-xl shadow-base-content/5 border border-base-content/5 p-8 sm:p-10 flex flex-col justify-between">
            <div class="flex items-center justify-between mb-8">
               <div class="flex items-center gap-4">
                 <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Icon name="mdi:memory" class="text-primary w-6 h-6" />
                 </div>
                 <div>
                   <h3 class="font-black text-lg tracking-tight">Memory Load</h3>
                   <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">System RAM</p>
                 </div>
               </div>
               <div v-if="!isLoading" class="text-right">
                 <span class="text-2xl font-black tracking-tight">{{ ramPercentage }}%</span>
               </div>
            </div>

            <div v-if="isLoading" class="space-y-4">
               <div class="h-4 w-full bg-base-200 animate-pulse rounded-full"></div>
            </div>
            <div v-else class="space-y-6">
               <div class="relative pt-1">
                 <div class="overflow-hidden h-4 text-xs flex rounded-full bg-base-200 shadow-inner">
                   <div 
                     :style="{ width: ramPercentage + '%' }" 
                     class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-1000 ease-out"
                   ></div>
                 </div>
               </div>
               <div class="grid grid-cols-2 gap-6">
                  <div class="flex flex-col gap-1">
                    <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Used</span>
                    <span class="text-base font-bold">{{ formatSize(stats?.ram.used || 0) }}</span>
                  </div>
                  <div class="flex flex-col gap-1">
                    <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Total</span>
                    <span class="text-base font-bold text-base-content/60">{{ formatSize(stats?.ram.total || 0) }}</span>
                  </div>
               </div>
            </div>
          </section>
        </div>

        <!-- Secondary Column (Quick Terminal) -->
        <div class="lg:col-span-5 flex flex-col gap-8">
          <div class="flex flex-col gap-6">
            <div class="flex items-center gap-3 px-2">
               <div class="w-8 h-8 rounded-lg bg-base-content/5 flex items-center justify-center">
                 <Icon name="mdi:chevron-right" class="text-base-content/40 w-5 h-5" />
               </div>
               <h2 class="text-sm font-black uppercase tracking-[0.2em] text-base-content/40">Quick Terminal</h2>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <NuxtLink to="/files" class="group bg-base-100 p-6 rounded-[2rem] border border-base-content/5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon name="mdi:folder-multiple-outline" class="text-blue-500 w-5 h-5" />
                  </div>
                  <h4 class="font-black text-sm uppercase tracking-tight">Explore Files</h4>
                  <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-1">Manage Storage</p>
               </NuxtLink>

               <NuxtLink to="/media" class="group bg-base-100 p-6 rounded-[2rem] border border-base-content/5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div class="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon name="mdi:play-box-multiple-outline" class="text-purple-500 w-5 h-5" />
                  </div>
                  <h4 class="font-black text-sm uppercase tracking-tight">Media Library</h4>
                  <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-1">Direct Playback</p>
               </NuxtLink>

               <NuxtLink to="/shared" class="group bg-base-100 p-6 rounded-[2rem] border border-base-content/5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div class="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon name="mdi:share-variant-outline" class="text-success w-5 h-5" />
                  </div>
                  <h4 class="font-black text-sm uppercase tracking-tight">Shared</h4>
                  <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-1">Manage Public</p>
               </NuxtLink>

               <NuxtLink to="/downloader" class="group bg-base-100 p-6 rounded-[2rem] border border-base-content/5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div class="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon name="mdi:cloud-download-outline" class="text-orange-500 w-5 h-5" />
                  </div>
                  <h4 class="font-black text-sm uppercase tracking-tight">Downloader</h4>
                  <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-1">Remote Ingest</p>
               </NuxtLink>

               <NuxtLink to="/settings" class="group bg-base-100 p-6 rounded-[2rem] border border-base-content/5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div class="w-10 h-10 rounded-xl bg-base-content/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Icon name="mdi:cog-outline" class="text-base-content/40 w-5 h-5" />
                  </div>
                  <h4 class="font-black text-sm uppercase tracking-tight">Preferences</h4>
                  <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-1">Configure Core</p>
               </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity Section -->
      <section class="space-y-6">
        <div class="flex items-center justify-between px-2">
          <div class="flex items-center gap-3">
             <div class="w-8 h-8 rounded-lg bg-base-content/5 flex items-center justify-center">
               <Icon name="mdi:history" class="text-base-content/40 w-5 h-5" />
             </div>
             <h2 class="text-sm font-black uppercase tracking-[0.2em] text-base-content/40">Recent Activity</h2>
          </div>
          <NuxtLink to="/files" class="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">View All Files</NuxtLink>
        </div>

        <div class="bg-base-100 rounded-[2.5rem] border border-base-content/5 shadow-xl shadow-base-content/5 overflow-hidden">
          <div v-if="isLoading" class="p-8 space-y-4">
             <div v-for="i in 3" :key="i" class="h-12 w-full bg-base-200 animate-pulse rounded-2xl"></div>
          </div>
          <div v-else-if="activities.length" class="divide-y divide-base-content/5">
             <div v-for="(activity, index) in activities" :key="index" class="p-4 sm:p-6 flex items-center gap-4 hover:bg-base-200/30 transition-colors group">
                <div :class="`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getActionColor(activity.action)}`">
                   <Icon :name="getActionIcon(activity.action)" class="w-5 h-5" />
                </div>
                <div class="flex-grow min-w-0">
                   <div class="flex items-center justify-between gap-2">
                      <h4 class="text-sm font-black truncate">{{ activity.path }}</h4>
                      <span class="text-[10px] font-bold text-base-content/30 whitespace-nowrap">{{ formatTime(activity.timestamp) }}</span>
                   </div>
                   <p class="text-[11px] font-medium text-base-content/40 truncate">
                      {{ activity.action }} {{ activity.details ? '• ' + activity.details : '' }}
                   </p>
                </div>
                <Icon name="mdi:chevron-right" class="w-4 h-4 text-base-content/10 group-hover:text-primary transition-colors" />
             </div>
          </div>
          <div v-else class="p-12 text-center">
             <Icon name="mdi:tray-blank-outline" class="w-12 h-12 text-base-content/10 mx-auto mb-4" />
             <p class="text-xs font-bold text-base-content/30 uppercase tracking-widest">No recent activity detected</p>
          </div>
        </div>
      </section>
    </main>

    <footer class="w-full py-8 px-8 flex flex-col items-center gap-4 mt-auto">
       <div class="flex items-center gap-6 opacity-30">
          <span class="text-[9px] font-black uppercase tracking-[0.4em]">ClyoCloud Kernel</span>
          <div class="w-1 h-1 rounded-full bg-base-content"></div>
          <span class="text-[9px] font-black uppercase tracking-[0.4em]">Node v{{ useRuntimeConfig().public.version }}</span>
       </div>
    </footer>
  </div>
</template>
