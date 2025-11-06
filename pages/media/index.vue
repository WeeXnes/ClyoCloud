<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import type { Video, FileMeta, Tag } from '~/types/File'

const videos = ref<Video[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const searchQuery = ref('')
const showTagModal = ref(false)
const selectedVideoPath = ref('')
const selectedTags = ref<Tag[]>([])
const predefinedTags = ref<Tag[]>([])
const showNewTagForm = ref(false)
const newTagName = ref('')
const newTagColor = ref('#4B5EAA')

async function fetchVideos() {
  try {
    isLoading.value = true
    const response = await fetch('/api/videos', {
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch videos: ${response.statusText}`)
    }
    videos.value = await response.json()
  } catch (err) {
    console.error('Error fetching videos:', err)
    error.value = 'Failed to load videos. Please try again.'
  } finally {
    isLoading.value = false
  }
}

async function fetchPredefinedTags() {
  try {
    const response = await fetch('/api/tags', {
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error(`Failed to fetch tags: ${response.statusText}`)
    }
    predefinedTags.value = await response.json()
  } catch (err) {
    console.error('Error fetching tags:', err)
  }
}

onMounted(() => {
  fetchVideos()
  fetchPredefinedTags()
})

function formatFileSize(size: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const hasThumbnail = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['mp4'].includes(ext)
}

const getThumbnailUrl = (fullPath: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  return `${baseUrl}/thumbnail/${encodeURIComponent(fullPath)}`
}

const goToVideo = (fullPath: string) => {
  const segments = fullPath.split('/')
  const encodedPath = segments.map(segment => encodeURIComponent(segment)).join('/')
  navigateTo(`/media/${encodedPath}`)
}

const openTagModal = (fullPath: string) => {
  selectedVideoPath.value = fullPath
  selectedTags.value = []
  showNewTagForm.value = false
  newTagName.value = ''
  newTagColor.value = '#4B5EAA'
  showTagModal.value = true
}

const closeTagModal = () => {
  showTagModal.value = false
}

const addTag = async () => {
  let tagsToAdd: Tag[] = []
  if (showNewTagForm.value) {
    if (!newTagName.value.trim()) {
      alert('Tag name is required');
      return;
    }
    tagsToAdd.push({ name: newTagName.value, color: newTagColor.value })
  } else {
    tagsToAdd = selectedTags.value
  }

  if (tagsToAdd.length === 0) {
    alert('Please select or create at least one tag.');
    return;
  }

  try {
    const response = await fetch('/api/video-tag', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        fullPath: selectedVideoPath.value,
        tags: tagsToAdd,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to add tags`);
    }
    await fetchVideos(); // Refresh video list
    closeTagModal();
  } catch (err) {
    console.error('Error adding tags:', err);
    alert('Failed to add tags. Please try again.');
  }
};

watch(searchQuery, () => {
  currentPage.value = 1
})

const filteredVideos = computed(() => {
  if (!searchQuery.value.trim()) {
    return videos.value
  }
  const query = searchQuery.value.trim().toLowerCase()
  return videos.value.filter(video => {
    const nameMatch = video.name.toLowerCase().includes(query)
    const tagMatch = video.meta.tags.some(tag => tag.name.toLowerCase().includes(query))
    return nameMatch || tagMatch
  })
})

const currentPage = ref(1)
const videosPerPage = 30

const paginatedVideos = computed(() => {
  const start = (currentPage.value - 1) * videosPerPage
  const end = start + videosPerPage
  return filteredVideos.value.slice(start, end)
})

const totalPages = computed(() => {
  return Math.ceil(filteredVideos.value.length / videosPerPage)
})

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}
</script>

<template>
  <div class="container mx-auto p-4">
    <!-- Search Bar -->
    <div class="mb-6">
      <input
          v-model="searchQuery"
          type="text"
          placeholder="Search videos by name or tag..."
          class="input input-bordered input-primary w-full max-w-md"
      />
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center items-center h-64">
      <div class="loading loading-spinner loading-lg"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error">
      <span>{{ error }}</span>
    </div>

    <!-- Video Grid -->
    <div v-else-if="paginatedVideos.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <div
          v-for="video in paginatedVideos"
          :key="video.fullPath"
          class="card bg-base-100 shadow-xl cursor-pointer hover:bg-base-300"
          @click="goToVideo(video.fullPath)"
      >
        <figure>
          <img
              v-if="hasThumbnail(video.name)"
              :src="getThumbnailUrl(video.fullPath)"
              class="w-full h-48 object-cover rounded-t-lg"
              alt="Video thumbnail"
              style="aspect-ratio: 16 / 9;"
          />
          <div v-else class="w-full h-48 bg-gray-200 flex items-center justify-center">
            <span class="text-gray-500">No Thumbnail</span>
          </div>
        </figure>
        <div class="card-body">
          <h2 class="card-title text-lg line-clamp-2">{{ video.name }}</h2>
          <p class="text-sm text-gray-500">
            {{ formatFileSize(video.size) }} • {{ formatDate(video.lastModified) }}
          </p>
          <div class="flex flex-wrap gap-2 mt-2">
            <span
                v-for="tag in video.meta.tags"
                :key="tag.name"
                class="badge"
                :style="{ backgroundColor: tag.color }"
            >
              {{ tag.name }}
            </span>
          </div>
          <div class="card-actions justify-end mt-4">
            <button
                class="btn btn-secondary btn-sm"
                @click.stop="openTagModal(video.fullPath)"
            >
              Add Tag
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination Controls -->
    <div v-if="totalPages > 1" class="flex justify-center items-center mt-8">
      <button
          @click="prevPage"
          :disabled="currentPage === 1"
          class="btn btn-primary mr-4"
      >
        Previous
      </button>
      <span class="text-lg">{{ currentPage }} / {{ totalPages }}</span>
      <button
          @click="nextPage"
          :disabled="currentPage === totalPages"
          class="btn btn-primary ml-4"
      >
        Next
      </button>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12">
      <p class="text-xl text-gray-500">No videos found.</p>
    </div>

    <!-- Tag Modal -->
    <div v-if="showTagModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Add Tag to Video</h3>

        <div v-if="!showNewTagForm">
          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">Select Tags</span>
            </label>
            <select
                v-model="selectedTags"
                multiple
                class="select select-bordered w-full"
            >
              <option v-for="tag in predefinedTags" :key="tag.name" :value="tag">
                {{ tag.name }}
              </option>
            </select>
          </div>
          <div class="modal-action">
            <button class="btn btn-primary" @click="addTag">Add Tags</button>
            <button class="btn btn-ghost" @click="showNewTagForm = true">Create New Tag</button>
            <button class="btn btn-ghost" @click="closeTagModal">Cancel</button>
          </div>
        </div>

        <div v-else>
          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">Tag Name</span>
            </label>
            <input
                v-model="newTagName"
                type="text"
                placeholder="Enter tag name"
                class="input input-bordered w-full"
            />
          </div>
          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">Tag Color</span>
            </label>
            <input
                v-model="newTagColor"
                type="color"
                class="input input-bordered w-full"
            />
          </div>
          <div class="modal-action">
            <button class="btn btn-primary" @click="addTag">Add Tag</button>
            <button class="btn btn-ghost" @click="showNewTagForm = false">Back to Predefined</button>
            <button class="btn btn-ghost" @click="closeTagModal">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Ensure long titles don't overflow */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>