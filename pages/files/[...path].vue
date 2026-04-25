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
        <div class="ml-4 relative hidden md:block">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search files..."
            class="input input-sm input-bordered pl-8"
          />
          <Icon name="mdi:magnify" class="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-base-content/50" />
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 lg:gap-4">
        <div class="md:hidden w-full order-last mt-2 relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search files..."
            class="input input-sm input-bordered w-full pl-8"
          />
          <Icon name="mdi:magnify" class="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-base-content/50" />
        </div>
        <select v-model="sortOption" class="select select-sm select-bordered">
          <option value="name">Name</option>
          <option value="size">Size</option>
          <option value="date">Date</option>
        </select>
        <button class="btn btn-sm" @click="promptCreateFolder">
          New Folder
        </button>
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

    <!-- Bulk actions -->
    <div v-if="selectedFiles.size > 0" class="sticky top-0 z-50 flex flex-wrap gap-2 mb-4 p-2 bg-base-100 shadow items-center -mx-4 lg:-mx-6 px-4 lg:px-6">
      <button class="btn btn-sm" @click="toggleSelectAll">
        {{ selectedFiles.size === sortedFiles.length ? 'Deselect All' : 'Select All' }}
      </button>
      <button class="btn btn-sm" @click="bulkDownload">Download Selected</button>
      <button class="btn btn-sm btn-secondary" @click="openBulkTagModal">Add Tags</button>
      <button class="btn btn-sm btn-error" @click="bulkDelete">Delete Selected</button>
      <span class="text-sm self-center ml-auto">{{ selectedFiles.size }} selected</span>
    </div>

    <div 
      @dragover.prevent 
      @drop.prevent="handleDrop"
      :class="isGridView ? 'grid gap-4 justify-center grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'flex flex-col gap-2'"
    >
      <div v-for="file in sortedFiles" :key="file.name" :class="isGridView ? 'card bg-base-100 shadow-md relative' : 'card bg-base-100 shadow-md'">
        
        <!-- Grid View -->
        <div v-if="isGridView" class="card-body p-4 flex flex-col gap-4 cursor-pointer" @click="onFileClick($event, file)" @contextmenu.prevent="handleContextMenu($event, file)">
          <div class="w-full h-[135px] bg-base-200 rounded-lg flex items-center justify-center overflow-hidden relative" data-is-thumbnail="true">
            <div v-if="file.meta.isPublic" class="absolute top-2 right-2 z-10 bg-success text-success-content w-7 h-7 flex items-center justify-center rounded-full shadow-sm" title="Shared">
              <Icon name="mdi:share-variant" class="w-4 h-4" />
            </div>
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
        <div v-else class="card-body flex flex-row items-center gap-4 p-4 cursor-pointer" @click="onFileClick($event, file)" @contextmenu.prevent="handleContextMenu($event, file)">
          <input type="checkbox" class="checkbox" :checked="selectedFiles.has(file.name)" @change="toggleSelection(file.name)" @click.stop />
          <div class="text-3xl">
            <Icon class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" :name="file.isFolder ? 'vscode-icons:default-folder' : getIconForExtension(file.name)" />
          </div>
          <div class="flex-grow flex items-center justify-between min-w-0">
            <div class="flex-grow min-w-0 mr-2">
              <input v-if="editingName === file.name" v-model="newName" class="input input-sm w-full" @keyup.enter="saveRename(file.name)" @blur="saveRename(file.name)" @click.stop />
              <h3 v-else class="card-title text-sm lg:text-base truncate">{{ file.name }}</h3>
            </div>
            <div class="flex items-center gap-2 text-xs lg:text-sm text-base-content/70 flex-shrink-0">
              <Icon v-if="file.meta.isPublic" name="mdi:share-variant" class="w-4 h-4 text-success mr-1" title="Shared" />
              <span v-if="!file.isFolder" class="hidden sm:inline">{{ (file.size / 1024 / 1024).toFixed(2) }} MB</span>
              <span>{{ new Date(file.lastModified).toLocaleDateString() }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Context Menu -->
    <div v-if="showContextMenu" 
         class="fixed bg-base-100 shadow-xl rounded-box border border-base-300 z-[10000] py-1 min-w-[160px]"
         :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }"
         @click.stop>
      <ul class="menu menu-compact p-0">
        <li><a @click="handleContextAction('open')"><Icon name="mdi:open-in-new" class="w-4 h-4" /> Open</a></li>
        <li v-if="contextMenuFile && isVideoFile(contextMenuFile.name)"><a @click="handleContextAction('media')"><Icon name="material-symbols:video-library-rounded" class="w-4 h-4" /> Show in Media Tab</a></li>
        <li><a @click="handleContextAction('rename')"><Icon name="mdi:pencil" class="w-4 h-4" /> Rename</a></li>
        <li><a @click="handleContextAction('description')"><Icon name="mdi:text-box-edit-outline" class="w-4 h-4" /> Edit Description</a></li>
        <li><a @click="handleContextAction('info')"><Icon name="mdi:information" class="w-4 h-4" /> Information</a></li>
        <li><a @click="handleContextAction('download')"><Icon name="mdi:download" class="w-4 h-4" /> Download</a></li>
        <div class="divider my-0"></div>
        <li><a @click="handleContextAction('delete')" class="text-error"><Icon name="mdi:delete" class="w-4 h-4" /> Delete</a></li>
      </ul>
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
            <div class="divider"></div>
            <div>
              <span class="font-medium block mb-2">Description</span>
              <div v-if="isEditingDescription" class="space-y-2">
                <textarea
                    v-model="editableDescription"
                    class="textarea textarea-bordered w-full h-24"
                    placeholder="Enter description..."
                ></textarea>
                <div class="flex justify-end gap-2">
                  <button class="btn btn-ghost btn-xs" @click="isEditingDescription = false">Cancel</button>
                  <button class="btn btn-primary btn-xs" @click="saveDescription">Save</button>
                </div>
              </div>
              <div v-else>
                <div v-if="selectedFile.meta.description" class="bg-base-300 p-3 rounded-lg text-sm whitespace-pre-line group relative min-h-[3rem]">
                  {{ selectedFile.meta.description }}
                  <button 
                    class="btn btn-circle btn-ghost btn-xs absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    @click="startEditDescription"
                  >
                    <Icon name="mdi:pencil" class="w-3 h-3" />
                  </button>
                </div>
                <button v-else class="btn btn-ghost btn-xs w-full justify-start italic text-base-content/50" @click="startEditDescription">
                  <Icon name="mdi:plus" class="w-3 h-3 mr-1" /> Add description...
                </button>
              </div>
            </div>
            <div class="divider"></div>
            <div class="form-control">
              <label class="label cursor-pointer justify-start gap-4">
                <span class="font-medium">Public Access</span>
                <input type="checkbox" class="toggle toggle-success toggle-sm" :checked="selectedFile.meta.isPublic" @change="togglePublicAccess" />
              </label>
            </div>
            <div v-if="selectedFile.meta.isPublic" class="mt-2">
              <button class="btn btn-sm btn-outline btn-success w-full" @click="copyPublicLink">
                <Icon name="mdi:share-variant" class="w-4 h-4 mr-1" />
                Copy Public Link
              </button>
            </div>
            <div class="divider"></div>
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
        <div class="modal-action flex-wrap justify-center">
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
    <!-- Tag Modal -->
    <div v-if="showTagModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Add Tags to Selected Files</h3>

        <div v-if="showNewTagForm">
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
            <button class="btn btn-primary" @click="bulkAddTags">Add Tag</button>
            <button class="btn btn-ghost" @click="showNewTagForm = false">Select Predefined Tags</button>
            <button class="btn btn-ghost" @click="closeTagModal">Cancel</button>
          </div>
        </div>

        <div v-else>
          <div class="form-control mt-4">
            <label class="label">
              <span class="label-text">Select Tags</span>
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
              <div
                  v-for="tag in predefinedTags"
                  :key="tag.name"
                  class="p-2 rounded-lg cursor-pointer text-center"
                  :style="{ backgroundColor: tag.color, border: isTagSelected(tag) ? '2px solid #D1D5DB' : '2px solid ' + tag.color }"
                  @click="toggleTagSelection(tag)"
              >
                {{ tag.name }}
              </div>
            </div>
          </div>
          <div class="modal-action">
            <button class="btn btn-primary" @click="bulkAddTags">Add Tags</button>
            <button class="btn btn-ghost" @click="showNewTagForm = true">Create New Tag</button>
            <button class="btn btn-ghost" @click="closeTagModal">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { getIconForExtension } from '~/core/fileIcons'
