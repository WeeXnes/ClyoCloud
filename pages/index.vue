<template>
  <div class="min-h-screen bg-base-100 flex flex-col font-sans">
    <header class="page-bar">
      <div class="page-wrap py-3 flex items-center gap-3">
        <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden" aria-label="Open navigation">
          <Icon name="mdi:menu" class="w-5 h-5" />
        </label>
        <h1 class="text-[15px] font-medium tracking-section text-fg leading-tight">Dashboard</h1>
      </div>
    </header>

    <main class="flex-1 w-full page-wrap py-12 sm:py-16 space-y-16">

      <!-- Greeting -->
      <section class="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div>
          <p class="flex items-center gap-2 text-[13px] text-fg-2 mb-3">
            <span class="dot text-success"></span>Storage online
          </p>
          <h2 class="page-title">Welcome back, {{ userState?.name || stats?.username || 'User' }}</h2>
        </div>
        <NuxtLink to="/files" class="btn btn-primary gap-2 self-start sm:self-auto">
          <Icon name="mdi:cloud-upload-outline" class="w-4 h-4" />
          Upload files
        </NuxtLink>
      </section>

      <!-- Hero stats -->
      <section class="grid grid-cols-2 lg:grid-cols-4 border-y border-line">
        <div
          v-for="(stat, i) in heroStats"
          :key="stat.label"
          class="py-6 pr-4 border-line"
          :class="heroCellClass[i]"
        >
          <p class="num text-3xl sm:text-4xl font-medium text-fg tracking-title leading-none">
            <span v-if="isLoading" class="text-fg-3">—</span>
            <template v-else>{{ stat.value }}</template>
          </p>
          <p class="micro mt-2">{{ stat.label }}</p>
        </div>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-12">
        <div class="lg:col-span-7 space-y-16 min-w-0">

          <!-- Drives -->
          <section>
            <h2 class="section-title mb-4">Drives</h2>
            <div class="hair-list">
              <div class="hidden sm:grid grid-cols-[1fr_88px_88px_88px] gap-4 px-4 py-2.5 bg-base-200 micro">
                <span>Mount</span>
                <span class="text-right">Used</span>
                <span class="text-right">Free</span>
                <span class="text-right">Total</span>
              </div>
              <template v-if="isLoading">
                <div v-for="i in 2" :key="i" class="h-[68px] animate-pulse"></div>
              </template>
              <div v-else-if="!stats?.drives?.length" class="px-4 py-6 text-[14px] text-fg-3">No drives reported.</div>
              <div v-else v-for="drive in stats.drives" :key="drive.mount" class="px-4 py-4">
                <div class="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_88px_88px_88px] gap-x-4 gap-y-1 items-baseline">
                  <div class="min-w-0">
                    <p class="text-[14px] font-medium text-fg truncate">{{ drive.mount }}</p>
                    <p class="text-[13px] text-fg-3 truncate">{{ drive.label }}</p>
                  </div>
                  <span class="num text-[14px] text-fg text-right">{{ formatSize(drive.used) }}</span>
                  <span class="num text-[14px] text-fg-2 text-right hidden sm:block">{{ formatSize(drive.available) }}</span>
                  <span class="num text-[14px] text-fg-2 text-right hidden sm:block">{{ formatSize(drive.total) }}</span>
                </div>
                <div class="mt-3 flex items-center gap-3">
                  <div class="flex-1 h-1 rounded-full bg-surface-2 overflow-hidden">
                    <div class="h-full rounded-full" :class="drive.use > 90 ? 'bg-error' : drive.use > 75 ? 'bg-warning' : 'bg-invert'" :style="{ width: `${drive.use}%` }"></div>
                  </div>
                  <span class="num text-[12px] w-10 text-right" :class="drive.use > 90 ? 'text-error' : drive.use > 75 ? 'text-warning' : 'text-fg-2'">{{ Math.round(drive.use) }}%</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Storage allocation -->
          <section>
            <div class="flex items-baseline justify-between mb-4">
              <h2 class="section-title">Largest folders</h2>
              <span v-if="storageMapData" class="num text-[13px] text-fg-3">{{ formatSize(storageMapData.size) }} total</span>
            </div>
            <div class="hair-list">
              <div v-if="isLoading" class="h-40 flex items-center justify-center">
                <span class="loading loading-spinner loading-sm"></span>
              </div>
              <div v-else-if="!treemapNodes.length" class="px-4 py-6 text-[14px] text-fg-3">Nothing stored yet.</div>
              <div v-else v-for="node in treemapNodes" :key="node.name" class="px-4 py-3 hover:bg-surface-2 transition-colors">
                <div class="flex items-baseline justify-between gap-4">
                  <span class="text-[14px] text-fg truncate">{{ node.name }}</span>
                  <span class="num text-[13px] text-fg-2 shrink-0">{{ formatSize(node.size) }}</span>
                </div>
                <div class="mt-2 flex items-center gap-3">
                  <div class="flex-1 h-1 rounded-full bg-surface-2 overflow-hidden">
                    <div class="h-full rounded-full bg-fg-3" :style="{ width: `${sharePercent(node.size)}%` }"></div>
                  </div>
                  <span class="num text-[12px] text-fg-3 w-12 text-right">{{ sharePercent(node.size).toFixed(1) }}%</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div class="lg:col-span-5 space-y-16 min-w-0">
          <!-- Quick links -->
          <section>
            <h2 class="section-title mb-4">Go to</h2>
            <div class="hair-list">
              <NuxtLink
                v-for="link in quickLinks"
                :key="link.to"
                :to="link.to"
                class="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors group"
              >
                <Icon :name="link.icon" class="w-4 h-4 text-fg-3 group-hover:text-fg transition-colors" />
                <span class="flex-1 min-w-0">
                  <span class="block text-[14px] text-fg">{{ link.label }}</span>
                  <span class="block text-[13px] text-fg-3">{{ link.hint }}</span>
                </span>
                <Icon name="mdi:arrow-right" class="w-4 h-4 text-fg-3 group-hover:text-fg transition-colors" />
              </NuxtLink>
            </div>
          </section>

          <!-- Recent activity -->
          <section>
            <div class="flex items-baseline justify-between mb-4">
              <h2 class="section-title">Recent activity</h2>
              <NuxtLink to="/logs" class="text-[13px] text-fg-2 hover:text-fg transition-colors">View logs</NuxtLink>
            </div>
            <div class="hair-list">
              <template v-if="isLoading">
                <div v-for="i in 5" :key="i" class="h-14 animate-pulse"></div>
              </template>
              <div v-else-if="!activities.length" class="px-4 py-6 text-[14px] text-fg-3">No activity yet.</div>
              <div v-else class="max-h-[520px] overflow-y-auto">
                <div v-for="(activity, index) in activities" :key="index" class="px-4 py-3 border-t border-line first:border-t-0">
                  <div class="flex items-baseline justify-between gap-4">
                    <p class="text-[14px] text-fg truncate" :title="activity.path">{{ activity.path }}</p>
                    <span class="num text-[12px] text-fg-3 whitespace-nowrap">{{ formatTime(activity.timestamp) }}</span>
                  </div>
                  <p class="flex items-center gap-2 mt-0.5 min-w-0">
                    <span class="dot" :class="getActionColor(activity.action)"></span>
                    <span class="micro shrink-0">{{ activity.action }}</span>
                    <span v-if="activity.details" class="text-[13px] text-fg-3 truncate">{{ activity.details }}</span>
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>

    <footer class="border-t border-line">
      <div class="page-wrap py-4 text-[13px] text-fg-3">
        ClyoCloud <span class="num">v{{ useRuntimeConfig().public.version }}</span>
      </div>
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

