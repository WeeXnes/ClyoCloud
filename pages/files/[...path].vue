<template>
  <div>
    <!-- Header and breadcrumb sections -->
    <div class="flex flex-wrap justify-between items-center mb-4 lg:mb-6 gap-2">
      <div class="flex items-center gap-2">
        <label for="sidebar-drawer" class="btn btn-ghost btn-circle lg:hidden">
          <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
          </svg>
        </label>
        <h2 class="text-lg lg:text-xl font-semibold">My Files</h2>
      </div>
      <div class="flex flex-wrap items-center gap-2 lg:gap-4">
        <select v-model="sortOption" class="select select-sm select-bordered">
          <option value="name">Name</option>
          <option value="size">Size</option>
          <option value="date">Date</option>
        </select>
        <button v-if="useRoute().params.path" class="btn btn-sm" @click="downloadFolder">
          Download Folder
        </button>
        <label class="flex items-center gap-2">
          <span class="text-sm">List</span>
          <input type="checkbox" class="toggle toggle-primary" v-model="isGridView"/>
          <span class="text-sm">Grid</span>
        </label>
        <label for="upload-modal" class="btn btn-primary btn-sm lg:btn-md">
          Upload
        </label>
      </div>
    </div>

    <!-- Bulk actions -->
    <div v-if="selectedFiles.size > 0" class="flex gap-2 mb-4 p-2 bg-base-100 shadow rounded">
      <button class="btn btn-sm btn-error" @click="bulkDelete">Delete Selected</button>
      <button class="btn btn-sm" @click="bulkDownload">Download Selected</button>
      <span class="text-sm self-center">{{ selectedFiles.size }} selected</span>
    </div>

    <div class="flex items-center gap-1 text-sm text-base-content/70 mb-2">
      <NuxtLink to="/files" class="hover:underline">Files</NuxtLink>
      <template v-for="(folder, index) in useRoute().params.path" :key="index">
        <Icon
            name="ic:baseline-arrow-forward-ios"
            class="w-4 h-4 mx-1"
            fill="currentColor"
            viewBox="0 0 20 20"
        />
        <NuxtLink
            :to="`/files/${useRoute().params.path.slice(0, index + 1).map(encodeURIComponent).join('/')}`"
            class="hover:underline"
        >
          {{ folder }}
        </NuxtLink>
      </template>
    </div>
    <br>

    <div 
      @dragover.prevent 
      @drop.prevent="handleDrop"
      :class="isGridView ? 'grid gap-4 justify-center grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'flex flex-col gap-2'"
    >
      <div v-for="file in sortedFiles" :key="file.name" :class="isGridView ? 'card bg-base-100 shadow-md relative' : 'card bg-base-100 shadow-md'">
        
        <!-- Grid View -->
        <div v-if="isGridView" class="card-body p-4 flex flex-col gap-4 cursor-pointer" @click="onFileClick($event, file)" @contextmenu.prevent="startRename(file)">
          <div class="w-full h-[135px] bg-base-200 rounded-lg flex items-center justify-center overflow-hidden relative" data-is-thumbnail="true">
            <template v-if="file.isFolder">
              <Icon name="vscode-icons:default-folder" class="w-12 h-12" />
            </template>
            <template v-else>
              <img v-if="hasThumbnail(file.name)" :src="getThumbnailUrl(file.name)" class="w-full h-full object-cover rounded-lg" alt="Thumbnail" data-is-thumbnail="true" />
              <Icon v-else class="w-12 h-12" fill="currentColor" viewBox="0 0 20 20" v-bind:name="getIconForExtension(file.name)" data-is-thumbnail="true" />
            </template>
          </div>
          <div class="flex-1 flex justify-between items-center overflow-hidden">
            <div class="min-w-0 flex-1">
              <input v-if="editingName === file.name" v-model="newName" class="input input-sm w-full" @keyup.enter="saveRename(file.name)" @blur="saveRename(file.name)" @click.stop />
              <h3 v-else class="card-title text-sm truncate block">{{ file.name }}</h3>
              <p class="text-xs text-base-content/70 truncate">{{ (file.size / 1024 / 1024).toFixed(2) }} MB • {{ new Date(file.lastModified).toLocaleDateString() }}</p>
            </div>
            <div class="ml-2 shrink-0">
              <input type="checkbox" class="checkbox" :checked="selectedFiles.has(file.name)" @change="toggleSelection(file.name)" @click.stop />
            </div>
          </div>
        </div>

        <!-- List View -->
        <div v-else class="card-body flex flex-row items-center gap-4 p-4 cursor-pointer" @click="onFileClick($event, file)" @contextmenu.prevent="startRename(file)">
          <input type="checkbox" class="checkbox" :checked="selectedFiles.has(file.name)" @change="toggleSelection(file.name)" @click.stop />
          <div class="text-3xl">
            <Icon class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" :name="file.isFolder ? 'vscode-icons:default-folder' : getIconForExtension(file.name)" />
          </div>
          <div class="flex-grow flex items-center justify-between">
            <div class="flex-grow">
              <input v-if="editingName === file.name" v-model="newName" class="input input-sm w-full" @keyup.enter="saveRename(file.name)" @blur="saveRename(file.name)" @click.stop />
              <h3 v-else class="card-title text-sm lg:text-base">{{ file.name }}</h3>
            </div>
            <div class="flex items-center gap-4 text-xs lg:text-sm text-base-content/70 ml-4 whitespace-nowrap">
              <span v-if="!file.isFolder">{{ (file.size / 1024 / 1024).toFixed(2) }} MB</span>
              <span>{{ new Date(file.lastModified).toLocaleDateString() }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Upload Modal -->
    <input type="checkbox" id="upload-modal" class="modal-toggle" />
    <div class="modal">
      <div class="modal-box w-11/12 max-w-md">
        <h3 class="font-bold text-lg">Upload File</h3>
        <div class="form-control">
          <label class="label">
            <span class="label-text">Select File</span>
          </label>
          <input type="file" multiple @change="handleFileSelect" class="file-input file-input-bordered w-full" />
        </div>
        <div v-if="isUploading" class="mt-2">
          <progress class="progress progress-primary w-full" :value="uploadProgress" max="100"></progress>
          <p class="text-sm text-center">{{ uploadProgress }}% Complete</p>
        </div>
        <div v-if="uploadError" class="text-error text-sm mt-2">{{ uploadError }}</div>
        <div v-if="uploadSuccess" class="text-success text-sm mt-2">File uploaded successfully!</div>
        <div class="modal-action">
          <label for="upload-modal" class="btn btn-sm">Cancel</label>
          <label class="btn btn-primary btn-sm" :class="{ 'loading': isUploading }" @click="uploadFile">Upload</label>
        </div>
      </div>
    </div>

    <!-- File Info Modal -->
    <div class="modal" :class="{ 'modal-open': showFileInfoModal }" @click="showFileInfoModal = false">
      <div class="modal-box w-11/12 max-w-md" @click.stop>
        <h3 class="font-bold text-lg">File Information</h3>
        <div v-if="selectedFile" class="py-4">
          <div class="flex items-center gap-4 mb-4">
            <Icon
                :name="selectedFile.isFolder ? 'vscode-icons:default-folder' : getIconForExtension(selectedFile.name)"
                class="w-8 h-8"
                fill="currentColor"
                viewBox="0 0 20 20"
            />
            <h4 class="text-base font-semibold truncate">{{ selectedFile.name }}</h4>
          </div>
          <div class="space-y-2">
            <p><span class="font-medium">Type:</span> {{ selectedFile.isFolder ? 'Folder' : 'File' }}</p>
            <p v-if="!selectedFile.isFolder">
              <span class="font-medium">Size:</span> {{ (selectedFile.size / 1024 / 1024).toFixed(2) }} MB
            </p>
            <p>
              <span class="font-medium">Last Modified:</span> {{ new Date(selectedFile.lastModified).toLocaleString() }}
            </p>
            <p v-if="selectedFile.meta.tags.length">
              <span class="font-medium">Tags:</span>
              <span v-for="tag in selectedFile.meta.tags"
                    :key="tag.name"
                    class="badge badge-sm text-white inline-block ml-2"
                    :style="{ backgroundColor: tag.color }"> {{ tag.name }} </span>
            </p>
            <p v-if="isVideoFile(selectedFile.name) && !selectedFile.isFolder">
              <span class="font-medium">Preview:</span>
              <video
                  id="previewVideo"
                  :key="selectedFile.name"
                  controls
                  class="mt-2 w-full h-40 object-contain rounded-lg"
                  style="aspect-ratio: 16 / 9;"
              >
                <source :src="getStaticUrl(selectedFile)" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </p>
            <p v-else-if="hasThumbnail(selectedFile.name) && !selectedFile.isFolder">
              <span class="font-medium">Preview:</span>
              <img :src="getThumbnailUrl(selectedFile.name)" class="mt-2 w-full h-40 object-cover rounded-lg" alt="File preview" style="aspect-ratio: 16 / 9;" />
            </p>
          </div>
        </div>
        <div class="modal-action">
          <label class="btn btn-sm btn-error" @click="deleteFile(selectedFile)">Delete</label>
          <label class="btn btn-sm" @click="downloadFile(selectedFile)">Download</label>
          <label class="btn btn-sm" @click="copyFileLinkStatic(selectedFile)">Copy Link</label>
          <label class="btn btn-sm" @click="closeFileModal">Close</label>
        </div>
      </div>
    </div>

    <!-- Image Viewer Modal -->
    <div class="modal image-viewer-modal" :class="{ 'modal-open': showImageViewerModal }" @click="closeImageViewer">
      <div class="modal-box-image" @click.stop>
        <img :src="selectedImageUrl" alt="Full size image" class="max-h-full max-w-full">
      </div>
      <label class="btn btn-sm btn-circle absolute right-2 top-2" @click="closeImageViewer">✕</label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getIconForExtension } from '~/core/fileIcons'