import type { File, Tag } from '~/types/File'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'
import { copyToClipboard } from '~/core/clipboard'

const files = ref<File[]>([])
const selectedFile = ref<File | null>(null)
const showFileInfoModal = ref(false)
const showImageViewerModal = ref(false)
const showTagModal = ref(false)
const selectedTags = ref<Tag[]>([])
const predefinedTags = ref<Tag[]>([])
const showNewTagForm = ref(true)
const newTagName = ref('')
const newTagColor = ref('#4B5EAA')
const selectedImageUrl = ref('')
const selectedFilesForUpload = ref<FileList | null>(null)
const isUploading = ref(false)
const uploadError = ref('')
const uploadSuccess = ref(false)
const uploadProgress = ref(0)

const isEditingDescription = ref(false)
const editableDescription = ref('')
const searchQuery = ref('')

const startEditDescription = () => {
  editableDescription.value = (selectedFile.value?.meta.description || '') as string
  isEditingDescription.value = true
}

const saveDescription = async () => {
  if (!selectedFile.value) return

  try {
    const route = useRoute()
    const pathParam = route.params.path
    const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
    const filePath = folderPath ? `${folderPath}/${selectedFile.value.name}` : selectedFile.value.name

    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullPath: filePath,
        description: editableDescription.value,
      }),
    })

    if (!response.ok) throw new Error('Failed to update description')

    selectedFile.value.meta.description = editableDescription.value
    isEditingDescription.value = false
    createNotification('Description updated', NotificationType.SUCCESS)
  } catch (err) {
    console.error(err)
    createNotification('Failed to update description', NotificationType.ERROR)
  }
}

