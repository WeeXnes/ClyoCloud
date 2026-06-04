<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'

interface ActivityEntry {
  id: string
  action: string
  path: string
  timestamp: number
  ip?: string
  userAgent?: string
  details?: string
  metadata?: Record<string, any>
}

const activities = ref<ActivityEntry[]>([])
const isLoading = ref(true)
const searchQuery = ref('')
const expandedId = ref<string | null>(null)
const router = useRouter()

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

const toggleExpand = (id: string) => {
  expandedId.value = expandedId.value === id ? null : id
}

const navigateToPath = (activity: ActivityEntry) => {
  let path = activity.path
  const action = activity.action

  // For MOVE and RENAME, the 'to' path is the current location
  if (activity.metadata && activity.metadata.to) {
    path = activity.metadata.to
  }

  // If it's a security/system log, don't navigate
  if (['Security', 'Login', 'Account'].includes(path)) return
  if (path === 'root') {
    router.push('/files')
    return
  }
  
  const segments = path.split('/')
  const lastSegment = segments[segments.length - 1]

  // For DELETE, the file is gone, so we just go to the parent directory
  if (action === 'DELETE') {
    segments.pop()
    const parentPath = segments.join('/')
    router.push(`/files/${parentPath}`)
    return
  }

  // Heuristic to detect if it's a file: has an extension in the last segment
  // EXCEPT for MKDIR which we know is a folder
  const isLikelyFile = lastSegment.includes('.') && action !== 'MKDIR'

  if (isLikelyFile) {
    segments.pop()
    const parentPath = segments.join('/')
    router.push(`/files/${parentPath}?select=${encodeURIComponent(lastSegment)}`)
  } else {
    router.push(`/files/${path}`)
  }
}