import type { File } from '~/types/File'

const files = ref<File[]>([])
const selectedFile = ref<File | null>(null)
const showFileInfoModal = ref(false)
const showImageViewerModal = ref(false)
const selectedImageUrl = ref('')
const selectedFilesForUpload = ref<FileList | null>(null)
const isUploading = ref(false)
const uploadError = ref('')
const uploadSuccess = ref(false)
const uploadProgress = ref(0)

const sortOption = ref<'name' | 'size' | 'date'>('name')
const selectedFiles = ref<Set<string>>(new Set())
const editingName = ref<string | null>(null)
const newName = ref('')

const sortedFiles = computed(() => {
  return [...files.value].sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
    if (sortOption.value === 'size') return b.size - a.size
    if (sortOption.value === 'date') return b.lastModified - a.lastModified
    return a.name.localeCompare(b.name)
  })
})

const toggleSelection = (fileName: string) => {
  if (selectedFiles.value.has(fileName)) {
    selectedFiles.value.delete(fileName)
  } else {
    selectedFiles.value.add(fileName)
  }
}

const startRename = (file: File) => {
  editingName.value = file.name
  newName.value = file.name
}

const downloadFolder = () => {
  const route = useRoute()
  const pathParam = route.params.path
  const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
  window.location.href = `/api/zip?path=${encodeURIComponent(folderPath)}`
}

