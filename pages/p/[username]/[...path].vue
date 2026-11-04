<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({
  layout: false
})

const route = useRoute()
const username = route.params.username as string
const pathParam = Array.isArray(route.params.path) ? route.params.path.join('/') : route.params.path

const formatFileSize = (size: number): string => {
  if (size === undefined || size === null || isNaN(size)) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`
}

const getPublicFileUrl = () => {
  return `/p/file/${encodeURIComponent(username)}/${encodeURIComponent(pathParam)}`
}

const getPublicStreamUrl = () => {
  return `/p/stream/${encodeURIComponent(username)}/${encodeURIComponent(pathParam)}`
}

const isVideoFile = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['mp4', 'webm'].includes(ext)
}

const isImageFile = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)
}

// Fetch file info via SSR-friendly useFetch
const { data: fileInfo, error: fetchError } = await useFetch(`/api/public/file-info`, {
  query: {
    username,
    path: pathParam
  }
})

const error = ref<string | null>(null)
if (fetchError.value) {
  error.value = fetchError.value.data?.statusMessage || fetchError.value.statusMessage || 'File not found or not public'
}

const isLoading = ref(false)

// Dynamic OpenGraph / Discord Embed Metadata
if (fileInfo.value) {
  const requestUrl = useRequestURL()
  const baseUrl = requestUrl.origin

  const isFolder = fileInfo.value.isFolder
  const name = fileInfo.value.name
  const sizeStr = formatFileSize(fileInfo.value.size)
  const description = fileInfo.value.meta?.description || ''

  const title = isFolder ? `Shared folder: ${name}` : `Shared file: ${name}`
  const ogDescription = [
    `Size: ${sizeStr}`,
    description ? `Note: ${description}` : ''
  ].filter(Boolean).join(' | ')

  const ext = name.split('.').pop()?.toLowerCase() || ''
  const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)
  const isVid = ['mp4', 'webm'].includes(ext)

  const publicFileUrl = `${baseUrl}/p/file/${encodeURIComponent(username)}/${encodeURIComponent(pathParam)}`
  const publicStreamUrl = `${baseUrl}/p/stream/${encodeURIComponent(username)}/${encodeURIComponent(pathParam)}`
  const publicThumbnailUrl = `${baseUrl}/p/thumbnail/${encodeURIComponent(username)}/${encodeURIComponent(pathParam)}`

  useSeoMeta({
    title,
    ogTitle: title,
    description: ogDescription,
    ogDescription: ogDescription,
    ogType: isVid ? 'video.other' : 'website',
    ogUrl: requestUrl.href,
    twitterCard: isVid || isImg ? 'summary_large_image' : 'summary',
    ...(isImg ? {
      ogImage: publicFileUrl,
      twitterImage: publicFileUrl,
    } : {}),
    ...(isVid ? {
      ogImage: publicThumbnailUrl,
      ogVideo: publicStreamUrl,
      twitterImage: publicThumbnailUrl,
      twitterPlayer: publicStreamUrl,
    } : {})
  })
}
</script>

<template>
  <div class="min-h-screen bg-base-100 font-sans flex flex-col">
    <header class="h-header border-b border-line sticky top-0 z-50 bg-base-100">
      <div class="max-w-form mx-auto h-full px-4 flex items-center justify-between">
        <span class="text-[15px] leading-none whitespace-nowrap">
          <span class="font-semibold text-fg tracking-section">ClyoCloud</span><span class="text-fg-3"> / Share</span>
        </span>
        <NuxtLink to="/login" class="text-[14px] text-fg-2 hover:text-fg transition-colors">Sign in</NuxtLink>
      </div>
    </header>

    <main class="flex-1 max-w-form mx-auto w-full px-4 py-12 sm:py-16">

      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center gap-3 text-[14px] text-fg-3">
        <span class="loading loading-spinner loading-sm"></span>
        Loading…
      </div>

      <!-- Error State -->
      <div v-else-if="error">
        <p class="flex items-center gap-2 text-[13px] text-fg-2 mb-3"><span class="dot text-error"></span>Not available</p>
        <h1 class="page-title mb-2">This link doesn’t work</h1>
        <p class="text-fg-2">{{ error }}</p>
        <NuxtLink to="/" class="btn btn-sm mt-8">Go to ClyoCloud</NuxtLink>
      </div>

      <!-- Shared item -->
      <article v-else-if="fileInfo">
        <div v-if="isImageFile(fileInfo.name) || isVideoFile(fileInfo.name)" class="rounded-xl overflow-hidden border border-line bg-black mb-10">
          <img v-if="isImageFile(fileInfo.name)" :src="getPublicFileUrl()" class="max-h-[60vh] w-full object-contain" :alt="fileInfo.name" />
          <video v-else-if="isVideoFile(fileInfo.name)" controls class="w-full aspect-video">
            <source :src="getPublicStreamUrl()" type="video/mp4" />
          </video>
        </div>

        <p class="micro mb-3">{{ fileInfo.isFolder ? 'Shared folder' : 'Shared file' }}</p>
        <h1 class="text-[1.75rem] sm:text-[2rem] font-medium tracking-title text-fg leading-tight break-words" :title="fileInfo.isFolder ? `${fileInfo.name}.zip` : fileInfo.name">
          {{ fileInfo.isFolder ? `${fileInfo.name}.zip` : fileInfo.name }}
        </h1>

        <dl class="grid grid-cols-2 border-y border-line mt-8">
          <div class="py-4 pr-4">
            <dt class="micro">Size</dt>
            <dd class="num text-[15px] text-fg mt-1">{{ formatFileSize(fileInfo.size) }}</dd>
          </div>
          <div class="py-4 pl-4 border-l border-line">
            <dt class="micro">Modified</dt>
            <dd class="num text-[15px] text-fg mt-1">{{ new Date(fileInfo.lastModified).toLocaleDateString() }}</dd>
          </div>
        </dl>

        <div v-if="fileInfo.meta?.tags?.length" class="flex flex-wrap gap-1.5 mt-6">
          <NuxtLink
            v-for="tag in fileInfo.meta.tags"
            :key="tag.name"
            :to="`/collections/${encodeURIComponent(tag.name)}`"
            class="tag-chip"
          >
            <span class="dot" :style="{ backgroundColor: tag.color }"></span>
            {{ tag.name }}
          </NuxtLink>
        </div>

        <section v-if="fileInfo.meta?.description" class="mt-10">
          <h2 class="micro mb-2">Note from the owner</h2>
          <p class="text-fg-2 whitespace-pre-line">{{ fileInfo.meta.description }}</p>
        </section>

        <a :href="getPublicFileUrl()" download class="btn btn-primary gap-2 mt-10 w-full sm:w-auto">
          <Icon name="mdi:download" class="w-4 h-4" />
          Download{{ fileInfo.isFolder ? ' as .zip' : '' }}
        </a>
      </article>
    </main>

    <footer class="border-t border-line">
      <div class="max-w-form mx-auto px-4 py-4 text-[13px] text-fg-3">
        Shared with ClyoCloud <span class="num">v{{ useRuntimeConfig().public.version }}</span>
      </div>
    </footer>
  </div>
</template>