const sortOption = ref<'name' | 'size' | 'date'>('name')
const selectedFiles = ref<Set<string>>(new Set())
const editingName = ref<string | null>(null)
const newName = ref('')

const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuFile = ref<File | null>(null)

const promptCreateFolder = async () => {
  const name = prompt('Enter folder name:')
  if (!name) return

  try {
    const route = useRoute()
    const pathParam = route.params.path
    const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''

    const response = await fetch('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, path: folderPath }),
    })
    if (!response.ok) throw new Error('Failed to create folder')
    await fetchFiles()
    createNotification('Folder created successfully', NotificationType.SUCCESS)
  } catch (err) {
    console.error(err)
    createNotification('Failed to create folder', NotificationType.ERROR)
  }
}

const sortedFiles = computed(() => {
  let filtered = [...files.value]
  
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    filtered = filtered.filter(file => {
      const nameMatch = file.name.toLowerCase().includes(query)
      const tagMatch = file.meta.tags.some(tag => tag.name.toLowerCase().includes(query))
      return nameMatch || tagMatch
    })
  }

  return filtered.sort((a, b) => {
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
  const count = selectedFiles.value.size
  if (!confirm(`Are you sure you want to delete ${count} file(s)?`)) return

  try {
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
    createNotification(`${count} file(s) deleted successfully`, NotificationType.SUCCESS)
  } catch (err) {
    console.error('Error in bulk delete:', err)
    createNotification('Failed to delete some files', NotificationType.ERROR)
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


const openBulkTagModal = () => {
  selectedTags.value = []
  showNewTagForm.value = true
  newTagName.value = ''
  newTagColor.value = '#4B5EAA'
  showTagModal.value = true
}

const closeTagModal = () => {
  showTagModal.value = false
}

const toggleTagSelection = (tag: Tag) => {
  const index = selectedTags.value.findIndex(t => t.name === tag.name)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
  } else {
    selectedTags.value.push(tag)
  }
}

const isTagSelected = (tag: Tag) => {
  return selectedTags.value.some(t => t.name === tag.name)
}

const fetchPredefinedTags = async () => {
  try {
    const response = await fetch('/api/tags', { credentials: 'include' })
    if (!response.ok) throw new Error(`Failed to fetch tags: ${response.statusText}`)
    predefinedTags.value = await response.json()
  } catch (err) {
    console.error('Error fetching tags:', err)
  }
}

const bulkAddTags = async () => {
  let tagsToAdd: Tag[] = []
  if (showNewTagForm.value) {
    if (!newTagName.value.trim()) {
      createNotification('Tag name is required', NotificationType.WARNING)
      return
    }
    tagsToAdd.push({ name: newTagName.value, color: newTagColor.value })
  } else {
    tagsToAdd = selectedTags.value
  }

  if (tagsToAdd.length === 0) {
    createNotification('Please select or create at least one tag', NotificationType.WARNING)
    return
  }

  try {
    const route = useRoute()
    const pathParam = route.params.path
    const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''

    for (const name of selectedFiles.value) {
      const file = files.value.find(f => f.name === name)
      const currentTags = file?.meta.tags || []
      const updatedTags = [...currentTags, ...tagsToAdd]
      const filePath = folderPath ? `${folderPath}/${name}` : name
      
      const response = await fetch('/api/file-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullPath: filePath,
          tags: updatedTags,
        }),
      })
      if (!response.ok) throw new Error(`Failed to add tags for ${name}`)
    }

    createNotification('Tags added successfully', NotificationType.SUCCESS)
    await fetchFiles()
    closeTagModal()
  } catch (err) {
    console.error('Error adding tags:', err)
    createNotification('Failed to add tags', NotificationType.ERROR)
  }
}