const bulkDelete = async () => {
  if (selectedFiles.value.size === 0) return
  if (!confirm(`Are you sure you want to delete ${selectedFiles.value.size} file(s)?`)) return

  for (const name of selectedFiles.value) {
    const file = files.value.find(f => f.name === name)
    if (file) {
      const route = useRoute()
      const pathParam = route.params.path
      const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
      const filePath = folderPath ? `${folderPath}/${file.name}` : file.name

      await fetch('/api/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath }),
      })
    }
  }
  selectedFiles.value.clear()
  await fetchFiles()
}

const bulkDownload = () => {
  const route = useRoute()
  const pathParam = route.params.path
  const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
  const filesQuery = Array.from(selectedFiles.value).join(',')
  window.location.href = `/api/bulk-download?files=${encodeURIComponent(filesQuery)}&path=${encodeURIComponent(folderPath)}`
}

const isGridViewCookie = useCookie<boolean>('isGridView', { default: () => false })
const isGridView = ref(isGridViewCookie.value)
watch(isGridView, (newVal) => {
  isGridViewCookie.value = newVal
})

onMounted(async () => {
  await fetchFiles()
})

watch(() => useRoute().params.path, async () => {
  await fetchFiles()
})

const fetchFiles = async () => {
  const route = useRoute()
  const pathParam = route.params.path
  const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''

  try {
    const response = await fetch(`/api/files?path=${encodeURIComponent(folderPath)}`)
    if (!response.ok) {
      throw new Error('Failed to fetch files')
    }
    files.value = await response.json()
  } catch (error) {
    console.error('Error fetching files:', error)
  }
}

const handleFileSelect = (event: Event) => {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    selectedFilesForUpload.value = input.files
  } else {
    uploadError.value = 'No file selected'
  }
}

const deleteFile = async (file: File) => {
  if (!file) return;
  if (!confirm(`Are you sure you want to delete "${file.name}"?`)) {
    return
  }

  try {
    const route = useRoute()
    const pathParam = route.params.path
    const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
    const filePath = folderPath ? `${folderPath}/${file.name}` : file.name

    const response = await fetch('/api/files', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: filePath }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to delete file')
    }

    // Refresh file list
    await fetchFiles()
    if (showFileInfoModal.value) {
      showFileInfoModal.value = false;
    }
    // Maybe show a notification
  } catch (error) {
    console.error('Error deleting file:', error)
    alert(error.message) // Or use a notification
  }
}

