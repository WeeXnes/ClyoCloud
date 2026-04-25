<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

interface Stats {
  used: number
  total: number
  free: number
  username: string
}

const stats = ref<Stats | null>(null)
const isLoading = ref(true)

const fetchStats = async () => {
  try {
    const data = await $fetch<Stats>('/api/stats')
    stats.value = data
  } catch (err) {
    console.error('Failed to fetch stats:', err)
  } finally {
    isLoading.value = false
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

onMounted(fetchStats)
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
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <!-- Storage Card -->
        <div class="lg:col-span-7">
          <div class="bg-base-100 rounded-[2.5rem] shadow-xl shadow-base-content/5 border border-base-content/5 p-8 sm:p-10 flex flex-col h-full">
            <div class="flex items-center justify-between mb-10">
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
                <p class="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">Utilized</p>
              </div>
            </div>

            <div v-if="isLoading" class="space-y-6 flex-grow flex flex-col justify-center">
               <div class="h-4 w-full bg-base-200 animate-pulse rounded-full"></div>
               <div class="flex justify-between">
                  <div class="h-4 w-24 bg-base-200 animate-pulse rounded"></div>
                  <div class="h-4 w-24 bg-base-200 animate-pulse rounded"></div>
               </div>
            </div>

            <div v-else class="space-y-8 flex-grow flex flex-col justify-center">
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
                  <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Used Space</span>
                  <span class="text-lg font-bold">{{ formatSize(stats?.used || 0) }}</span>
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Available</span>
                  <span class="text-lg font-bold">{{ formatSize(stats?.free || 0) }}</span>
                </div>
                <div class="flex flex-col gap-1 col-span-2 sm:col-span-1">
                  <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Total Scale</span>
                  <span class="text-lg font-bold text-base-content/60">{{ formatSize(stats?.total || 0) }}</span>
                </div>
              </div>
            </div>

            <div class="mt-10 pt-8 border-t border-base-content/5 flex items-center justify-between">
               <p class="text-[10px] font-bold text-base-content/30 uppercase tracking-widest">Health Status: Optimal</p>
               <div class="flex items-center gap-1.5">
                  <div class="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
                  <span class="text-[10px] font-black uppercase tracking-widest text-success">Active</span>
               </div>
            </div>
          </div>
        </div>

        <!-- Quick Terminal -->
        <div class="lg:col-span-5 flex flex-col gap-6">
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

          <div class="bg-primary/5 rounded-[2rem] p-8 border border-primary/10 flex flex-col justify-center">
             <div class="flex items-center gap-4 mb-4">
                <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                   <Icon name="mdi:shield-check" class="text-white w-5 h-5" />
                </div>
                <h4 class="font-black text-sm uppercase tracking-tight">Security Check</h4>
             </div>
             <p class="text-xs font-bold text-primary/60 leading-relaxed uppercase tracking-wider">Your data is encrypted with military-grade 256-bit AES protection. All nodes are reporting nominal status.</p>
          </div>
        </div>
      </div>
    </main>

    <footer class="w-full py-8 px-8 flex flex-col items-center gap-4 mt-auto">
       <div class="flex items-center gap-6 opacity-30">
          <span class="text-[9px] font-black uppercase tracking-[0.4em]">ClyoCloud Kernel</span>
          <div class="w-1 h-1 rounded-full bg-base-content"></div>
          <span class="text-[9px] font-black uppercase tracking-[0.4em]">Node v2.4.0-Stable</span>
       </div>
    </footer>
  </div>
</template>