const toggleSelectAll = () => {
  if (selectedFiles.value.size === sortedFiles.value.length) {
    selectedFiles.value.clear()
  } else {
    for (const file of sortedFiles.value) {
      selectedFiles.value.add(file.name)
    }
  }
}

const saveRename = async (oldName: string) => {
  if (!newName.value || newName.value === oldName) {
    editingName.value = null
    return
  }

  try {
    const route = useRoute()
    const pathParam = route.params.path
    const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
    const oldPath = folderPath ? `${folderPath}/${oldName}` : oldName

    const response = await fetch('/api/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newName: newName.value }),
    })

    if (!response.ok) throw new Error('Failed to rename')
    
    createNotification('Renamed successfully', NotificationType.SUCCESS)
    await fetchFiles()
  } catch (err) {
    console.error(err)
    createNotification('Failed to rename', NotificationType.ERROR)
  } finally {
    editingName.value = null
  }
}

const handleContextMenu = (event: MouseEvent, file: File) => {
  contextMenuX.value = event.clientX
  contextMenuY.value = event.clientY
  contextMenuFile.value = file
  showContextMenu.value = true
}

const handleContextAction = (action: string) => {
  const file = contextMenuFile.value
  if (!file) return

  showContextMenu.value = false

  switch (action) {
    case 'open':
      onFileClick(new MouseEvent('click'), file)
      break
    case 'media':
      const route = useRoute()
      const pathParam = route.params.path
      const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
      const fullPath = folderPath ? `${folderPath}/${file.name}` : file.name
      const segments = fullPath.split('/')
      const encodedPath = segments.map(segment => encodeURIComponent(segment)).join('/')
      navigateTo(`/media/${encodedPath}`)
      break
    case 'rename':
      startRename(file)
      break
    case 'description':
      selectedFile.value = file
      showFileInfoModal.value = true
      // Need a small delay or use nextTick to ensure modal is open before starting edit
      setTimeout(startEditDescription, 100)
      break
    case 'info':
      selectedFile.value = file
      showFileInfoModal.value = true
      break
    case 'download':
      downloadFile(file)
      break
    case 'delete':
      deleteFile(file)
      break
  }
}

