<template>
  <div>
    <!-- Header and breadcrumb sections -->
    <div class="flex justify-between items-center mb-4 lg:mb-6">
      <div class="flex items-center gap-2">
        <label for="sidebar-drawer" class="btn btn-ghost btn-circle lg:hidden">
          <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
          </svg>
        </label>
        <h2 class="text-lg lg:text-xl font-semibold">My Files</h2>
      </div>
      <div class="flex items-center gap-4">
        <label class="flex items-center gap-2">
          <span class="text-sm">List</span>
          <input type="checkbox" class="toggle toggle-primary" v-model="isGridView"/>
          <span class="text-sm">Grid</span>
        </label>
        <label for="upload-modal" class="btn btn-primary btn-sm lg:btn-md">
          <svg class="w-4 h-4 lg:w-5 lg:h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
          </svg>
          Upload
        </label>
      </div>
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

    <!-- File grid/list -->
    <div :class="isGridView ? 'grid gap-4 justify-center' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4'" :style="isGridView ? 'grid-template-columns: repeat(auto-fit, minmax(240px, 240px));' : ''">
      <div v-for="file in files" :key="file.name" :class="isGridView ? 'card bg-base-100 shadow-md w-[240px]' : 'card bg-base-100 shadow-md'">
        <div v-if="isGridView" class="card-body p-4 flex flex-col gap-4 cursor-pointer" @click="onFileClick(file)">
          <div class="w-full h-[135px] bg-base-200 rounded-lg flex items-center justify-center overflow-hidden">
            <template v-if="file.isFolder">
              <button class="text-blue-600 hover:underline flex flex-col items-center">
                <Icon name="vscode-icons:default-folder" class="w-12 h-12" />
              </button>
            </template>
            <template v-else>
              <img v-if="hasThumbnail(file.name)" :src="getThumbnailUrl(file.name)" class="w-full h-full object-cover rounded-lg" alt="Thumbnail" style="aspect-ratio: 16 / 9;" />
              <Icon v-else class="w-12 h-12" fill="currentColor" viewBox="0 0 20 20" v-bind:name="getIconForExtension(file.name)" />
            </template>
          </div>
          <div class="flex-1">
            <h3 class="card-title text-sm lg:text-base truncate">{{ file.name }}</h3>
            <p class="text-xs lg:text-sm text-base-content/70">{{ (file.size / 1024 / 1024).toFixed(2) }} MB • {{ new Date(file.lastModified).toLocaleDateString() }}</p>
          </div>
          <div class="card-actions justify-end">
            <button class="btn btn-ghost btn-xs lg:btn-sm">
              <svg class="w-3 h-3 lg:w-4 lg:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793A3.987 3.987 0 0114 8.414V7.414l.793-.793zM3 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-3.586l1.586-1.586A2 2 0 0015 3H3zm10 10H5V5h8v8z" />
              </svg>
            </button>
            <button class="btn btn-ghost btn-xs lg:btn-sm">
              <svg class="w-3 h-3 lg:w-4 lg:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        <div v-else class="card-body flex flex-row items-center gap-4 p-4 cursor-pointer" @click="onFileClick(file)">
          <div class="text-3xl">
            <Icon
                class="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 20 20"
                :name="file.isFolder ? 'vscode-icons:default-folder' : getIconForExtension(file.name)"
            />
          </div>
          <div class="flex-1">
            <h3 class="card-title text-sm lg:text-base truncate">{{ file.name.length > 20 ? file.name.slice(0, 17) + '…' : file.name }}</h3>
            <p class="text-xs lg:text-sm text-base-content/70">
              {{ !file.isFolder ? (file.size / 1024 / 1024).toFixed(2) + ' MB • ' : '' }}{{ new Date(file.lastModified).toLocaleDateString() }}
            </p>
          </div>
          <div class="card-actions justify-end">
            <button class="btn btn-ghost btn-xs lg:btn-sm">
              <svg class="w-3 h-3 lg:w-4 lg:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793A3.987 3.987 0 0114 8.414V7.414l.793-.793zM3 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-3.586l1.586-1.586A2 2 0 0015 3H3zm10 10H5V5h8v8z" />
              </svg>
            </button>
            <button class="btn btn-ghost btn-xs lg:btn-sm">
              <svg class="w-3 h-3 lg:w-4 lg:h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
              </svg>
            </button>
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
          <input type="file" @change="handleFileSelect" class="file-input file-input-bordered w-full" />
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
    <input type="checkbox" id="file-info-modal" class="modal-toggle" v-model="showFileInfoModal" />
    <div class="modal">
      <div class="modal-box w-11/12 max-w-md">
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
              <video controls class="mt-2 w-full h-40 object-contain rounded-lg" style="aspect-ratio: 16 / 9;">
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
          <label class="btn btn-sm" @click="downloadFile(selectedFile)">Download</label>
          <label class="btn btn-sm" @click="copyFileLinkStatic(selectedFile)">Copy Link</label>
          <label for="file-info-modal" class="btn btn-sm">Close</label>
        </div>
      </div>
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
const selectedFileForUpload = ref<File | null>(null)
const isUploading = ref(false)
const uploadError = ref('')
const uploadSuccess = ref(false)
const uploadProgress = ref(0)

const isGridViewCookie = useCookie<boolean>('isGridView', { default: () => false })
const isGridView = ref(isGridViewCookie.value)
watch(isGridView, (newVal) => {
  isGridViewCookie.value = newVal
})

onMounted(async () => {
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
    selectedFileForUpload.value = input.files[0]
  } else {
    uploadError.value = 'No file selected'
  }
}

const uploadFile = async () => {
  if (!selectedFileForUpload.value) {
    uploadError.value = 'No file selected'
    return
  }

  isUploading.value = true
  uploadError.value = ''
  uploadSuccess.value = false
  uploadProgress.value = 0

  const formData = new FormData()
  formData.append('file', selectedFileForUpload.value)
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
        selectedFileForUpload.value = null
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

const hasThumbnail = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'mp4', 'webm'].includes(ext)
}

const isVideoFile = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['mp4', 'webm'].includes(ext)
}

const getThumbnailUrl = (filename: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  const subpath = useRoute().params.path
  const joinedPath = Array.isArray(subpath) ? subpath.map(encodeURIComponent).join('/') : encodeURIComponent(subpath)
  return `${baseUrl}/thumbnail/${joinedPath}/${encodeURIComponent(filename)}`
}

const onFileClick = (file: File) => {
  if (file.isFolder) {
    window.location.href = `${window.location.pathname.replace(/\/$/, '')}/${encodeURIComponent(file.name)}`
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

const copyFileLinkStatic = (file: File) => {
  console.log(getStaticUrl(file))
}

const downloadFile = (file: File) => {
  window.location.href = getStaticUrl(file)
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
</style>