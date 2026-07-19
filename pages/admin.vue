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
              <div class="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center border border-error/20">
                <Icon name="mdi:shield-crown" class="text-error w-5 h-5" />
              </div>
              <div>
                <h1 class="text-base font-extrabold tracking-tight">Admin Dashboard</h1>
                <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest leading-none mt-0.5">System Administration</p>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-error/15 text-error border border-error/10">
              <span class="w-1.5 h-1.5 mr-1.5 rounded-full bg-error animate-pulse"></span>
              Admin
            </span>
          </div>
        </div>
      </div>
    </header>

    <!-- Access Denied -->
    <div v-if="accessDenied" class="flex-1 flex items-center justify-center">
      <div class="text-center space-y-4">
        <Icon name="mdi:shield-lock" class="w-16 h-16 text-error/40 mx-auto" />
        <h2 class="text-xl font-bold">Access Denied</h2>
        <p class="text-sm text-base-content/50">You need administrator privileges to view this page.</p>
        <NuxtLink to="/" class="btn btn-primary btn-sm rounded-xl">Back to Dashboard</NuxtLink>
      </div>
    </div>

    <!-- Loading -->
    <div v-else-if="isLoading" class="flex-1 flex items-center justify-center">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <!-- Dashboard Content -->
    <main v-else class="flex-1 w-full max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">

      <!-- Overview Cards Row -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div class="stat-card">
          <Icon name="mdi:clock-outline" class="w-5 h-5 text-primary" />
          <div class="stat-value">{{ formatUptime(data?.server?.uptimeMs) }}</div>
          <div class="stat-label">Uptime</div>
        </div>
        <div class="stat-card">
          <Icon name="mdi:swap-vertical" class="w-5 h-5 text-info" />
          <div class="stat-value">{{ data?.traffic?.totalRequestsToday?.toLocaleString() || '0' }}</div>
          <div class="stat-label">Requests Today</div>
        </div>
        <div class="stat-card">
          <Icon name="mdi:swap-vertical-bold" class="w-5 h-5 text-secondary" />
          <div class="stat-value">{{ data?.traffic?.totalRequests?.toLocaleString() || '0' }}</div>
          <div class="stat-label">Total Requests</div>
        </div>
        <div class="stat-card">
          <Icon name="mdi:account-group" class="w-5 h-5 text-success" />
          <div class="stat-value">{{ data?.users?.length || 0 }}</div>
          <div class="stat-label">Users</div>
        </div>
        <div class="stat-card">
          <Icon name="mdi:cellphone-link" class="w-5 h-5 text-warning" />
          <div class="stat-value">{{ data?.totalDevices || 0 }}</div>
          <div class="stat-label">Devices</div>
        </div>
        <div class="stat-card">
          <Icon name="mdi:shield-alert" class="w-5 h-5 text-error" />
          <div class="stat-value">{{ totalBlockedIPs }}</div>
          <div class="stat-label">Blocked IPs</div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Traffic Chart (wide) -->
        <div class="lg:col-span-8 card-panel">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-sm font-bold">Traffic Overview</h2>
              <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Requests per minute (last 60 min)</p>
            </div>
            <div class="text-[10px] text-base-content/30 font-mono">
              Peak: {{ peakRequestsPerMin }}/min
            </div>
          </div>
          <div class="relative h-48">
            <canvas ref="trafficChartCanvas" class="w-full h-full"></canvas>
          </div>
        </div>

        <!-- Status Code Donut -->
        <div class="lg:col-span-4 card-panel">
          <div class="mb-4">
            <h2 class="text-sm font-bold">Status Codes</h2>
            <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Response distribution</p>
          </div>
          <div class="flex items-center justify-center h-48">
            <div class="relative">
              <canvas ref="donutChartCanvas" width="160" height="160"></canvas>
              <div class="absolute inset-0 flex items-center justify-center flex-col">
                <span class="text-lg font-bold">{{ data?.traffic?.totalRequests?.toLocaleString() || '0' }}</span>
                <span class="text-[9px] text-base-content/40 uppercase font-bold">Total</span>
              </div>
            </div>
            <div class="ml-6 space-y-2">
              <div v-for="(entry, i) in statusCodeEntries" :key="i" class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" :style="{ background: entry.color }"></span>
                <span class="text-[10px] font-bold text-base-content/60">{{ entry.label }}</span>
                <span class="text-[10px] font-mono text-base-content/40">{{ entry.count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rate Limits + Top Endpoints Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Rate Limits -->
        <div class="card-panel">
          <div class="mb-4">
            <h2 class="text-sm font-bold">Rate Limiters</h2>
            <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Active protection status</p>
          </div>
          <div class="space-y-4">
            <div v-for="limiter in data?.rateLimits?.limiters" :key="limiter.name" class="p-3 rounded-xl bg-base-200/50 border border-base-content/5">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider"
                        :class="limiter.blockedIPs.length > 0 ? 'bg-error/15 text-error' : 'bg-success/15 text-success'">
                    {{ limiter.name }}
                  </span>
                  <span class="text-[10px] text-base-content/40">{{ limiter.config.maxAttempts }} req / {{ Math.round(limiter.config.windowMs / 1000) }}s</span>
                </div>
                <span class="text-[10px] font-mono text-base-content/40">
                  {{ limiter.trackedIPs }} tracked
                </span>
              </div>
              <!-- Blocked IPs -->
              <div v-if="limiter.blockedIPs.length > 0" class="mt-2 space-y-1">
                <div v-for="blocked in limiter.blockedIPs" :key="blocked.ip" class="flex items-center justify-between px-2 py-1 rounded-lg bg-error/5 border border-error/10 text-[10px]">
                  <span class="font-mono text-error">{{ blocked.ip }}</span>
                  <span class="text-error/60">{{ Math.ceil(blocked.remainingMs / 1000) }}s remaining</span>
                </div>
              </div>
              <div v-else class="text-[10px] text-success/60 mt-1">No blocked IPs</div>
            </div>
          </div>
        </div>

        <!-- Top Endpoints -->
        <div class="card-panel">
          <div class="mb-4">
            <h2 class="text-sm font-bold">Top Endpoints</h2>
            <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Most requested paths</p>
          </div>
          <div class="space-y-2">
            <div v-for="(ep, i) in (data?.traffic?.topEndpoints || []).slice(0, 10)" :key="i" class="flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[11px] font-mono font-bold truncate text-base-content/70">{{ ep.path }}</span>
                  <span class="text-[10px] font-mono text-base-content/40 ml-2 shrink-0">{{ ep.count }}</span>
                </div>
                <div class="w-full h-1 bg-base-300 rounded-full overflow-hidden">
                  <div class="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500"
                       :style="{ width: endpointBarWidth(ep.count) + '%' }"></div>
                </div>
              </div>
            </div>
            <div v-if="!data?.traffic?.topEndpoints?.length" class="text-[10px] text-base-content/30 py-4 text-center">No data yet</div>
          </div>
        </div>
      </div>

      <!-- Users + Devices + Security Events -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Users -->
        <div class="lg:col-span-4 card-panel">
          <div class="mb-4">
            <h2 class="text-sm font-bold">Users</h2>
            <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Registered accounts</p>
          </div>
          <div class="space-y-2">
            <div v-for="user in data?.users" :key="user.name" class="flex items-center gap-3 p-2 rounded-lg bg-base-200/50 border border-base-content/5">
              <div class="avatar placeholder">
                <div class="rounded-md w-8" :class="user.isAdmin ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'">
                  <span class="text-xs font-bold">{{ user.name.charAt(0).toUpperCase() }}</span>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-bold truncate">{{ user.name }}</span>
                  <span v-if="user.isAdmin" class="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-error/15 text-error">Admin</span>
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span v-if="user.twoFactorEnabled" class="text-[9px] text-success font-bold">2FA</span>
                  <span class="text-[9px] text-base-content/30">{{ getUserDeviceCount(user.name) }} devices</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Connected Devices -->
        <div class="lg:col-span-4 card-panel">
          <div class="mb-4">
            <h2 class="text-sm font-bold">Connected Devices</h2>
            <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">All registered mobile clients</p>
          </div>
          <div class="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
            <template v-for="group in data?.devices" :key="group.username">
              <div v-for="device in group.devices" :key="device.id" class="flex items-center gap-3 p-2 rounded-lg bg-base-200/50 border border-base-content/5">
                <div class="w-8 h-8 rounded-md bg-warning/10 flex items-center justify-center shrink-0">
                  <Icon name="mdi:cellphone" class="w-4 h-4 text-warning" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[11px] font-bold truncate">{{ device.model }}</p>
                  <p class="text-[9px] text-base-content/30">{{ group.username }} · {{ formatTime(device.lastActive) }}</p>
                </div>
              </div>
            </template>
            <div v-if="!data?.totalDevices" class="text-[10px] text-base-content/30 py-4 text-center">No devices registered</div>
          </div>
        </div>

        <!-- Security Events -->
        <div class="lg:col-span-4 card-panel">
          <div class="mb-4">
            <h2 class="text-sm font-bold">Security Events</h2>
            <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Recent auth activity</p>
          </div>
          <div class="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar">
            <div v-for="(event, i) in securityEvents" :key="i" class="flex items-center gap-2 p-2 rounded-lg bg-base-200/50 border border-base-content/5">
              <div class="w-6 h-6 rounded-md flex items-center justify-center shrink-0" :class="getEventColor(event.action)">
                <Icon :name="getEventIcon(event.action)" class="w-3.5 h-3.5" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-bold truncate">{{ event.username }}: {{ event.action }}</p>
                <p class="text-[9px] text-base-content/30 truncate">{{ event.details || event.path }} · {{ formatTime(event.timestamp) }}</p>
              </div>
            </div>
            <div v-if="!securityEvents.length" class="text-[10px] text-base-content/30 py-4 text-center">No events yet</div>
          </div>
        </div>
      </div>

      <!-- Server Info -->
      <div class="card-panel">
        <div class="mb-4">
          <h2 class="text-sm font-bold">Server Information</h2>
          <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Runtime diagnostics</p>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p class="text-[9px] text-base-content/30 uppercase font-bold tracking-wider mb-1">Node.js</p>
            <p class="text-xs font-mono font-bold">{{ data?.server?.nodeVersion || '-' }}</p>
          </div>
          <div>
            <p class="text-[9px] text-base-content/30 uppercase font-bold tracking-wider mb-1">Platform</p>
            <p class="text-xs font-mono font-bold">{{ data?.server?.platform || '-' }} / {{ data?.server?.arch || '-' }}</p>
          </div>
          <div>
            <p class="text-[9px] text-base-content/30 uppercase font-bold tracking-wider mb-1">Heap Used</p>
            <p class="text-xs font-mono font-bold">{{ formatSize(data?.server?.processMemory?.heapUsed) }}</p>
          </div>
          <div>
            <p class="text-[9px] text-base-content/30 uppercase font-bold tracking-wider mb-1">RSS</p>
            <p class="text-xs font-mono font-bold">{{ formatSize(data?.server?.processMemory?.rss) }}</p>
          </div>
          <div>
            <p class="text-[9px] text-base-content/30 uppercase font-bold tracking-wider mb-1">CPU Load</p>
            <p class="text-xs font-mono font-bold">{{ data?.server?.system?.cpuLoad?.toFixed(1) || '0' }}%</p>
          </div>
          <div>
            <p class="text-[9px] text-base-content/30 uppercase font-bold tracking-wider mb-1">CPU Cores</p>
            <p class="text-xs font-mono font-bold">{{ data?.server?.system?.cpuCores || '-' }}</p>
          </div>
          <div>
            <p class="text-[9px] text-base-content/30 uppercase font-bold tracking-wider mb-1">System RAM</p>
            <p class="text-xs font-mono font-bold">{{ formatSize(data?.server?.system?.ramUsed) }} / {{ formatSize(data?.server?.system?.ramTotal) }}</p>
          </div>
          <div>
            <p class="text-[9px] text-base-content/30 uppercase font-bold tracking-wider mb-1">RAM Free</p>
            <p class="text-xs font-mono font-bold">{{ formatSize(data?.server?.system?.ramFree) }}</p>
          </div>
        </div>
      </div>

      <!-- Top IPs -->
      <div class="card-panel">
        <div class="mb-4">
          <h2 class="text-sm font-bold">Top Client IPs</h2>
          <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Most active connections</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div v-for="(ip, i) in (data?.traffic?.topIPs || []).slice(0, 8)" :key="i" class="flex items-center justify-between p-2 rounded-lg bg-base-200/50 border border-base-content/5">
            <span class="text-[11px] font-mono font-bold text-base-content/60 truncate">{{ ip.ip }}</span>
            <span class="text-[10px] font-mono text-base-content/40 ml-2 shrink-0 tabular-nums">{{ ip.count }} req</span>
          </div>
        </div>
        <div v-if="!data?.traffic?.topIPs?.length" class="text-[10px] text-base-content/30 py-4 text-center">No data yet</div>
      </div>

    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

useHead({ title: 'Admin' })

const userState = useState<{ name: string; isAdmin?: boolean } | null>('user')
const data = ref<any>(null)
const securityEvents = ref<any[]>([])
const isLoading = ref(true)
const accessDenied = ref(false)

const trafficChartCanvas = ref<HTMLCanvasElement | null>(null)
const donutChartCanvas = ref<HTMLCanvasElement | null>(null)

let pollingInterval: any = null

const totalBlockedIPs = computed(() => {
  if (!data.value?.rateLimits?.limiters) return 0
  return data.value.rateLimits.limiters.reduce((sum: number, l: any) => sum + l.blockedIPs.length, 0)
})

const peakRequestsPerMin = computed(() => {
  if (!data.value?.traffic?.timeSeries) return 0
  return Math.max(...data.value.traffic.timeSeries.map((b: any) => b.count), 0)
})

const statusCodeEntries = computed(() => {
  const dist = data.value?.traffic?.statusCodeDistribution || {}
  const categories: { label: string; color: string; count: number }[] = []
  let count2xx = 0, count3xx = 0, count4xx = 0, count5xx = 0, countOther = 0
  for (const [code, count] of Object.entries(dist)) {
    const c = parseInt(code)
    if (c >= 200 && c < 300) count2xx += count as number
    else if (c >= 300 && c < 400) count3xx += count as number
    else if (c >= 400 && c < 500) count4xx += count as number
    else if (c >= 500) count5xx += count as number
    else countOther += count as number
  }
  if (count2xx) categories.push({ label: '2xx Success', color: '#22c55e', count: count2xx })
  if (count3xx) categories.push({ label: '3xx Redirect', color: '#3b82f6', count: count3xx })
  if (count4xx) categories.push({ label: '4xx Client', color: '#f59e0b', count: count4xx })
  if (count5xx) categories.push({ label: '5xx Server', color: '#ef4444', count: count5xx })
  if (countOther) categories.push({ label: 'Other', color: '#6b7280', count: countOther })
  return categories
})

function endpointBarWidth(count: number): number {
  const max = data.value?.traffic?.topEndpoints?.[0]?.count || 1
  return Math.max(4, (count / max) * 100)
}

function getUserDeviceCount(username: string): number {
  if (!data.value?.devices) return 0
  const group = data.value.devices.find((d: any) => d.username === username)
  return group?.devices?.length || 0
}

async function fetchData() {
  try {
    const [statsRes, activityRes] = await Promise.all([
      fetch('/api/admin/stats', { credentials: 'include' }),
      fetch('/api/admin/activity', { credentials: 'include' })
    ])
    if (statsRes.status === 403) {
      accessDenied.value = true
      return
    }
    if (statsRes.ok) {
      data.value = await statsRes.json()
      await nextTick()
      drawTrafficChart()
      drawDonutChart()
    }
    if (activityRes.ok) securityEvents.value = await activityRes.json()
  } catch (err) {
    console.error('Admin fetch error:', err)
  } finally {
    isLoading.value = false
  }
}

function drawTrafficChart() {
  const canvas = trafficChartCanvas.value
  if (!canvas || !data.value?.traffic?.timeSeries) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, rect.width, rect.height)

  const series = data.value.traffic.timeSeries as { timestamp: number; count: number }[]
  if (series.length < 2) return

  const maxVal = Math.max(...series.map(s => s.count), 1)
  const padding = { top: 10, right: 10, bottom: 20, left: 35 }
  const w = rect.width - padding.left - padding.right
  const h = rect.height - padding.top - padding.bottom

  // Grid lines
  ctx.strokeStyle = 'rgba(128,128,128,0.08)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (h / 4) * i
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(rect.width - padding.right, y)
    ctx.stroke()

    // Y-axis labels
    const val = Math.round(maxVal - (maxVal / 4) * i)
    ctx.fillStyle = 'rgba(128,128,128,0.4)'
    ctx.font = '9px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(String(val), padding.left - 5, y + 3)
  }

  // Draw filled area + line
  const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + h)
  gradient.addColorStop(0, 'rgba(99,102,241,0.25)')
  gradient.addColorStop(1, 'rgba(99,102,241,0)')

  ctx.beginPath()
  ctx.moveTo(padding.left, padding.top + h)
  for (let i = 0; i < series.length; i++) {
    const x = padding.left + (w / (series.length - 1)) * i
    const y = padding.top + h - (series[i].count / maxVal) * h
    ctx.lineTo(x, y)
  }
  ctx.lineTo(padding.left + w, padding.top + h)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()

  // Line
  ctx.beginPath()
  for (let i = 0; i < series.length; i++) {
    const x = padding.left + (w / (series.length - 1)) * i
    const y = padding.top + h - (series[i].count / maxVal) * h
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = 'rgba(99,102,241,0.8)'
  ctx.lineWidth = 2
  ctx.lineJoin = 'round'
  ctx.stroke()

  // Time labels
  ctx.fillStyle = 'rgba(128,128,128,0.3)'
  ctx.font = '9px monospace'
  ctx.textAlign = 'center'
  const labelInterval = Math.max(1, Math.floor(series.length / 6))
  for (let i = 0; i < series.length; i += labelInterval) {
    const x = padding.left + (w / (series.length - 1)) * i
    const time = new Date(series[i].timestamp)
    ctx.fillText(`${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`, x, rect.height - 4)
  }
}

