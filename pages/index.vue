<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

interface Stats {
  used: number
  total: number
  free: number
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

const stats = ref<Stats | null>(null)
const isLoading = ref(true)
let refreshInterval: any = null

const fetchStats = async (silent = false) => {
  if (!silent) isLoading.value = true
  try {
    const data = await $fetch<Stats>('/api/stats')
    stats.value = data
  } catch (err) {
    console.error('Failed to fetch stats:', err)
  } finally {
    if (!silent) isLoading.value = false
  }
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

const storagePercentage = computed(() => {
  if (!stats.value) return 0
  return Math.min(100, Math.round((stats.value.used / stats.value.total) * 100))
})

const ramPercentage = computed(() => {
  if (!stats.value?.ram) return 0
  return Math.min(100, Math.round((stats.value.ram.used / stats.value.ram.total) * 100))
})

const cpuPercentage = computed(() => {
  if (!stats.value?.cpu) return 0
  // Load average as a percentage of available cores
  return Math.min(100, Math.round((stats.value.cpu.load / stats.value.cpu.cores) * 100))
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
    <header class="w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/5 py-6 px-4 sm:px-8 sticky top-0 z-30">
      <div class="max-w-[1400px] mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden">
            <Icon name="mdi:menu" class="w-5 h-5" />
          </label>
          <div>
            <h1 class="text-xl font-black tracking-tight leading-none">Dashboard</h1>
            <p class="text-[10px] font-bold text-base-content/30 uppercase tracking-widest pl-1 mt-1">System Overview</p>
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
          <!-- Storage Card -->
          <section class="flex-1 bg-base-100 rounded-[2.5rem] shadow-xl shadow-base-content/5 border border-base-content/5 p-8 sm:p-10 flex flex-col justify-between">
            <div class="flex items-center justify-between mb-8">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Icon name="mdi:harddisk" class="text-primary w-6 h-6" />
                </div>
                <div>
                  <h3 class="font-black text-lg tracking-tight">Cloud Storage</h3>
                  <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">Global Capacity</p>
                </div>
              </div>
              <div v-if="!isLoading" class="text-right">
                <span class="text-2xl font-black tracking-tight">{{ storagePercentage }}%</span>
              </div>
            </div>

            <div v-if="isLoading" class="space-y-4">
               <div class="h-4 w-full bg-base-200 animate-pulse rounded-full"></div>
               <div class="flex justify-between">
                  <div class="h-3 w-20 bg-base-200 animate-pulse rounded"></div>
                  <div class="h-3 w-20 bg-base-200 animate-pulse rounded"></div>
               </div>
            </div>

            <div v-else class="space-y-6">
              <div class="relative pt-1">
                <div class="overflow-hidden h-4 text-xs flex rounded-full bg-base-200 shadow-inner">
                  <div 
                    :style="{ width: storagePercentage + '%' }" 
                    class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-1000 ease-out"
                  ></div>
                </div>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-3 gap-6">
                <div class="flex flex-col gap-1">
                  <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Used</span>
                  <span class="text-base font-bold">{{ formatSize(stats?.used || 0) }}</span>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Available</span>
                  <span class="text-base font-bold">{{ formatSize(stats?.free || 0) }}</span>
                </div>
                <div class="flex flex-col gap-1 col-span-2 sm:col-span-1">
                  <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Total</span>
                  <span class="text-base font-bold text-base-content/60">{{ formatSize(stats?.total || 0) }}</span>
                </div>
              </div>
            </div>
          </section>

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
        </div>

        <!-- Secondary Column (Quick Terminal & RAM) -->
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

          <!-- Memory Load Section -->
          <div class="flex-1 bg-base-100 rounded-[2.5rem] p-8 border border-base-content/5 shadow-xl shadow-base-content/5 flex flex-col justify-center gap-6">
             <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                     <Icon name="mdi:memory" class="text-primary w-5 h-5" />
                  </div>
                  <div>
                    <h4 class="font-black text-sm uppercase tracking-tight">Memory Load</h4>
                    <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">System RAM</p>
                  </div>
                </div>
                <div v-if="!isLoading" class="text-right">
                  <span class="text-lg font-black tracking-tight">{{ ramPercentage }}%</span>
                </div>
             </div>

             <div v-if="isLoading" class="space-y-2">
                <div class="h-2 w-full bg-base-200 animate-pulse rounded-full"></div>
             </div>
             <div v-else class="space-y-4">
                <div class="overflow-hidden h-2.5 text-xs flex rounded-full bg-base-200">
                  <div 
                    :style="{ width: ramPercentage + '%' }" 
                    class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-primary transition-all duration-1000 ease-out"
                  ></div>
                </div>
                <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30">
                   <span>Used: {{ formatSize(stats?.ram.used || 0) }}</span>
                   <span>Total: {{ formatSize(stats?.ram.total || 0) }}</span>
                </div>
             </div>
          </div>
        </div>
      </div>
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