function sharePercent(size: number) {
  const total = storageMapData.value?.size || 0
  return total > 0 ? (size / total) * 100 : 0
}

const heroStats = computed(() => [
  { label: 'Used', value: formatSize(stats.value?.used || 0) },
  { label: 'Free', value: formatSize(stats.value?.free || 0) },
  { label: 'CPU load', value: `${cpuPercentage.value}%` },
  { label: 'Memory', value: `${ramPercentage.value}%` },
])

// Hairlines between hero stats: 2 columns on phones, 4 from lg
const heroCellClass = [
  '',
  'pl-4 sm:pl-6 border-l',
  'border-t lg:border-t-0 lg:border-l lg:pl-6',
  'pl-4 sm:pl-6 border-l border-t lg:border-t-0',
]

const quickLinks = [
  { to: '/files', label: 'My Files', hint: 'Browse and upload', icon: 'mdi:folder-outline' },
  { to: '/media', label: 'Media', hint: 'Videos and photos', icon: 'mdi:play-box-multiple-outline' },
  { to: '/shared', label: 'Shared', hint: 'Public links', icon: 'mdi:share-variant-outline' },
  { to: '/downloader', label: 'Downloader', hint: 'Save from the web', icon: 'mdi:cloud-download-outline' },
]
</script>