const uploadFile = async () => {
  if (!selectedFilesForUpload.value) {
    uploadError.value = 'No file selected'
    return
  }

  isUploading.value = true
  uploadError.value = ''
  uploadSuccess.value = false
  uploadProgress.value = 0

  const formData = new FormData()
  for (let i = 0; i < selectedFilesForUpload.value.length; i++) {
    formData.append('files', selectedFilesForUpload.value[i])
  }
  const route = useRoute()
  const pathParam = route.params.path
  const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
  formData.append('path', folderPath)

  try {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/upload', true)

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100)
        uploadProgress.value = percentComplete
      }
    }

    // Handle completion
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        uploadSuccess.value = true
        selectedFilesForUpload.value = null
        await fetchFiles() // Refresh file list
      } else {
        let errorMessage = 'Failed to upload file'
        try {
          const response = JSON.parse(xhr.responseText)
          errorMessage = response.statusMessage || response.message || errorMessage
        } catch (e) {
          errorMessage = xhr.responseText || errorMessage
        }
        uploadError.value = errorMessage
      }
      isUploading.value = false
      uploadProgress.value = 0
    }

    // Handle errors
    xhr.onerror = () => {
      uploadError.value = 'Upload failed due to a network error'
      isUploading.value = false
      uploadProgress.value = 0
    }

    xhr.send(formData)
  } catch (error) {
    uploadError.value = error.message || 'Upload failed'
    console.error('Upload error:', error)
    isUploading.value = false
    uploadProgress.value = 0
  }
}

const handleDrop = (event: DragEvent) => {
  if (event.dataTransfer?.files) {
    selectedFilesForUpload.value = event.dataTransfer.files
    uploadFile()
  }
}

const hasThumbnail = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'mp4', 'webm'].includes(ext)
}

const isVideoFile = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['mp4', 'webm'].includes(ext)
}

const isImageFile = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)
}

const getThumbnailUrl = (filename: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  const subpath = useRoute().params.path
  const joinedPath = Array.isArray(subpath) ? subpath.map(encodeURIComponent).join('/') : encodeURIComponent(subpath)
  return `${baseUrl}/thumbnail/${joinedPath}/${encodeURIComponent(filename)}`
}

const onFileClick = (event: Event, file: File) => {
  const target = event.target as HTMLElement
  const isThumbnail = target.dataset.isThumbnail === 'true'

  if (file.isFolder) {
    const route = useRoute()
    const pathParam = route.params.path
    const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
    const newPath = folderPath ? `${folderPath}/${encodeURIComponent(file.name)}` : encodeURIComponent(file.name)
    navigateTo(`/files/${newPath}`)
  } else if (isImageFile(file.name) && isThumbnail) {
    selectedImageUrl.value = getStaticUrl(file)
    showImageViewerModal.value = true
  } else {
    selectedFile.value = file
    showFileInfoModal.value = true
  }
}

const getStaticUrl = (file: File) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  const subpath = useRoute().params.path
  const joinedPath = Array.isArray(subpath) ? subpath.map(encodeURIComponent).join('/') : encodeURIComponent(subpath)
  const isVideo = isVideoFile(file.name)
  const endpoint = isVideo ? '/stream' : '/file'
  if(!joinedPath)
    return `${baseUrl}${endpoint}/${encodeURIComponent(file.name)}`
  else
    return `${baseUrl}${endpoint}/${joinedPath}/${encodeURIComponent(file.name)}`
}

const copyFileLinkStatic = async (file: File) => {
  try {
    await navigator.clipboard.writeText(getStaticUrl(file));
    // No notification as per user's request
  } catch (err) {
    console.error('Failed to copy: ', err);
    // No notification as per user's request
  }
}

const downloadFile = (file: File) => {
  window.location.href = getStaticUrl(file)
}

const closeFileModal = () => {
  const videoEl = document.getElementById('previewVideo') as HTMLVideoElement
  if (videoEl) {
    videoEl.pause()
    videoEl.currentTime = 0
  }
  selectedFile.value = null
  showFileInfoModal.value = false
}

const closeImageViewer = () => {
  showImageViewerModal.value = false
  selectedImageUrl.value = ''
}
</script>

<style scoped>
.btn, .card-actions button {
  touch-action: manipulation;
}

.card-body {
  padding: 1rem;
}

.card-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-box {
  max-height: 80vh;
  overflow-y: auto;
}

img, video {
  max-width: 100%;
  max-height: 100%;
}

.progress {
  height: 1rem;
}

.image-viewer-modal {
  background-color: rgba(0, 0, 0, 0.9);
  display: flex !important;
  align-items: center;
  justify-content: center;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  cursor: pointer;
}

.modal-box-image {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  cursor: default;
}

.modal-box-image img {
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
}
</style>