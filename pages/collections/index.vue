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
  <div class="min-h-screen bg-base-200/50">
    <header class="sticky top-0 z-[40] w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/10">
      <div class="w-full px-4 py-3 md:py-4 sm:px-6 lg:px-8">
        <div class="flex items-center gap-3">
          <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-xs md:btn-sm lg:hidden">
            <Icon name="mdi:menu" class="w-5 h-5" />
          </label>
          <div class="flex flex-col">
            <h1 class="text-base md:text-lg font-bold tracking-tight flex items-center gap-2 text-base-content">
              <Icon name="mdi:tag-multiple" class="text-primary w-5 h-5" />
              Collections
            </h1>
            <p class="text-[9px] md:text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">Browse files by tag</p>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div v-if="isLoading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        <div v-for="i in 12" :key="i" class="h-32 bg-base-300 animate-pulse rounded-xl"></div>
      </div>

      <div v-else-if="tags.length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
        <NuxtLink 
          v-for="tag in tags" 
          :key="tag.name"
          :to="`/collections/${encodeURIComponent(tag.name)}`"
          class="group relative h-32 rounded-xl border border-base-content/10 bg-base-100 p-6 flex flex-col items-center justify-center gap-3 transition-all duration-300 hover:border-primary/30 hover:-translate-y-1 shadow-sm hover:shadow-md"
        >
          <div 
            class="w-12 h-12 rounded-lg flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300"
            :style="{ backgroundColor: tag.color }"
          >
            <Icon name="mdi:tag" class="w-6 h-6" />
          </div>
          <span class="font-bold text-sm tracking-tight text-base-content">{{ tag.name }}</span>
          
          <!-- Background Glow -->
          <div 
            class="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 rounded-xl"
            :style="{ backgroundColor: tag.color }"
          ></div>
        </NuxtLink>
      </div>

      <div v-else class="flex flex-col items-center justify-center py-24 text-center">
        <div class="bg-base-200/50 p-6 rounded-xl mb-6">
          <Icon name="mdi:tag-off-outline" class="w-16 h-16 text-base-content/10" />
        </div>
        <h3 class="text-xl font-bold tracking-tight text-base-content">No collections found</h3>
        <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">Start tagging your files to create collections.</p>
        <NuxtLink to="/files" class="btn btn-primary btn-sm mt-8 px-8 rounded-lg shadow-sm font-bold uppercase tracking-widest text-[10px]">
          Go to Files
        </NuxtLink>
      </div>
    </main>
  </div>
</template>
