<template>
  <div class="min-h-screen bg-base-100 flex flex-col font-sans text-fg">
    <header class="page-bar">
      <div class="page-wrap py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden" aria-label="Open navigation">
              <Icon name="mdi:menu" class="w-5 h-5" />
            </label>
            <div class="flex items-center gap-2">
              <button v-if="selectedIp" @click="selectedIp = null" class="btn btn-ghost btn-circle btn-xs mr-1">
                <Icon name="mdi:arrow-left" class="w-4 h-4" />
              </button>
              <div>
                <h1 class="text-[15px] font-medium tracking-section text-fg leading-tight">
                  {{ selectedIp ? `IP Inspector: ${selectedIp}` : 'Admin Dashboard' }}
                </h1>
                <p class="hidden sm:block text-[13px] text-fg-3 leading-tight">
                  {{ selectedIp ? 'Client Traffic Analysis' : 'System Administration' }}
                </p>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="badge">Admin</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Access Denied -->
    <div v-if="accessDenied" class="flex-1 flex items-center justify-center">
      <div class="text-center space-y-4">
                <h2 class="text-xl font-medium">Access Denied</h2>
        <p class="text-sm text-fg-3">You need administrator privileges to view this page.</p>
        <NuxtLink to="/" class="btn btn-primary btn-sm">Back to Dashboard</NuxtLink>
      </div>
    </div>

    <!-- Loading -->
    <div v-else-if="isLoading" class="flex-1 flex items-center justify-center">
      <span class="loading loading-spinner loading-lg text-fg"></span>
    </div>

    <!-- IP Traffic Inspector Sub-Page -->
    <main v-else-if="selectedIp" class="flex-1 w-full page-wrap py-12 space-y-16">
      
      <!-- Back button and IP Info Card -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-12">
        <!-- Geolocation & Limit Info -->
        <div class="lg:col-span-4 card-panel flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <h2 class="section-title">Client identity</h2>
              <span v-if="isIpBlocked(selectedIp)" class="flex items-center gap-1.5 text-[13px] text-fg-2"><span class="dot text-error"></span>Blocked</span>
              <span v-else class="flex items-center gap-1.5 text-[13px] text-fg-2"><span class="dot text-success"></span>Active</span>
            </div>
            <div class="space-y-4">
              <div>
                <p class="text-[13px] text-fg-3">IP Address</p>
                <p class="text-lg font-mono font-semibold text-fg">{{ selectedIp }}</p>
              </div>
              <div>
                <p class="text-[13px] text-fg-3">Location</p>
                <p class="text-sm font-medium">{{ selectedIpGeo?.city || 'Local' }}, {{ selectedIpGeo?.country || 'Intranet' }}</p>
                <p class="text-[11px] text-fg-3 font-mono mt-0.5">Coords: {{ selectedIpGeo?.lat?.toFixed(4) || '0' }}, {{ selectedIpGeo?.lon?.toFixed(4) || '0' }}</p>
              </div>
              <div>
                <p class="text-[13px] text-fg-3">Total Requests</p>
                <p class="text-sm font-medium">{{ getIpRequestCount(selectedIp) }} requests ({{ getIpTrafficShare(selectedIp) }}% of total)</p>
              </div>
            </div>
          </div>

          <div class="pt-6 border-t border-line mt-6 flex gap-2">
            <button @click="selectedIp = null" class="btn btn-sm flex-1">
              <Icon name="mdi:arrow-left" class="w-4 h-4 mr-1" /> Close Inspector
            </button>
          </div>
        </div>

        <!-- IP Map Location -->
        <div class="lg:col-span-8 card-panel relative overflow-hidden flex flex-col justify-center min-h-[250px]">
          <div class="relative z-10 w-full h-[220px]">
            <canvas ref="selectedWorldMapCanvas" class="w-full h-full rounded-xl"></canvas>
          </div>
        </div>
      </div>

      <!-- Log Table for Selected IP -->
      <div class="card-panel">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="section-title">Recent Request Logs</h2>
            <p class="text-[13px] text-fg-3">Real-time HTTP requests from this address</p>
          </div>
          <span class="text-[11px] font-mono text-fg-3">Showing last {{ filteredRequests.length }} entries</span>
        </div>

        <div class="overflow-x-auto custom-scrollbar">
          <table class="table table-xs w-full text-left font-mono">
            <thead>
              <tr class="border-b border-line text-fg-3 uppercase tracking-micro font-mono text-[11px] ">
                <th class="py-2.5">Time</th>
                <th class="py-2.5">Method</th>
                <th class="py-2.5">Path</th>
                <th class="py-2.5">Status</th>
                <th class="py-2.5">User Agent</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(req, i) in filteredRequests" :key="i" class="border-b border-line hover:bg-base-200">
                <td class="py-2 text-[11px] text-fg-3">{{ formatTime(req.timestamp) }}</td>
                <td class="py-2">
                  <span class="text-[11px] uppercase tracking-micro font-mono text-fg-2">
                    {{ req.method }}
                  </span>
                </td>
                <td class="py-2 text-[11px] font-medium text-fg max-w-xs truncate flex items-center gap-1.5" :title="req.path">
                  <Icon v-if="req.isAuth" name="mdi:lock" class="w-3.5 h-3.5 text-fg-3 shrink-0" title="Authenticated request (Auth middleware verified)" />
                  <span class="truncate">{{ req.path }}</span>
                </td>
                <td class="py-2">
                  <span class="num text-[12px]"
                        :class="req.statusCode < 300 ? 'text-success' : req.statusCode < 400 ? 'text-fg-2' : 'text-error'">
                    {{ req.statusCode }}
                  </span>
                </td>
                <td class="py-2 text-[11px] text-fg-3 max-w-sm truncate" :title="req.userAgent">{{ req.userAgent || '-' }}</td>
              </tr>
              <tr v-if="!filteredRequests.length">
                <td colspan="5" class="py-8 text-center text-xs text-fg-3 font-medium">No recent requests recorded for this IP</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <!-- Main Dashboard Page -->
    <main v-else class="flex-1 w-full page-wrap py-12 space-y-16">

      <!-- World Map Card -->
      <div class="card-panel">
        <div class="mb-4">
          <h2 class="section-title">Connection Map</h2>
          <p class="text-[13px] text-fg-3">Geographic mapping of incoming client connections (click markers to inspect)</p>
        </div>
        <div class="relative w-full h-[300px] rounded-xl overflow-hidden bg-base-200 border border-line">
          <canvas ref="worldMapCanvas" @click="handleMapClick" class="w-full h-full cursor-pointer"></canvas>
        </div>
      </div>

      <!-- Overview Cards Row -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-line border-y border-line">
        <div class="stat-card">
          <div class="stat-value">{{ formatUptime(data?.server?.uptimeMs) }}</div>
          <div class="stat-label">Uptime</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ data?.traffic?.totalRequestsToday?.toLocaleString() || '0' }}</div>
          <div class="stat-label">Requests Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ data?.traffic?.totalRequests?.toLocaleString() || '0' }}</div>
          <div class="stat-label">Total Requests</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ data?.users?.length || 0 }}</div>
          <div class="stat-label">Users</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ data?.totalDevices || 0 }}</div>
          <div class="stat-label">Devices</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ totalBlockedIPs }}</div>
          <div class="stat-label">Blocked IPs</div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-12">
        <!-- Traffic Chart (wide) -->
        <div class="lg:col-span-8 card-panel">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="section-title">Traffic Overview</h2>
              <p class="text-[13px] text-fg-3">Requests per minute (last 60 min)</p>
            </div>
            <div class="text-[11px] text-fg-3 font-mono">
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
            <h2 class="section-title">Status Codes</h2>
            <p class="text-[13px] text-fg-3">Response distribution</p>
          </div>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 min-h-[12rem] py-4 sm:py-0">
            <div class="relative w-40 h-40 shrink-0">
              <canvas ref="donutChartCanvas" width="160" height="160" class="w-40 h-40"></canvas>
              <div class="absolute inset-0 flex items-center justify-center flex-col">
                <span class="num text-lg text-fg">{{ data?.traffic?.totalRequests?.toLocaleString() || '0' }}</span>
                <span class="micro">Total</span>
              </div>
            </div>
            <div class="space-y-1.5 sm:space-y-2 flex flex-row sm:flex-col flex-wrap justify-center gap-x-4 gap-y-1 sm:gap-0">
              <div v-for="(entry, i) in statusCodeEntries" :key="i" class="flex items-center gap-2">
                <span class="dot" :style="{ background: entry.color }"></span>
                <span class="text-[11px] font-medium text-fg-2">{{ entry.label }}</span>
                <span class="text-[11px] font-mono text-fg-3">{{ entry.count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rate Limits + Top Endpoints Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-12">
        <!-- Rate Limits -->
        <div class="card-panel">
          <div class="mb-4">
            <h2 class="section-title">Rate Limiters</h2>
            <p class="text-[13px] text-fg-3">Active protection status</p>
          </div>
          <div class="hair-list">
            <div v-for="limiter in data?.rateLimits?.limiters" :key="limiter.name" class="px-4 py-3">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <span class="dot" :class="limiter.blockedIPs.length > 0 ? 'text-error' : 'text-success'"></span>
                  <span class="text-[14px] text-fg">{{ limiter.name }}</span>
                  <span class="text-[11px] text-fg-3">{{ limiter.config.maxAttempts }} req / {{ Math.round(limiter.config.windowMs / 1000) }}s</span>
                </div>
                <span class="text-[11px] font-mono text-fg-3">
                  {{ limiter.trackedIPs }} tracked
                </span>
              </div>
              <!-- Blocked IPs -->
              <div v-if="limiter.blockedIPs.length > 0" class="mt-2 space-y-1">
                <div v-for="blocked in limiter.blockedIPs" :key="blocked.ip" class="flex items-center justify-between text-[12px]">
                  <span class="font-mono text-error hover:underline cursor-pointer font-medium" @click="selectedIp = blocked.ip">{{ blocked.ip }}</span>
                  <span class="num text-fg-3">{{ Math.ceil(blocked.remainingMs / 1000) }}s remaining</span>
                </div>
              </div>
              <div v-else class="text-[12px] text-fg-3 mt-1">No blocked IPs</div>
            </div>
          </div>
        </div>

        <!-- Top Endpoints -->
        <div class="card-panel">
          <div class="mb-4">
            <h2 class="section-title">Top Endpoints</h2>
            <p class="text-[13px] text-fg-3">Most requested paths</p>
          </div>
          <div class="space-y-2">
            <div v-for="(ep, i) in (data?.traffic?.topEndpoints || []).slice(0, 10)" :key="i" class="flex items-center gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[11px] font-mono font-medium truncate text-fg-2">{{ ep.path }}</span>
                  <span class="text-[11px] font-mono text-fg-3 ml-2 shrink-0">{{ ep.count }}</span>
                </div>
                <div class="w-full h-1 bg-surface-2 rounded-full overflow-hidden">
                  <div class="h-full rounded-full bg-fg-3"
                       :style="{ width: endpointBarWidth(ep.count) + '%' }"></div>
                </div>
              </div>
            </div>
            <div v-if="!data?.traffic?.topEndpoints?.length" class="text-[14px] text-fg-3 py-4">No data yet</div>
          </div>
        </div>
      </div>

      <!-- Users + Devices + Security Events -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-12">
        <!-- Users -->
        <div class="lg:col-span-4 card-panel">
          <div class="mb-4">
            <h2 class="section-title">Users</h2>
            <p class="text-[13px] text-fg-3">Registered accounts</p>
          </div>
          <div class="hair-list">
            <div v-for="user in data?.users" :key="user.name" class="flex items-center gap-3 px-4 py-3">
              <div class="w-8 h-8 rounded-full border border-line-strong flex items-center justify-center text-[13px] font-medium text-fg shrink-0">
                {{ user.name.charAt(0).toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="text-[14px] text-fg truncate">{{ user.name }}</span>
                  <span v-if="user.isAdmin" class="badge">Admin</span>
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span v-if="user.twoFactorEnabled" class="flex items-center gap-1 text-[12px] text-fg-2"><span class="dot text-success"></span>2FA</span>
                  <span class="num text-[12px] text-fg-3">{{ getUserDeviceCount(user.name) }} devices</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Connected Devices -->
        <div class="lg:col-span-4 card-panel">
          <div class="mb-4">
            <h2 class="section-title">Connected Devices</h2>
            <p class="text-[13px] text-fg-3">All registered mobile clients</p>
          </div>
          <div class="hair-list max-h-[400px] overflow-y-auto">
            <template v-for="group in data?.devices" :key="group.username">
              <div v-for="device in group.devices" :key="device.id" class="flex items-center gap-3 px-4 py-3 border-t border-line first:border-t-0">
                <Icon name="mdi:cellphone" class="w-4 h-4 text-fg-3 shrink-0" />
                <div class="flex-1 min-w-0">
                  <p class="text-[14px] text-fg truncate">{{ device.model }}</p>
                  <p class="text-[11px] text-fg-3">{{ group.username }} · {{ formatTime(device.lastActive) }}</p>
                </div>
              </div>
            </template>
            <div v-if="!data?.totalDevices" class="px-4 py-4 text-[14px] text-fg-3">No devices registered</div>
          </div>
        </div>

        <!-- Security Events -->
        <div class="lg:col-span-4 card-panel">
          <div class="mb-4">
            <h2 class="section-title">Security Events</h2>
            <p class="text-[13px] text-fg-3">Recent auth activity</p>
          </div>
          <div class="hair-list max-h-[400px] overflow-y-auto">
            <div v-for="(event, i) in securityEvents" :key="i" class="flex items-center gap-3 px-4 py-3">
              <span class="dot" :class="getEventColor(event.action)"></span>
              <div class="flex-1 min-w-0">
                <p class="text-[14px] text-fg truncate">{{ event.username }} <span class="micro ml-1">{{ event.action }}</span></p>
                <p class="text-[11px] text-fg-3 truncate">{{ event.details || event.path }} · {{ formatTime(event.timestamp) }}</p>
              </div>
            </div>
            <div v-if="!securityEvents.length" class="px-4 py-4 text-[14px] text-fg-3">No events yet</div>
          </div>
        </div>
      </div>

      <!-- Server Info -->
      <div class="card-panel">
        <div class="mb-4">
          <h2 class="section-title">Server Information</h2>
          <p class="text-[13px] text-fg-3">Runtime diagnostics</p>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p class="text-[11px] text-fg-3 uppercase tracking-micro font-mono mb-1">Node.js</p>
            <p class="num text-[14px] text-fg">{{ data?.server?.nodeVersion || '-' }}</p>
          </div>
          <div>
            <p class="text-[11px] text-fg-3 uppercase tracking-micro font-mono mb-1">Platform</p>
            <p class="num text-[14px] text-fg">{{ data?.server?.platform || '-' }} / {{ data?.server?.arch || '-' }}</p>
          </div>
          <div>
            <p class="text-[11px] text-fg-3 uppercase tracking-micro font-mono mb-1">Heap Used</p>
            <p class="num text-[14px] text-fg">{{ formatSize(data?.server?.processMemory?.heapUsed) }}</p>
          </div>
          <div>
            <p class="text-[11px] text-fg-3 uppercase tracking-micro font-mono mb-1">RSS</p>
            <p class="num text-[14px] text-fg">{{ formatSize(data?.server?.processMemory?.rss) }}</p>
          </div>
          <div>
            <p class="text-[11px] text-fg-3 uppercase tracking-micro font-mono mb-1">CPU Load</p>
            <p class="num text-[14px] text-fg">{{ data?.server?.system?.cpuLoad?.toFixed(1) || '0' }}%</p>
          </div>
          <div>
            <p class="text-[11px] text-fg-3 uppercase tracking-micro font-mono mb-1">CPU Cores</p>
            <p class="num text-[14px] text-fg">{{ data?.server?.system?.cpuCores || '-' }}</p>
          </div>
          <div>
            <p class="text-[11px] text-fg-3 uppercase tracking-micro font-mono mb-1">System RAM</p>
            <p class="num text-[14px] text-fg">{{ formatSize(data?.server?.system?.ramUsed) }} / {{ formatSize(data?.server?.system?.ramTotal) }}</p>
          </div>
          <div>
            <p class="text-[11px] text-fg-3 uppercase tracking-micro font-mono mb-1">RAM Free</p>
            <p class="num text-[14px] text-fg">{{ formatSize(data?.server?.system?.ramFree) }}</p>
          </div>
        </div>
      </div>

      <!-- Top IPs -->
      <div class="card-panel">
        <div class="mb-4">
          <h2 class="section-title">Top Client IPs</h2>
          <p class="text-[13px] text-fg-3">Most active connections (click to inspect)</p>
        </div>
        <div class="hair-list">
          <div v-for="(ip, i) in (data?.traffic?.topIPs || []).slice(0, 8)" :key="i"
               @click="selectedIp = ip.ip"
               class="flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer group">
            <div class="flex items-center gap-2 min-w-0">
              <span class="num text-[14px] text-fg truncate">{{ ip.ip }}</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0 font-mono text-[11px]">
              <span class="num text-[13px] text-fg-2">{{ ip.count }} req</span>
              <span v-if="ip.geo?.countryCode" class="text-[11px] font-semibold uppercase text-fg-3" :title="ip.geo.country">{{ ip.geo.countryCode }}</span>
            </div>
          </div>
        </div>
        <div v-if="!data?.traffic?.topIPs?.length" class="text-[14px] text-fg-3 py-4">No data yet</div>
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

const selectedIp = ref<string | null>(null)

const trafficChartCanvas = ref<HTMLCanvasElement | null>(null)
const donutChartCanvas = ref<HTMLCanvasElement | null>(null)
const worldMapCanvas = ref<HTMLCanvasElement | null>(null)
const selectedWorldMapCanvas = ref<HTMLCanvasElement | null>(null)

let pollingInterval: any = null
let animationFrameId: any = null

// Stylized continent polygons in percentage (0-100) coordinates
const MAP_LANDMASSE_POLYGONS = [
    // North America
    [[10, 16], [12, 12], [22, 10], [30, 9], [34, 15], [37, 20], [33, 23], [30, 31], [27, 34], [25, 41], [23, 41], [21, 33], [14, 25]],
    // Greenland
    [[32, 6], [39, 7], [37, 13], [31, 12]],
    // South America
    [[22, 42], [27, 43], [34, 50], [31, 58], [27, 68], [23, 79], [21, 79], [22, 59], [20, 48]],
    // Africa
    [[41, 44], [49, 42], [57, 48], [55, 54], [51, 65], [49, 76], [46, 76], [44, 60], [40, 52]],
    // Europe & Asia
    [[40, 22], [46, 12], [52, 10], [58, 14], [68, 15], [78, 13], [86, 11], [88, 18], [82, 33], [79, 44], [72, 48], [66, 44], [56, 44], [51, 36], [41, 36]],
    // Australia
    [[73, 62], [82, 63], [81, 74], [73, 73]],
    // Madagascar
    [[55, 68], [57, 72], [55, 74]],
    // Japan
    [[82, 24], [84, 29], [81, 32]]
]

function isPointInPolygon(x: number, y: number, polygon: number[][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1]
    const xj = polygon[j][0], yj = polygon[j][1]
    const intersect = ((yi > y) !== (yj > y))
      && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

// IP Inspector computed states
const selectedIpGeo = computed(() => {
  if (!selectedIp.value || !data.value?.traffic?.topIPs) return null
  const ipData = data.value.traffic.topIPs.find((item: any) => item.ip === selectedIp.value)
  return ipData?.geo || null
})

const filteredRequests = computed(() => {
  if (!selectedIp.value || !data.value?.traffic?.recentRequests) return []
  return data.value.traffic.recentRequests.filter((r: any) => r.ip === selectedIp.value)
})

function getIpRequestCount(ip: string): number {
  if (!data.value?.traffic?.topIPs) return 0
  const ipData = data.value.traffic.topIPs.find((item: any) => item.ip === ip)
  return ipData?.count || 0
}

function getIpTrafficShare(ip: string): string {
  const total = data.value?.traffic?.totalRequests || 0
  if (total === 0) return '0'
  const count = getIpRequestCount(ip)
  return ((count / total) * 100).toFixed(1)
}

function isIpBlocked(ip: string): boolean {
  if (!data.value?.rateLimits?.limiters) return false
  return data.value.rateLimits.limiters.some((limiter: any) => {
    return limiter.blockedIPs.some((b: any) => b.ip === ip)
  })
}

const totalBlockedIPs = computed(() => {
  if (!data.value?.rateLimits?.limiters) return 0
  return data.value.rateLimits.limiters.reduce((sum: number, l: any) => sum + l.blockedIPs.length, 0)
})

const peakRequestsPerMin = computed(() => {
  if (!data.value?.traffic?.timeSeries) return 0
  return Math.max(...data.value.traffic.timeSeries.map((b: any) => b.count), 0)
})

// Canvas can't read CSS variables, so resolve 'var(--x)' to the current theme's value when drawing
function themeColor(value: string): string {
  const match = value.match(/^var\((--[\w-]+)\)$/)
  if (!match || typeof window === 'undefined') return value
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || value
}

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
  if (count2xx) categories.push({ label: '2xx Success', color: 'var(--success)', count: count2xx })
  if (count3xx) categories.push({ label: '3xx Redirect', color: 'var(--text-3)', count: count3xx })
  if (count4xx) categories.push({ label: '4xx Client', color: 'var(--warning)', count: count4xx })
  if (count5xx) categories.push({ label: '5xx Server', color: 'var(--danger)', count: count5xx })
  if (countOther) categories.push({ label: 'Other', color: 'var(--line-strong)', count: countOther })
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
  ctx.strokeStyle = themeColor('var(--line)')
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (h / 4) * i
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(rect.width - padding.right, y)
    ctx.stroke()

    // Y-axis labels
    const val = Math.round(maxVal - (maxVal / 4) * i)
    ctx.fillStyle = themeColor('var(--text-3)')
    ctx.font = '10px "Geist Mono Variable", monospace'
    ctx.textAlign = 'right'
    ctx.fillText(String(val), padding.left - 5, y + 3)
  }

  // Line
  ctx.beginPath()
  for (let i = 0; i < series.length; i++) {
    const x = padding.left + (w / (series.length - 1)) * i
    const y = padding.top + h - (series[i].count / maxVal) * h
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.strokeStyle = themeColor('var(--text)')
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'
  ctx.stroke()

  // Time labels
  ctx.fillStyle = themeColor('var(--text-3)')
  ctx.font = '10px "Geist Mono Variable", monospace'
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
    ctx.strokeStyle = themeColor('var(--line)')
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
    ctx.strokeStyle = themeColor(entry.color)
    ctx.lineWidth = 16
    ctx.lineCap = 'butt'
    ctx.stroke()
    startAngle += sliceAngle
  }
}

function drawWorldMapInternal(canvas: HTMLCanvasElement, singleIpMode: boolean = false) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, rect.width, rect.height)

  const w = rect.width
  const h = rect.height

  // Draw Solid Stylized Continents (Highly recognizable vectors)
  ctx.fillStyle = themeColor('var(--surface-2)')
  ctx.strokeStyle = themeColor('var(--line-strong)')
  ctx.lineWidth = 1
  ctx.lineJoin = 'round'

  for (const poly of MAP_LANDMASSE_POLYGONS) {
    if (poly.length === 0) continue
    ctx.beginPath()
    const firstX = (poly[0][0] / 100) * w
    const firstY = (poly[0][1] / 100) * h
    ctx.moveTo(firstX, firstY)
    for (let i = 1; i < poly.length; i++) {
      const px = (poly[i][0] / 100) * w
      const py = (poly[i][1] / 100) * h
      ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  // Draw IP markers
  const list = data.value?.traffic?.topIPs || []

  for (const item of list) {
    if (!item.geo || (item.geo.lat === 0 && item.geo.lon === 0)) continue
    
    // In single IP inspector mode, only draw the selected IP marker
    if (singleIpMode && item.ip !== selectedIp.value) continue

    const lon = item.geo.lon
    const lat = item.geo.lat

    // Equirectangular mapping coordinates
    const px = ((lon + 180) / 360) * w
    const py = ((90 - lat) / 180) * h

    const isSelected = selectedIp.value === item.ip
    // Ring around the selected marker
    if (isSelected) {
      ctx.beginPath()
      ctx.arc(px, py, 8, 0, Math.PI * 2)
      ctx.strokeStyle = themeColor('var(--text)')
      ctx.lineWidth = 1
      ctx.stroke()
    }

    // Core Dot
    ctx.beginPath()
    ctx.arc(px, py, isSelected ? 4.5 : 3, 0, Math.PI * 2)
    ctx.fillStyle = themeColor(isSelected ? 'var(--text)' : 'var(--text-2)')
    ctx.fill()

    // Draw active city tag label
    if (isSelected || (!singleIpMode && list.length <= 3)) {
      ctx.fillStyle = themeColor('var(--invert)')
      ctx.beginPath()
      const label = `${item.geo.city || 'Local'}, ${item.geo.countryCode || 'LCL'}`
      ctx.font = '10px "Geist Mono Variable", monospace'
      const textW = ctx.measureText(label).width
      ctx.roundRect(px - textW/2 - 5, py - 22, textW + 10, 15, 4)
      ctx.fill()

      ctx.fillStyle = themeColor('var(--on-invert)')
      ctx.textAlign = 'center'
      ctx.fillText(label, px, py - 11)
    }
  }
}

function handleMapClick(e: MouseEvent) {
  const canvas = worldMapCanvas.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const w = rect.width
  const h = rect.height
  const list = data.value?.traffic?.topIPs || []

  for (const item of list) {
    if (!item.geo) continue
    const px = ((item.geo.lon + 180) / 360) * w
    const py = ((90 - item.geo.lat) / 180) * h

    const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2)
    if (dist < 12) {
      selectedIp.value = item.ip
      return
    }
  }
}

function animateMap() {
  if (selectedIp.value && selectedWorldMapCanvas.value) {
    drawWorldMapInternal(selectedWorldMapCanvas.value, true)
  } else if (worldMapCanvas.value) {
    drawWorldMapInternal(worldMapCanvas.value, false)
  }
  animationFrameId = requestAnimationFrame(animateMap)
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
    minute: '2-digit',
    second: '2-digit'
  })
}

function getEventColor(action: string): string {
  switch (action) {
    case 'LOGIN_SUCCESS':
    case 'DEVICE_REGISTER': return 'text-success'
    case 'LOGIN_FAIL':
    case '2FA_FAIL':
    case 'DEVICE_REVOKE': return 'text-error'
    case 'PASSWORD_CHANGE': return 'text-warning'
    default: return 'text-fg-3'
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
  animateMap()
})

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
})
</script>

<style scoped>
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 24px 16px;
  background: var(--bg);
}
.stat-value {
  font-family: 'Geist Mono Variable', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
  font-size: 1.875rem;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--text);
}
.stat-label {
  font-family: 'Geist Mono Variable', ui-monospace, monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-3);
}
.card-panel {
  min-width: 0;
}
</style>
