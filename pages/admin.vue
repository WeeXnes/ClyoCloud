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
              <button v-if="selectedIp" @click="selectedIp = null" class="btn btn-ghost btn-circle btn-xs mr-1">
                <Icon name="mdi:arrow-left" class="w-4 h-4" />
              </button>
              <div class="w-8 h-8 rounded-lg bg-error/10 flex items-center justify-center border border-error/20">
                <Icon name="mdi:shield-crown" class="text-error w-5 h-5" />
              </div>
              <div>
                <h1 class="text-base font-extrabold tracking-tight">
                  {{ selectedIp ? `IP Inspector: ${selectedIp}` : 'Admin Dashboard' }}
                </h1>
                <p class="text-[9px] font-bold text-base-content/30 uppercase tracking-widest leading-none mt-0.5">
                  {{ selectedIp ? 'Client Traffic Analysis' : 'System Administration' }}
                </p>
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

    <!-- IP Traffic Inspector Sub-Page -->
    <main v-else-if="selectedIp" class="flex-1 w-full max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
      
      <!-- Back button and IP Info Card -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <!-- Geolocation & Limit Info -->
        <div class="lg:col-span-4 card-panel flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-bold uppercase tracking-wider text-base-content/50">Client Identity</h2>
              <span v-if="isIpBlocked(selectedIp)" class="badge badge-error badge-sm uppercase tracking-wider font-extrabold text-[8px] px-2 py-0.5 rounded border border-error/10">Blocked</span>
              <span v-else class="badge badge-success badge-sm uppercase tracking-wider font-extrabold text-[8px] px-2 py-0.5 rounded border border-success/10">Active</span>
            </div>
            <div class="space-y-4">
              <div>
                <p class="text-[9px] text-base-content/40 font-bold uppercase tracking-wider">IP Address</p>
                <p class="text-lg font-mono font-extrabold text-primary">{{ selectedIp }}</p>
              </div>
              <div>
                <p class="text-[9px] text-base-content/40 font-bold uppercase tracking-wider">Location</p>
                <p class="text-sm font-bold">{{ selectedIpGeo?.city || 'Local' }}, {{ selectedIpGeo?.country || 'Intranet' }}</p>
                <p class="text-[10px] text-base-content/30 font-mono mt-0.5">Coords: {{ selectedIpGeo?.lat?.toFixed(4) || '0' }}, {{ selectedIpGeo?.lon?.toFixed(4) || '0' }}</p>
              </div>
              <div>
                <p class="text-[9px] text-base-content/40 font-bold uppercase tracking-wider">Total Requests</p>
                <p class="text-sm font-bold">{{ getIpRequestCount(selectedIp) }} requests ({{ getIpTrafficShare(selectedIp) }}% of total)</p>
              </div>
            </div>
          </div>

          <div class="pt-6 border-t border-base-content/5 mt-6 flex gap-2">
            <button @click="selectedIp = null" class="btn btn-sm rounded-xl flex-1 font-bold">
              <Icon name="mdi:arrow-left" class="w-4 h-4 mr-1" /> Close Inspector
            </button>
          </div>
        </div>

        <!-- IP Map Location -->
        <div class="lg:col-span-8 card-panel relative overflow-hidden flex flex-col justify-center min-h-[250px]">
          <div class="absolute inset-0 bg-base-300/20 z-0"></div>
          <div class="relative z-10 w-full h-[220px]">
            <canvas ref="selectedWorldMapCanvas" class="w-full h-full rounded-xl"></canvas>
          </div>
        </div>
      </div>

      <!-- Log Table for Selected IP -->
      <div class="card-panel">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-sm font-bold">Recent Request Logs</h2>
            <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Real-time HTTP requests from this address</p>
          </div>
          <span class="text-[10px] font-mono text-base-content/40">Showing last {{ filteredRequests.length }} entries</span>
        </div>

        <div class="overflow-x-auto custom-scrollbar">
          <table class="table table-xs w-full text-left font-mono">
            <thead>
              <tr class="border-b border-base-content/10 text-base-content/40 uppercase tracking-widest text-[9px] font-bold">
                <th class="py-2.5">Time</th>
                <th class="py-2.5">Method</th>
                <th class="py-2.5">Path</th>
                <th class="py-2.5">Status</th>
                <th class="py-2.5">User Agent</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(req, i) in filteredRequests" :key="i" class="border-b border-base-content/5 hover:bg-base-200/50">
                <td class="py-2 text-[10px] text-base-content/50">{{ formatTime(req.timestamp) }}</td>
                <td class="py-2">
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide"
                        :class="req.method === 'POST' ? 'bg-primary/10 text-primary' : 'bg-success/10 text-success'">
                    {{ req.method }}
                  </span>
                </td>
                <td class="py-2 text-[10px] font-bold text-base-content/80 max-w-xs truncate flex items-center gap-1.5" :title="req.path">
                  <Icon v-if="req.isAuth" name="mdi:lock" class="w-3.5 h-3.5 text-success shrink-0" title="Authenticated request (Auth middleware verified)" />
                  <span class="truncate">{{ req.path }}</span>
                </td>
                <td class="py-2">
                  <span class="px-1.5 py-0.25 rounded text-[9px] font-extrabold font-mono"
                        :class="req.statusCode < 300 ? 'text-success bg-success/10' : req.statusCode < 400 ? 'text-info bg-info/10' : 'text-error bg-error/10'">
                    {{ req.statusCode }}
                  </span>
                </td>
                <td class="py-2 text-[9px] text-base-content/40 max-w-sm truncate" :title="req.userAgent">{{ req.userAgent || '-' }}</td>
              </tr>
              <tr v-if="!filteredRequests.length">
                <td colspan="5" class="py-8 text-center text-xs text-base-content/30 font-bold">No recent requests recorded for this IP</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <!-- Main Dashboard Page -->
    <main v-else class="flex-1 w-full max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-500">

      <!-- World Map Card -->
      <div class="card-panel">
        <div class="mb-4">
          <h2 class="text-sm font-bold">Connection Map</h2>
          <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Geographic mapping of incoming client connections (click markers to inspect)</p>
        </div>
        <div class="relative w-full h-[300px] rounded-xl overflow-hidden bg-base-200/20 border border-base-content/5">
          <canvas ref="worldMapCanvas" @click="handleMapClick" class="w-full h-full cursor-pointer"></canvas>
        </div>
      </div>

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
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 min-h-[12rem] py-4 sm:py-0">
            <div class="relative w-40 h-40 shrink-0">
              <canvas ref="donutChartCanvas" width="160" height="160" class="w-40 h-40"></canvas>
              <div class="absolute inset-0 flex items-center justify-center flex-col">
                <span class="text-lg font-bold">{{ data?.traffic?.totalRequests?.toLocaleString() || '0' }}</span>
                <span class="text-[9px] text-base-content/40 uppercase font-bold">Total</span>
              </div>
            </div>
            <div class="space-y-1.5 sm:space-y-2 flex flex-row sm:flex-col flex-wrap justify-center gap-x-4 gap-y-1 sm:gap-0">
              <div v-for="(entry, i) in statusCodeEntries" :key="i" class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: entry.color }"></span>
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
                  <span class="font-mono text-error hover:underline cursor-pointer font-bold" @click="selectedIp = blocked.ip">{{ blocked.ip }}</span>
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
          <p class="text-[10px] text-base-content/40 font-bold uppercase tracking-wider">Most active connections (click to inspect)</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div v-for="(ip, i) in (data?.traffic?.topIPs || []).slice(0, 8)" :key="i"
               @click="selectedIp = ip.ip"
               class="flex items-center justify-between p-2.5 rounded-lg bg-base-200/50 border border-base-content/5 hover:border-primary/40 hover:bg-base-200 transition-all duration-200 cursor-pointer group">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-1.5 h-1.5 rounded-full bg-success"></span>
              <span class="text-[11px] font-mono font-bold text-base-content/60 group-hover:text-base-content truncate">{{ ip.ip }}</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
              <span class="badge badge-sm bg-base-300 border-none text-base-content/40 group-hover:text-primary transition-colors font-bold">{{ ip.count }} req</span>
              <span v-if="ip.geo?.countryCode" class="text-[9px] font-extrabold uppercase text-base-content/30" :title="ip.geo.country">{{ ip.geo.countryCode }}</span>
            </div>
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

  // Draw Grid Lines (Latitude/Longitude style) for high-tech network appearance
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)'
  ctx.lineWidth = 0.8
  const gridSize = 20
  for (let x = 0; x < w; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
    ctx.stroke()
  }
  for (let y = 0; y < h; y += gridSize) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }

  // Draw Solid Stylized Continents (Highly recognizable vectors)
  ctx.fillStyle = 'rgba(99, 102, 241, 0.08)' // soft glowing fill
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.22)' // crisp boundary stroke
  ctx.lineWidth = 1.2
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
  const time = Date.now() / 1000

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
    const pulseRad = 5 + Math.sin(time * 5 + (isSelected ? 2 : 0)) * (isSelected ? 4 : 2)

    // Pulse Ring
    ctx.beginPath()
    ctx.arc(px, py, pulseRad, 0, Math.PI * 2)
    ctx.strokeStyle = isSelected ? 'rgba(239, 68, 68, 0.5)' : 'rgba(245, 158, 11, 0.4)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Core Dot
    ctx.beginPath()
    ctx.arc(px, py, isSelected ? 4.5 : 3, 0, Math.PI * 2)
    ctx.fillStyle = isSelected ? '#ef4444' : '#f59e0b'
    ctx.fill()

    // Draw active city tag label
    if (isSelected || (!singleIpMode && list.length <= 3)) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
      ctx.beginPath()
      const label = `${item.geo.city || 'Local'}, ${item.geo.countryCode || 'LCL'}`
      ctx.font = 'bold 8px monospace'
      const textW = ctx.measureText(label).width
      ctx.roundRect(px - textW/2 - 4, py - 18, textW + 8, 11, 3)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.fillText(label, px, py - 10)
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
  animateMap()
})

onUnmounted(() => {
  if (pollingInterval) clearInterval(pollingInterval)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
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
