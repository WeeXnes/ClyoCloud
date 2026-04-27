<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

interface ActivityEntry {
  action: string
  path: string
  timestamp: number
  details?: string
}

const activities = ref<ActivityEntry[]>([])
const isLoading = ref(true)
const searchQuery = ref('')

const fetchLogs = async () => {
  isLoading.value = true
  try {
    const data = await $fetch<ActivityEntry[]>('/api/activity-full')
    activities.value = data
  } catch (err) {
    console.error('Failed to fetch logs:', err)
  } finally {
    isLoading.value = false
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
    case 'LOGIN_SUCCESS': return 'mdi:shield-check'
    case 'LOGIN_FAIL': return 'mdi:shield-alert'
    case 'LOGIN_STEP1': return 'mdi:shield-outline'
    case '2FA_FAIL': return 'mdi:shield-lock'
    case 'PASSWORD_CHANGE': return 'mdi:key-variant'
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
    case 'LOGIN_SUCCESS': return 'text-success bg-success/10'
    case 'LOGIN_FAIL': return 'text-error bg-error/10'
    case 'LOGIN_STEP1': return 'text-primary bg-primary/10'
    case '2FA_FAIL': return 'text-error bg-error/10'
    case 'PASSWORD_CHANGE': return 'text-warning bg-warning/10'
    default: return 'text-base-content/40 bg-base-content/5'
  }
}

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}

const filteredActivities = computed(() => {
  if (!searchQuery.value.trim()) return activities.value
  const query = searchQuery.value.toLowerCase().trim()
  return activities.value.filter(a => 
    a.path.toLowerCase().includes(query) || 
    a.action.toLowerCase().includes(query) || 
    (a.details && a.details.toLowerCase().includes(query))
  )
})

onMounted(fetchLogs)
</script>

<template>
  <div class="min-h-screen bg-base-200/50">
    <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/5">
      <div class="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            <div>
              <h1 class="text-xl font-black tracking-tight flex items-center gap-2">
                <Icon name="mdi:history" class="text-primary w-6 h-6" />
                Activity Logs
              </h1>
              <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">Security and Operation Audit</p>
            </div>
          </div>

          <div class="relative w-full md:w-64">
            <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Icon name="mdi:magnify" class="w-4 h-4 text-base-content/30" />
            </div>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search logs..."
              class="input input-sm input-bordered w-full pl-9 bg-base-100/50 focus:bg-base-100 transition-all border-base-content/10 font-medium"
            />
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-[1200px] mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div class="bg-base-100 rounded-[2.5rem] border border-base-content/5 shadow-xl shadow-base-content/5 overflow-hidden">
        <div v-if="isLoading" class="p-8 space-y-4">
          <div v-for="i in 8" :key="i" class="h-16 w-full bg-base-200 animate-pulse rounded-2xl"></div>
        </div>
        
        <div v-else-if="filteredActivities.length" class="divide-y divide-base-content/5">
          <div v-for="(activity, index) in filteredActivities" :key="index" class="p-4 sm:p-6 flex items-center gap-4 hover:bg-base-200/30 transition-colors group">
            <div :class="`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${getActionColor(activity.action)}`">
              <Icon :name="getActionIcon(activity.action)" class="w-6 h-6" />
            </div>
            <div class="flex-grow min-w-0">
              <div class="flex items-center justify-between gap-2 mb-1">
                <h4 class="text-sm font-black truncate">{{ activity.path }}</h4>
                <span class="text-[10px] font-bold text-base-content/30 whitespace-nowrap">{{ formatTime(activity.timestamp) }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-base-200 text-base-content/60">{{ activity.action }}</span>
                <p v-if="activity.details" class="text-[11px] font-medium text-base-content/40 truncate">
                   {{ activity.details }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="p-24 text-center">
          <div class="bg-base-200/50 p-8 rounded-full inline-block mb-6">
            <Icon name="mdi:tray-blank-outline" class="w-16 h-16 text-base-content/10" />
          </div>
          <h3 class="text-xl font-black tracking-tight">No logs found</h3>
          <p class="text-xs font-bold text-base-content/30 uppercase tracking-widest mt-2">Try adjusting your search query</p>
        </div>
      </div>
    </main>
  </div>
</template>
