<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'

useHead({
  title: 'Logs'
})
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

// Colour only where the action means something: failures, warnings, sharing
const getActionColor = (action: string) => {
  switch (action) {
    case 'DELETE':
    case 'LOGIN_FAIL':
    case '2FA_FAIL': return 'text-error'
    case 'PASSWORD_CHANGE': return 'text-warning'
    case 'SHARE':
    case 'PUBLIC_ACCESS':
    case 'LOGIN_SUCCESS': return 'text-success'
    default: return 'text-fg-3'
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
  <div class="min-h-screen bg-base-100">
    <header class="page-bar">
      <div class="page-wrap py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden" aria-label="Open navigation">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            <div class="flex items-center gap-2">
              <div>
                <h1 class="text-[15px] font-medium tracking-section text-fg leading-tight">Activity Logs</h1>
                <p class="hidden sm:block text-[13px] text-fg-3 leading-tight">Security and Operation Audit</p>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 md:gap-3">
             <div class="relative flex-1 md:flex-none md:min-w-[240px]">
                <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Icon name="mdi:magnify" class="w-4 h-4 text-fg-3" />
                </div>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Filter by path, action, or IP..."
                  class="input input-xs md:input-sm input-bordered w-full !pl-9 transition font-medium text-xs "
                />
             </div>
          </div>
        </div>
      </div>
    </header>

    <main class="page-wrap py-10">
      <div v-if="isLoading" class="space-y-8">
        <div v-for="j in 3" :key="j" class="space-y-4">
          <div class="h-4 w-32 bg-base-200 animate-pulse rounded"></div>
          <div class="bg-base-100 rounded-xl border border-line overflow-hidden divide-y divide-line">
            <div v-for="i in 4" :key="i" class="h-16 w-full bg-base-200 animate-pulse"></div>
          </div>
        </div>
      </div>
      
      <div v-else-if="groupedActivities.length" class="space-y-12">
        <div v-for="group in groupedActivities" :key="group.dateStr" class="space-y-3">
          <h2 class="micro">
             {{ group.dateStr }}
          </h2>
          
          <div class="bg-base-100 rounded-xl border border-line overflow-hidden divide-y divide-line">
            <div v-for="activity in group.items" :key="activity.id" class="transition-colors group/row">
              <div 
                class="px-4 py-3 flex items-center gap-4 hover:bg-surface-2 transition-colors cursor-pointer"
                @click="toggleExpand(activity.id)"
              >
                <Icon :name="getActionIcon(activity.action)" class="w-4 h-4 shrink-0 text-fg-3" />
                
                <div class="flex-grow min-w-0">
                  <div class="flex items-center justify-between gap-2 mb-0.5">
                    <button 
                      @click.stop="navigateToPath(activity)"
                      class="text-[14px] truncate text-fg leading-snug hover:underline underline-offset-4 decoration-line-strong text-left"
                      :class="{'cursor-default pointer-events-none': ['Security', 'Login', 'Account'].includes(activity.path)}"
                    >
                      {{ activity.path }}
                    </button>
                    <span class="num text-[12px] text-fg-3 whitespace-nowrap">{{ formatTime(activity.timestamp) }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="dot" :class="getActionColor(activity.action)"></span>
                    <span class="micro shrink-0">{{ activity.action.replace(/_/g, ' ') }}</span>
                    <p v-if="activity.details" class="text-[13px] text-fg-3 truncate">
                       {{ activity.details }}
                    </p>
                    <div class="ml-auto flex items-center gap-2">
                       <span v-if="activity.ip" class="num text-[12px] text-fg-3 hidden sm:block">{{ activity.ip }}</span>
                       <Icon 
                        name="mdi:chevron-down" 
                        class="w-4 h-4 text-fg-3"
                        :class="{'rotate-180': expandedId === activity.id}"
                       />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Expanded Details -->
              <div v-if="expandedId === activity.id" class="bg-base-200 px-4 py-4 border-t border-line">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="space-y-3">
                    <div>
                      <span class="micro block mb-1">Log ID</span>
                      <code class="text-[11px] text-fg-2 num select-all">{{ activity.id }}</code>
                    </div>
                    <div>
                      <span class="micro block mb-1">User Agent</span>
                      <p class="text-[11px] text-fg-2 leading-relaxed max-w-md">
                        {{ activity.userAgent || 'No User-Agent data available' }}
                      </p>
                    </div>
                  </div>
                  <div class="space-y-3">
                    <div v-if="activity.ip">
                      <span class="micro block mb-1">Client IP</span>
                      <code class="text-[11px] text-fg-2 num select-all">{{ activity.ip }}</code>
                    </div>
                    <div v-if="activity.metadata && Object.keys(activity.metadata).length">
                      <span class="micro block mb-1">Action Metadata</span>
                      <div class="border border-line rounded-lg p-2 overflow-x-auto">
                        <pre class="text-[11px] text-fg-2"><code>{{ JSON.stringify(activity.metadata, null, 2) }}</code></pre>
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
        <p class="text-[15px] text-fg">No logs found</p>
        <p class="text-[14px] text-fg-3 mt-1">Try a different filter.</p>
      </div>
    </main>
  </div>
</template>
