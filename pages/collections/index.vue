<script setup lang="ts">
import { ref, onMounted } from 'vue'

useHead({
  title: 'Collections'
})
import type { Tag } from '~/types/File'

const tags = ref<Tag[]>([])
const isLoading = ref(true)

const fetchTags = async () => {
  isLoading.value = true
  try {
    const response = await fetch('/api/tags', { credentials: 'include' })
    if (response.ok) {
      tags.value = await response.json()
    }
  } catch (err) {
    console.error('Error fetching tags:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchTags()
})
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
                <h1 class="text-[15px] font-medium tracking-section text-fg leading-tight">Collections</h1>
                <p class="hidden sm:block text-[13px] text-fg-3 leading-tight">Browse files by tag</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="page-wrap py-10">
      <div v-if="isLoading" class="hair-list">
        <div v-for="i in 6" :key="i" class="h-[52px] animate-pulse"></div>
      </div>

      <div v-else-if="tags.length" class="hair-list">
        <NuxtLink
          v-for="tag in tags"
          :key="tag.name"
          :to="`/collections/${encodeURIComponent(tag.name)}`"
          class="flex items-center gap-3 px-4 h-[52px] hover:bg-surface-2 transition-colors group"
        >
          <span class="dot" :style="{ backgroundColor: tag.color }"></span>
          <span class="flex-1 min-w-0 text-[14px] text-fg truncate">{{ tag.name }}</span>
          <Icon name="mdi:arrow-right" class="w-4 h-4 text-fg-3 group-hover:text-fg transition-colors" />
        </NuxtLink>
      </div>

      <div v-else class="py-24 text-center">
        <p class="text-[15px] text-fg">No collections yet.</p>
        <p class="text-[14px] text-fg-3 mt-1">Tag files to group them here.</p>
        <NuxtLink to="/files" class="btn btn-sm mt-6">Go to files</NuxtLink>
      </div>
    </main>
  </div>
</template>