const getActionIcon = (action: string) => {
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
    case 'PUBLIC_VIEW': return 'mdi:eye-outline'
    case 'PUBLIC_STREAM': return 'mdi:play-circle-outline'
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

const getActionColor = (action: string) => {
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

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

const filteredActivities = computed(() => {
  if (!searchQuery.value.trim()) return activities.value
  const query = searchQuery.value.toLowerCase().trim()
  return activities.value.filter(a => 
    a.path.toLowerCase().includes(query) || 
    a.action.toLowerCase().includes(query) || 
    (a.details && a.details.toLowerCase().includes(query)) ||
    (a.ip && a.ip.includes(query))
  )
})

const groupedActivities = computed(() => {
  const groups: { [key: string]: ActivityEntry[] } = {}
  filteredActivities.value.forEach(activity => {
    const date = new Date(activity.timestamp).toDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(activity)
  })
  return Object.entries(groups).map(([date, items]) => ({
    date: items[0].timestamp,
    dateStr: formatDate(items[0].timestamp),
    items
  })).sort((a, b) => b.date - a.date)
})

onMounted(fetchLogs)
</script>

<template>
  <div class="min-h-screen bg-base-200/50">
    <header class="sticky top-0 z-[40] w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/10">
      <div class="w-full px-4 py-3 md:py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div class="flex flex-col gap-0.5 md:gap-1 min-w-0">
            <div class="flex items-center gap-2">
              <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-xs md:btn-sm lg:hidden">
                <Icon name="mdi:menu" class="w-5 h-5" />
              </label>
              <h1 class="text-base md:text-lg font-bold tracking-tight flex items-center gap-2 text-base-content">
                <Icon name="mdi:history" class="text-primary w-5 h-5" />
                Activity Logs
              </h1>
            </div>
            <p class="text-[9px] md:text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">Security and Operation Audit</p>
          </div>

          <div class="flex flex-wrap items-center gap-2 md:gap-3">
             <div class="relative flex-1 md:flex-none md:min-w-[240px]">
                <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Icon name="mdi:magnify" class="w-4 h-4 text-base-content/30" />
                </div>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Filter by path, action, or IP..."
                  class="input input-xs md:input-sm input-bordered w-full pl-9 bg-base-100/50 focus:bg-base-100 transition-all border-base-content/10 font-bold text-xs h-8 md:h-10"
                />
             </div>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-[1200px] mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div v-if="isLoading" class="space-y-8">
        <div v-for="j in 3" :key="j" class="space-y-4">
          <div class="h-4 w-32 bg-base-300 animate-pulse rounded"></div>
          <div class="bg-base-100 rounded-xl border border-base-content/10 shadow-sm overflow-hidden divide-y divide-base-content/5">
            <div v-for="i in 4" :key="i" class="h-16 w-full bg-base-200 animate-pulse"></div>
          </div>
        </div>
      </div>
      
      <div v-else-if="groupedActivities.length" class="space-y-8">
        <div v-for="group in groupedActivities" :key="group.dateStr" class="space-y-3">
          <h2 class="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/30 pl-1 flex items-center gap-2">
             <Icon name="mdi:calendar" class="w-3 h-3" />
             {{ group.dateStr }}
          </h2>
          
          <div class="bg-base-100 rounded-xl border border-base-content/10 shadow-sm overflow-hidden divide-y divide-base-content/5">
            <div v-for="activity in group.items" :key="activity.id" class="transition-colors group/row">
              <div 
                class="p-3 sm:p-4 flex items-center gap-4 hover:bg-base-200/50 cursor-pointer"
                @click="toggleExpand(activity.id)"
              >
                <div :class="`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${getActionColor(activity.action)}`">
                  <Icon :name="getActionIcon(activity.action)" class="w-5 h-5" />
                </div>
                
                <div class="flex-grow min-w-0">
                  <div class="flex items-center justify-between gap-2 mb-0.5">
                    <button 
                      @click.stop="navigateToPath(activity)"
                      class="text-xs font-bold truncate text-base-content leading-none hover:text-primary transition-colors text-left"
                      :class="{'cursor-default pointer-events-none': ['Security', 'Login', 'Account'].includes(activity.path)}"
                    >
                      {{ activity.path }}
                    </button>
                    <span class="text-[9px] font-bold text-base-content/30 whitespace-nowrap uppercase tracking-widest">{{ formatTime(activity.timestamp) }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-base-200 text-base-content/60 border border-base-content/5">{{ activity.action.replace(/_/g, ' ') }}</span>
                    <p v-if="activity.details" class="text-[10px] font-bold text-base-content/40 truncate uppercase tracking-wide">
                       {{ activity.details }}
                    </p>
                    <div class="ml-auto flex items-center gap-2">
                       <span v-if="activity.ip" class="text-[9px] font-bold text-base-content/20 hidden sm:block font-mono">{{ activity.ip }}</span>
                       <Icon 
                        name="mdi:chevron-down" 
                        class="w-4 h-4 text-base-content/20 transition-transform duration-300"
                        :class="{'rotate-180': expandedId === activity.id}"
                       />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Expanded Details -->
              <div v-if="expandedId === activity.id" class="bg-base-200/30 p-4 border-t border-base-content/5 animate-in slide-in-from-top-2 duration-200">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="space-y-3">
                    <div>
                      <span class="text-[8px] font-black uppercase tracking-widest text-base-content/30 block mb-1">Log ID</span>
                      <code class="text-[10px] text-base-content/60 bg-base-300/50 px-2 py-1 rounded select-all">{{ activity.id }}</code>
                    </div>
                    <div>
                      <span class="text-[8px] font-black uppercase tracking-widest text-base-content/30 block mb-1">User Agent</span>
                      <p class="text-[10px] text-base-content/60 leading-relaxed max-w-md">
                        {{ activity.userAgent || 'No User-Agent data available' }}
                      </p>
                    </div>
                  </div>
                  <div class="space-y-3">
                    <div v-if="activity.ip">
                      <span class="text-[8px] font-black uppercase tracking-widest text-base-content/30 block mb-1">Client IP</span>
                      <code class="text-[10px] text-base-content/60 bg-base-300/50 px-2 py-1 rounded select-all">{{ activity.ip }}</code>
                    </div>
                    <div v-if="activity.metadata && Object.keys(activity.metadata).length">
                      <span class="text-[8px] font-black uppercase tracking-widest text-base-content/30 block mb-1">Action Metadata</span>
                      <div class="bg-base-300/30 rounded-lg p-2 overflow-x-auto">
                        <pre class="text-[10px] text-base-content/60"><code>{{ JSON.stringify(activity.metadata, null, 2) }}</code></pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
    </main>
  </div>
</template>

<style scoped>
.animate-in {
  animation-duration: 0.2s;
  animation-fill-mode: both;
}
@keyframes slide-in-from-top-2 {
  from {
    opacity: 0;
    transform: translateY(-0.5rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
