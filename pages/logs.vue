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
    <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/10">
      <div class="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            <div>
              <h1 class="text-lg font-bold tracking-tight flex items-center gap-2 text-base-content">
                <Icon name="mdi:history" class="text-primary w-5 h-5" />
                Activity Logs
              </h1>
              <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest pl-1">Security and Operation Audit</p>
            </div>
          </div>

          <div class="relative w-full md:w-64">
            <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Icon name="mdi:magnify" class="w-4 h-4 text-base-content/30" />
            </div>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Filter logs..."
              class="input input-sm input-bordered w-full pl-9 bg-base-100/50 focus:bg-base-100 transition-all border-base-content/10 font-bold text-xs rounded-lg"
            />
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-[1200px] mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div class="bg-base-100 rounded-xl border border-base-content/10 shadow-sm overflow-hidden">
        <div v-if="isLoading" class="p-6 space-y-3">
          <div v-for="i in 8" :key="i" class="h-12 w-full bg-base-200 animate-pulse rounded-lg"></div>
        </div>
        
        <div v-else-if="filteredActivities.length" class="divide-y divide-base-content/5">
          <div v-for="(activity, index) in filteredActivities" :key="index" class="p-3 sm:p-4 flex items-center gap-4 hover:bg-base-200/50 transition-colors group">
            <div :class="`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-current/10 ${getActionColor(activity.action)}`">
              <Icon :name="getActionIcon(activity.action)" class="w-5 h-5" />
            </div>
            <div class="flex-grow min-w-0">
              <div class="flex items-center justify-between gap-2 mb-0.5">
                <h4 class="text-xs font-bold truncate text-base-content leading-none">{{ activity.path }}</h4>
                <span class="text-[9px] font-bold text-base-content/30 whitespace-nowrap uppercase tracking-widest">{{ formatTime(activity.timestamp).split(',')[1] }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-base-200 text-base-content/60 border border-base-content/5">{{ activity.action }}</span>
                <p v-if="activity.details" class="text-[10px] font-bold text-base-content/40 truncate uppercase tracking-wide">
                   {{ activity.details }}
                </p>
                <span class="text-[9px] font-bold text-base-content/20 ml-auto hidden sm:block">{{ formatTime(activity.timestamp).split(',')[0] }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="py-24 text-center">
          <div class="bg-base-200/50 p-6 rounded-xl inline-block mb-4 border border-base-content/5">
            <Icon name="mdi:tray-blank-outline" class="w-12 h-12 text-base-content/10" />
          </div>
          <h3 class="text-base font-bold tracking-tight text-base-content">No logs found</h3>
          <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest mt-1">Try adjusting filter parameters</p>
        </div>
      </div>
    </main>
  </div>
</template>