onMounted(async () => {
  await fetchFiles()
  await fetchPredefinedTags()
  
  window.addEventListener('click', () => {
    showContextMenu.value = false
  })
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
    createNotification('File deleted successfully', NotificationType.SUCCESS)
  } catch (error: any) {
    console.error('Error deleting file:', error)
    createNotification(error.message || 'Failed to delete file', NotificationType.ERROR)
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
        createNotification('Files uploaded successfully', NotificationType.SUCCESS)
      } else {
        let errorMessage = 'Failed to upload file'
        try {
          const response = JSON.parse(xhr.responseText)
          errorMessage = response.statusMessage || response.message || errorMessage
        } catch (e) {
          errorMessage = xhr.responseText || errorMessage
        }
        uploadError.value = errorMessage
        createNotification(errorMessage, NotificationType.ERROR)
      }
      isUploading.value = false
      uploadProgress.value = 0
    }

    // Handle errors
    xhr.onerror = () => {
      uploadError.value = 'Upload failed due to a network error'
      createNotification(uploadError.value, NotificationType.ERROR)
      isUploading.value = false
      uploadProgress.value = 0
    }

    xhr.send(formData)
  } catch (error: any) {
    uploadError.value = error.message || 'Upload failed'
    console.error('Upload error:', error)
    createNotification(uploadError.value, NotificationType.ERROR)
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
    isEditingDescription.value = false
    editableDescription.value = ''
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
  const success = await copyToClipboard(getStaticUrl(file));
  if (!success) {
    console.error('Failed to copy link');
  }
}

const downloadFile = (file: File) => {
  if (file.isFolder) {
    const route = useRoute()
    const pathParam = route.params.path
    const parentFolderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
    const folderPath = parentFolderPath ? `${parentFolderPath}/${file.name}` : file.name
    window.location.href = `/api/zip?path=${encodeURIComponent(folderPath)}`
  } else {
    window.location.href = getStaticUrl(file)
  }
}

const closeFileModal = () => {
  const videoEl = document.getElementById('previewVideo') as HTMLVideoElement
  if (videoEl) {
    videoEl.pause()
    videoEl.currentTime = 0
  }
  selectedFile.value = null
  showFileInfoModal.value = false
  isEditingDescription.value = false
}

const closeImageViewer = () => {
  showImageViewerModal.value = false
  selectedImageUrl.value = ''
}

const togglePublicAccess = async (event: Event) => {
  if (!selectedFile.value) return
  const isPublic = (event.target as HTMLInputElement).checked
  
  try {
    const route = useRoute()
    const pathParam = route.params.path
    const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
    const filePath = folderPath ? `${folderPath}/${selectedFile.value.name}` : selectedFile.value.name

    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullPath: filePath, isPublic }),
    })
    
    if (!response.ok) throw new Error('Failed to update visibility')
    
    selectedFile.value.meta.isPublic = isPublic
    // Update the file in the list as well
    const fileInList = files.value.find(f => f.name === selectedFile.value?.name)
    if (fileInList) fileInList.meta.isPublic = isPublic
    
    createNotification(`Public access ${isPublic ? 'enabled' : 'disabled'}`, NotificationType.INFO)
    
  } catch (err) {
    console.error(err)
    createNotification('Failed to update public access', NotificationType.ERROR)
    // Reset toggle state
    ;(event.target as HTMLInputElement).checked = !isPublic
  }
}

const copyPublicLink = async () => {
  if (!selectedFile.value) return
  
  const user = useState<any>('user')
  const username = user.value?.name
  if (!username) return

  const route = useRoute()
  const pathParam = route.params.path
  const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
  const filePath = folderPath ? `${folderPath}/${selectedFile.value.name}` : selectedFile.value.name
  
  const url = useRequestURL()
  const publicUrl = `${url.origin}/p/${username}/${encodeURIComponent(filePath)}`
  
  const success = await copyToClipboard(publicUrl)
  if (success) {
    createNotification('Public link copied to clipboard!', NotificationType.SUCCESS)
  } else {
    createNotification('Failed to copy link', NotificationType.ERROR)
  }
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

.menu-compact li a {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
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