function drawDonutChart() {
  const canvas = donutChartCanvas.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  canvas.width = 160 * dpr
  canvas.height = 160 * dpr
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, 160, 160)

  const entries = statusCodeEntries.value
  if (entries.length === 0) {
    // Empty state
    ctx.beginPath()
    ctx.arc(80, 80, 60, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(128,128,128,0.1)'
    ctx.lineWidth = 16
    ctx.stroke()
    return
  }

  const total = entries.reduce((s, e) => s + e.count, 0)
  let startAngle = -Math.PI / 2

  for (const entry of entries) {
    const sliceAngle = (entry.count / total) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(80, 80, 60, startAngle, startAngle + sliceAngle)
    ctx.strokeStyle = entry.color
    ctx.lineWidth = 16
    ctx.lineCap = 'butt'
    ctx.stroke()
    startAngle += sliceAngle
  }
}

function formatUptime(ms: number | undefined): string {
  if (!ms) return '-'
  const seconds = Math.floor(ms / 1000)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function formatSize(bytes: number | undefined): string {
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

function getEventColor(action: string): string {
  switch (action) {
    case 'LOGIN_SUCCESS': return 'bg-success/15 text-success'
    case 'LOGIN_FAIL': case '2FA_FAIL': return 'bg-error/15 text-error'
    case 'LOGIN_STEP1': return 'bg-primary/15 text-primary'
    case 'PASSWORD_CHANGE': return 'bg-warning/15 text-warning'
    case 'QR_GENERATE': return 'bg-info/15 text-info'
    case 'DEVICE_REGISTER': return 'bg-success/15 text-success'
    case 'DEVICE_REVOKE': return 'bg-error/15 text-error'
    default: return 'bg-base-content/5 text-base-content/40'
  }
}

function getEventIcon(action: string): string {
  switch (action) {
    case 'LOGIN_SUCCESS': return 'mdi:shield-check'
    case 'LOGIN_FAIL': return 'mdi:shield-alert'
    case 'LOGIN_STEP1': return 'mdi:shield-outline'
    case '2FA_FAIL': return 'mdi:shield-lock'
    case 'PASSWORD_CHANGE': return 'mdi:key-variant'
    case 'QR_GENERATE': return 'mdi:qrcode'
    case 'DEVICE_REGISTER': return 'mdi:cellphone-check'
    case 'DEVICE_REVOKE': return 'mdi:cellphone-remove'
    default: return 'mdi:history'
  }
}

onMounted(() => {
  fetchData()
  pollingInterval = setInterval(fetchData, 10000) // Refresh every 10s
})

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval)
})
</script>

<style scoped>
.stat-card {
  @apply flex flex-col items-center justify-center gap-1 p-4 rounded-xl bg-base-100 border border-base-content/5 shadow-sm;
}
.stat-value {
  @apply text-lg font-extrabold tabular-nums;
}
.stat-label {
  @apply text-[9px] font-bold uppercase tracking-widest text-base-content/30;
}
.card-panel {
  @apply p-5 rounded-2xl bg-base-100 border border-base-content/5 shadow-sm;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}
</style>
