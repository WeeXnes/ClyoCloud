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
const showCreateFolderModal = ref(false)
const newFolderName = ref('')
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

const sortOption = useCookie<'name' | 'size' | 'date'>('file-sort-option', {
  default: () => 'name',
  maxAge: 60 * 60 * 24 * 365 // 1 year
})

const showFavouritesOnly = useCookie<boolean>('file-show-favourites-only', {
  default: () => false,
  maxAge: 60 * 60 * 24 * 365 // 1 year
})

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

const selectedFiles = ref<Set<string>>(new Set())
const editingName = ref<string | null>(null)
const newName = ref('')

const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuFile = ref<File | null>(null)

const openCreateFolderModal = () => {
  newFolderName.value = ''
  showCreateFolderModal.value = true
}

const executeCreateFolder = async () => {
  if (!newFolderName.value.trim()) {
    createNotification('Folder name is required', NotificationType.WARNING)
    return
  }

  try {
    const route = useRoute()
    const pathParam = route.params.path
    const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''

    const response = await fetch('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.value, path: folderPath }),
    })
    if (!response.ok) throw new Error('Failed to create folder')
    
    await fetchFiles()
    showCreateFolderModal.value = false
    createNotification('Folder created successfully', NotificationType.SUCCESS)
  } catch (err) {
    console.error(err)
    createNotification('Failed to create folder', NotificationType.ERROR)
  }
}

const sortedFiles = computed(() => {
  let filtered = [...files.value]

  if (showFavouritesOnly.value) {
    filtered = filtered.filter(file => file.meta.isFavourite)
  }

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

const isGridViewCookie = useCookie<boolean>('isGridView', { 
  default: () => false,
  maxAge: 60 * 60 * 24 * 365 // 1 year
})
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

const removeTag = async (tagToRemove: Tag) => {
  if (!selectedFile.value) return

  try {
    const route = useRoute()
    const pathParam = route.params.path
    const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
    const filePath = folderPath ? `${folderPath}/${selectedFile.value.name}` : selectedFile.value.name

    const updatedTags = selectedFile.value.meta.tags.filter(t => t.name !== tagToRemove.name)

    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullPath: filePath,
        tags: updatedTags,
      }),
    })

    if (!response.ok) throw new Error('Failed to remove tag')

    selectedFile.value.meta.tags = updatedTags
    createNotification('Tag removed', NotificationType.SUCCESS)
    await fetchFiles()
  } catch (err) {
    console.error(err)
    createNotification('Failed to remove tag', NotificationType.ERROR)
  }
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

const taggingProgress = ref<{ current: number, total: number } | null>(null)

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

    // Determine target files: either currently selected in bulk, or the single file from modal
    const targetFileNames = selectedFiles.value.size > 0 
      ? Array.from(selectedFiles.value) 
      : (selectedFile.value ? [selectedFile.value.name] : [])

    if (targetFileNames.length === 0) {
      createNotification('No file selected', NotificationType.ERROR)
      return
    }

    taggingProgress.value = { current: 0, total: targetFileNames.length }

    for (const name of targetFileNames) {
      const file = files.value.find(f => f.name === name)
      if (!file) {
        taggingProgress.value.current++
        continue
      }
      
      const currentTags = file.meta.tags || []
      
      // Filter out duplicates (case-insensitive)
      const tagsToActuallyAdd = tagsToAdd.filter(newTag => 
        !currentTags.some(existingTag => existingTag.name.toLowerCase() === newTag.name.toLowerCase())
      )

      if (tagsToActuallyAdd.length === 0) {
        taggingProgress.value.current++
        continue
      }

      const updatedTags = [...currentTags, ...tagsToActuallyAdd]
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
      
      // Update local state if it's the currently selected file in modal
      if (selectedFile.value && name === selectedFile.value.name) {
        selectedFile.value.meta.tags = updatedTags
      }
      taggingProgress.value.current++
    }

    createNotification('Tags added successfully', NotificationType.SUCCESS)
    await fetchFiles()
    closeTagModal()
  } catch (err) {
    console.error('Error adding tags:', err)
    createNotification('Failed to add tags', NotificationType.ERROR)
  } finally {
    taggingProgress.value = null
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

const showMoveModal = ref(false)
const movingItems = ref<string[]>([])
const pickerCurrentPath = ref('')
const pickerFolders = ref<File[]>([])
const isMoving = ref(false)

const scrollIndex = ref(0)
const itemsPerRow = ref(6) // Default for XL, updated on resize

const handleMainScroll = () => {
  const scrollTop = window.scrollY
  const gridElement = document.getElementById('file-grid-container')
  if (!gridElement) return

  const offsetTop = gridElement.offsetTop
  const viewportHeight = window.innerHeight
  const relativeScroll = Math.max(0, scrollTop - offsetTop)

  if (!isGridView.value) {
    const itemHeight = 76 // 64px row + 12px gap
    scrollIndex.value = Math.floor(relativeScroll / itemHeight)
  } else {
    const containerWidth = gridElement.clientWidth
    const gaps = itemsPerRow.value - 1
    const totalGapWidth = gaps * 24 // gap-6 is 24px
    const itemWidth = (containerWidth - totalGapWidth) / itemsPerRow.value
    const itemHeight = itemWidth + 8 + 48 + 24 // item + gap-2 + metadata + gap-6
    const rowsScrolled = Math.floor(relativeScroll / itemHeight)
    scrollIndex.value = rowsScrolled * itemsPerRow.value
  }
}

const isFileVisible = (index: number) => {
  // Use a dynamic buffer based on viewport to ensure coverage
  const buffer = isGridView.value ? itemsPerRow.value * 20 : 60
  return index >= scrollIndex.value - (buffer / 2) && index <= scrollIndex.value + buffer
}

const updateItemsPerRow = () => {
  const width = window.innerWidth
  if (width >= 1280) itemsPerRow.value = 6
  else if (width >= 1024) itemsPerRow.value = 5
  else if (width >= 768) itemsPerRow.value = 4
  else if (width >= 640) itemsPerRow.value = 3
  else itemsPerRow.value = 2
}

const openMoveModal = async (file?: File) => {
  const route = useRoute()
  const pathParam = route.params.path
  const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
  
  if (file) {
    movingItems.value = [folderPath ? `${folderPath}/${file.name}` : file.name]
  } else if (selectedFiles.value.size > 0) {
    movingItems.value = Array.from(selectedFiles.value).map(name => folderPath ? `${folderPath}/${name}` : name)
  } else {
    return
  }
  
  pickerCurrentPath.value = ''
  await fetchPickerFolders('')
  showMoveModal.value = true
}

const fetchPickerFolders = async (path: string) => {
  try {
    const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`, { credentials: 'include' })
    if (!response.ok) throw new Error('Failed to fetch folders')
    const allItems: File[] = await response.json()
    // Filter out items that are currently being moved to prevent circular moving
    pickerFolders.value = allItems.filter(item => item.isFolder && !movingItems.value.includes(path ? `${path}/${item.name}` : item.name))
    pickerCurrentPath.value = path
  } catch (err) {
    console.error('Error fetching picker folders:', err)
    createNotification('Failed to load folders', NotificationType.ERROR)
  }
}

const navigatePicker = (folderName: string) => {
  const newPath = pickerCurrentPath.value ? `${pickerCurrentPath.value}/${folderName}` : folderName
  fetchPickerFolders(newPath)
}

const navigatePickerUp = () => {
  if (!pickerCurrentPath.value) return
  const parts = pickerCurrentPath.value.split('/')
  parts.pop()
  const newPath = parts.join('/')
  fetchPickerFolders(newPath)
}

const executeMove = async () => {
  isMoving.value = true
  try {
    const response = await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paths: movingItems.value,
        destination: pickerCurrentPath.value
      })
    })

    if (!response.ok) throw new Error('Failed to move items')
    
    createNotification('Items moved successfully', NotificationType.SUCCESS)
    showMoveModal.value = false
    selectedFiles.value.clear()
    await fetchFiles()
  } catch (err) {
    console.error('Error moving items:', err)
    createNotification('Failed to move items', NotificationType.ERROR)
  } finally {
    isMoving.value = false
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
    case 'move':
      openMoveModal(file)
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
    case 'favourite':
      toggleFavourite(file)
      break
    case 'delete':
      deleteFile(file)
      break
  }
}

onMounted(async () => {
  await fetchFiles()
  await fetchPredefinedTags()
  updateItemsPerRow()
  window.addEventListener('resize', updateItemsPerRow)
  window.addEventListener('scroll', handleMainScroll, { passive: true })
  
  window.addEventListener('click', () => {
    showContextMenu.value = false
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', updateItemsPerRow)
  window.removeEventListener('scroll', handleMainScroll)
})

watch(() => useRoute().params.path, async () => {
  await fetchFiles()
})

const isLoading = ref(true)

const fetchFiles = async () => {
  isLoading.value = true
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
  } finally {
    isLoading.value = false
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
  if (!selectedFilesForUpload.value || selectedFilesForUpload.value.length === 0) {
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
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    selectedFilesForUpload.value = event.dataTransfer.files
    uploadFile()
  }
}

const hasThumbnail = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['jpg', 'jpeg', 'png', 'mp4', 'webm', 'mov', 'mkv'].includes(ext)
}

const isVideoFile = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  return ['mp4', 'webm', 'mov', 'mkv'].includes(ext || '')
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
  // If we are in selection mode, toggle selection instead of opening
  if (selectedFiles.value.size > 0) {
    toggleSelection(file.name)
    return
  }

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
  await copyPublicLinkForFile(selectedFile.value)
}

const copyPublicLinkForFile = async (file: File) => {
  const user = useState<any>('user')
  const username = user.value?.name
  if (!username) return

  const route = useRoute()
  const pathParam = route.params.path
  const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
  const filePath = folderPath ? `${folderPath}/${file.name}` : file.name
  
  const url = useRequestURL()
  const publicUrl = `${url.origin}/p/${username}/${encodeURIComponent(filePath)}`
  
  const success = await copyToClipboard(publicUrl)
  if (success) {
    createNotification('Public link copied to clipboard!', NotificationType.SUCCESS)
  } else {
    createNotification('Failed to copy link', NotificationType.ERROR)
  }
}

const toggleFavourite = async (file: File) => {
  const isFavourite = !file.meta.isFavourite
  
  try {
    const route = useRoute()
    const pathParam = route.params.path
    const folderPath = Array.isArray(pathParam) ? pathParam.join('/') : ''
    const filePath = folderPath ? `${folderPath}/${file.name}` : file.name

    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullPath: filePath, isFavourite }),
    })
    
    if (!response.ok) throw new Error('Failed to update favorite status')
    
    file.meta.isFavourite = isFavourite
    createNotification(`File ${isFavourite ? 'added to' : 'removed from'} favorites`, NotificationType.INFO)
    
  } catch (err) {
    console.error(err)
    createNotification('Failed to update favorite status', NotificationType.ERROR)
  }
}
</script>

<template>
  <div class="min-h-screen bg-base-200/50">
    <!-- Edge-to-Edge Sticky Header -->
    <header class="sticky top-0 z-30 w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/5">
      <div class="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <!-- Title and Breadcrumbs -->
          <div class="flex flex-col gap-1 min-w-0">
            <div class="flex items-center gap-2">
              <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-sm lg:hidden">
                <Icon name="mdi:menu" class="w-5 h-5" />
              </label>
              <h1 class="text-xl font-black tracking-tight flex items-center gap-2">
                <Icon name="mdi:folder-multiple" class="text-primary w-6 h-6" />
                Files
              </h1>
            </div>
            
            <!-- Breadcrumbs -->
            <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-base-content/40 pl-1">
              <NuxtLink to="/files" class="hover:text-primary transition-colors">Root</NuxtLink>
              <template v-for="(folder, index) in useRoute().params.path" :key="index">
                <Icon name="mdi:chevron-right" class="w-3 h-3 opacity-50" />
                <NuxtLink
                  :to="`/files/${useRoute().params.path.slice(0, index + 1).map(encodeURIComponent).join('/')}`"
                  class="hover:text-primary transition-colors truncate max-w-[120px]"
                >
                  {{ folder }}
                </NuxtLink>
              </template>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap items-center gap-3">
             <!-- Search -->
             <div class="relative w-full sm:w-auto sm:min-w-[240px]">
                <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Icon name="mdi:magnify" class="w-4 h-4 text-base-content/30" />
                </div>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Quick search..."
                  class="input input-sm input-bordered w-full pl-9 bg-base-100/50 focus:bg-base-100 transition-all border-base-content/10 font-medium"
                />
             </div>

             <div class="flex items-center gap-2 ml-auto md:ml-0">
               <button 
                class="btn btn-sm btn-ghost border border-base-content/10 bg-base-100/50 transition-all duration-300" 
                :class="{ 'text-orange-500 bg-orange-500/10 border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.1)]': showFavouritesOnly }"
                @click="showFavouritesOnly = !showFavouritesOnly"
                title="Show Favourites Only"
               >
                 <Icon :name="showFavouritesOnly ? 'mdi:star' : 'mdi:star-outline'" class="w-4 h-4" />
                 <span class="hidden xl:inline ml-1 font-bold text-xs uppercase tracking-widest">Favorites</span>
               </button>

               <div class="dropdown dropdown-end">
                 <button tabindex="0" class="btn btn-sm btn-ghost gap-2 border border-base-content/10 bg-base-100/50">
                    <Icon name="mdi:sort-variant" class="w-4 h-4" />
                    <span class="hidden sm:inline">Sort</span>
                 </button>
                 <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow-2xl bg-base-100 rounded-box w-40 border border-base-content/5 mt-2">
                   <li><a @click="sortOption = 'name'" :class="{ 'active': sortOption === 'name' }">Name</a></li>
                   <li><a @click="sortOption = 'size'" :class="{ 'active': sortOption === 'size' }">Size</a></li>
                   <li><a @click="sortOption = 'date'" :class="{ 'active': sortOption === 'date' }">Date</a></li>
                 </ul>
               </div>

               <button class="btn btn-sm btn-ghost border border-base-content/10 bg-base-100/50" @click="openCreateFolderModal">
                 <Icon name="mdi:folder-plus" class="w-4 h-4" />
               </button>

               <div class="h-6 w-px bg-base-content/10 mx-1"></div>

               <div class="flex bg-base-200/50 p-1 rounded-lg border border-base-content/5">
                 <button 
                  class="btn btn-xs btn-ghost" 
                  :class="{ 'bg-base-100 shadow-sm text-primary': !isGridView }"
                  @click="isGridView = false"
                 >
                   <Icon name="mdi:view-list" class="w-4 h-4" />
                 </button>
                 <button 
                  class="btn btn-xs btn-ghost" 
                  :class="{ 'bg-base-100 shadow-sm text-primary': isGridView }"
                  @click="isGridView = true"
                 >
                   <Icon name="mdi:view-grid" class="w-4 h-4" />
                 </button>
               </div>

               <label class="btn btn-sm btn-primary px-5 shadow-lg shadow-primary/20" for="upload-modal">
                 Upload
               </label>
             </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Bulk Action Bar -->
    <transition name="slide-down">
      <div v-if="selectedFiles.size > 0" class="sticky top-[104px] md:top-[68px] z-30 w-full bg-primary text-primary-content shadow-xl py-3 px-4 sm:px-8">
        <div class="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <button class="btn btn-xs btn-outline btn-ghost border-white/30 text-white" @click="toggleSelectAll">
              {{ selectedFiles.size === sortedFiles.length ? 'Deselect All' : 'Select All' }}
            </button>
            <span class="text-sm font-black uppercase tracking-widest">{{ selectedFiles.size }} selected</span>
          </div>
          
          <div class="flex items-center gap-2">
            <button class="btn btn-xs sm:btn-sm bg-white/10 hover:bg-white/20 border-none text-white gap-2" @click="bulkDownload">
              <Icon name="mdi:download" class="w-4 h-4" /> Download
            </button>
            <button class="btn btn-xs sm:btn-sm bg-white/10 hover:bg-white/20 border-none text-white gap-2" @click="openBulkTagModal">
              <Icon name="mdi:tag-plus" class="w-4 h-4" /> Tags
            </button>
            <button class="btn btn-xs sm:btn-sm bg-white/10 hover:bg-white/20 border-none text-white gap-2" @click="openMoveModal()">
              <Icon name="mdi:folder-move" class="w-4 h-4" /> Move
            </button>
            <button class="btn btn-xs sm:btn-sm bg-error/20 hover:bg-error/40 border-none text-white gap-2" @click="bulkDelete">
              <Icon name="mdi:delete" class="w-4 h-4" /> Delete
            </button>
          </div>
        </div>
      </div>
    </transition>

    <main class="max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-8 min-h-[70vh]"
          @dragover.prevent 
          @drop.prevent="handleDrop">
      
      <!-- Skeleton Loading -->
      <div v-if="isLoading" :class="isGridView ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6' : 'space-y-3'">
        <div v-for="i in 12" :key="i" class="flex flex-col gap-3">
          <div :class="isGridView ? 'aspect-square rounded-2xl bg-base-300 animate-pulse' : 'h-16 rounded-xl bg-base-300 animate-pulse'"></div>
          <div v-if="isGridView" class="h-4 w-3/4 bg-base-300 animate-pulse rounded mx-auto"></div>
        </div>
      </div>

      <!-- File Grid -->
      <div 
        v-else-if="sortedFiles.length"
        id="file-grid-container"
        :class="isGridView ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6' : 'flex flex-col gap-3'"
      >
        <div 
          v-for="(file, index) in sortedFiles" 
          :key="file.name" 
          class="group relative"
        >
          <template v-if="isFileVisible(index)">
            <!-- Grid Item -->
            <div v-if="isGridView" 
                 class="flex flex-col gap-2 transition-all duration-300"
            >
              <!-- Thumbnail Container -->
              <div 
                class="relative aspect-square rounded-2xl bg-base-100 border border-base-content/5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden flex items-center justify-center group/item ring-primary/30"
                :class="{ 'ring-2': selectedFiles.has(file.name) }"
                @click="onFileClick($event, file)" 
                @contextmenu.prevent="handleContextMenu($event, file)"
              >
                <!-- Selection Checkbox (Top Left) -->
                <div class="absolute top-2 left-2 z-20 opacity-0 group-hover/item:opacity-100 transition-opacity" :class="{ 'opacity-100': selectedFiles.size > 0 }">
                  <input 
                    type="checkbox" 
                    class="checkbox checkbox-sm checkbox-primary bg-base-100/80 backdrop-blur-md" 
                    :checked="selectedFiles.has(file.name)" 
                    @change="toggleSelection(file.name)" 
                    @click.stop 
                  />
                </div>

                <!-- Shared Indicator (Top Right) -->
                <div class="absolute top-2 right-2 z-20 flex flex-col gap-1.5">
                  <div v-if="file.meta.isPublic" 
                       class="bg-success text-success-content w-7 h-7 flex items-center justify-center rounded-full shadow-lg backdrop-blur-md hover:scale-110 active:scale-95 transition-all" 
                       title="Copy Shared Link"
                       @click.stop="copyPublicLinkForFile(file)">
                    <Icon name="mdi:share-variant" class="w-4 h-4" />
                  </div>
                  <div class="bg-base-100/80 text-orange-500 w-7 h-7 flex items-center justify-center rounded-full shadow-lg backdrop-blur-md hover:scale-110 active:scale-95 transition-all" 
                       :class="{ 'opacity-0 group-hover/item:opacity-100': !file.meta.isFavourite }"
                       title="Toggle Favorite"
                       @click.stop="toggleFavourite(file)">
                    <Icon :name="file.meta.isFavourite ? 'mdi:star' : 'mdi:star-outline'" class="w-4 h-4" />
                  </div>
                </div>

                <!-- File Content -->
                <template v-if="file.isFolder">
                  <Icon name="vscode-icons:default-folder" class="w-16 h-16 group-hover/item:scale-110 transition-transform duration-500" />
                </template>
                <template v-else>
                  <img v-if="hasThumbnail(file.name)" 
                       :src="getThumbnailUrl(file.name)" 
                       class="w-full h-full object-cover transition-transform duration-700 group-hover/item:scale-110" 
                       alt="" 
                       data-is-thumbnail="true"
                       loading="lazy" />
                  <Icon v-else 
                        class="w-16 h-16 group-hover/item:scale-110 transition-transform duration-500" 
                        :name="getIconForExtension(file.name)" 
                        data-is-thumbnail="true" />
                </template>

                <!-- Hover Action Overlay -->
                <div class="absolute inset-0 bg-black/5 opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none"></div>
              </div>

              <!-- Grid Metadata -->
              <div class="px-1 text-center h-[48px] flex flex-col justify-center">
                <div class="min-w-0 px-1">
                  <input v-if="editingName === file.name" 
                         v-model="newName" 
                         class="input input-xs input-bordered w-full text-center" 
                         @keyup.enter="saveRename(file.name)" 
                         @blur="saveRename(file.name)" 
                         @click.stop />
                  <h3 v-else class="text-xs font-bold truncate block group-hover:text-primary transition-colors leading-tight">{{ file.name }}</h3>
                  <div class="text-[10px] font-bold text-base-content/40 uppercase tracking-wider mt-0.5">
                    <span v-if="!file.isFolder">{{ (file.size / 1024 / 1024).toFixed(1) }} MB</span>
                    <span v-else>Folder</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modernized List Item (Oriented on old view) -->
            <div v-else 
                 class="flex items-center gap-4 p-3 bg-base-100 rounded-xl border border-base-content/5 hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer group/row ring-primary/30 h-[64px]"
                 :class="{ 'ring-1 bg-primary/5 border-primary/20': selectedFiles.has(file.name) }"
                 @click="onFileClick($event, file)" 
                 @contextmenu.prevent="handleContextMenu($event, file)"
            >
              <!-- Checkbox -->
              <div class="flex items-center justify-center shrink-0">
                <input type="checkbox" 
                       class="checkbox checkbox-sm checkbox-primary" 
                       :checked="selectedFiles.has(file.name)" 
                       @change="toggleSelection(file.name)" 
                       @click.stop />
              </div>
              
              <!-- Icon -->
              <div class="flex items-center justify-center shrink-0 w-8 h-8">
                <Icon class="w-6 h-6" :name="file.isFolder ? 'vscode-icons:default-folder' : getIconForExtension(file.name)" />
              </div>

              <!-- Content Area -->
              <div class="flex-grow flex items-center justify-between min-w-0">
                <!-- Name & Editing -->
                <div class="flex-grow min-w-0 mr-4 flex items-center">
                  <input v-if="editingName === file.name" 
                         v-model="newName" 
                         class="input input-sm input-bordered w-full" 
                         @keyup.enter="saveRename(file.name)" 
                         @blur="saveRename(file.name)" 
                         @click.stop />
                  <h3 v-else class="text-sm font-bold truncate group-hover/row:text-primary transition-colors m-0 leading-none">{{ file.name }}</h3>
                </div>
                
                <!-- Metadata Group -->
                <div class="flex items-center gap-6 text-[11px] font-bold text-base-content/40 uppercase tracking-widest shrink-0">
                  <div class="flex items-center gap-2">
                    <div v-if="file.meta.isPublic" 
                         class="flex items-center justify-center w-6 h-6 rounded-full bg-success/10 text-success hover:bg-success hover:text-white transition-all"
                         title="Copy Shared Link"
                         @click.stop="copyPublicLinkForFile(file)">
                      <Icon name="mdi:share-variant" class="w-3.5 h-3.5" />
                    </div>
                    <div class="flex items-center justify-center w-6 h-6 rounded-full hover:bg-orange-500 hover:text-white transition-all"
                         :class="file.meta.isFavourite ? 'bg-orange-500/10 text-orange-500' : 'opacity-0 group-hover/row:opacity-100 bg-base-content/5'"
                         title="Toggle Favorite"
                         @click.stop="toggleFavourite(file)">
                      <Icon :name="file.meta.isFavourite ? 'mdi:star' : 'mdi:star-outline'" class="w-3.5 h-3.5" />
                    </div>
                  </div>
                  
                  <span v-if="!file.isFolder" class="hidden sm:inline w-20 text-right">{{ (file.size / 1024 / 1024).toFixed(2) }} MB</span>
                  <span v-else class="hidden sm:inline w-20 text-right">Folder</span>
                  
                  <span class="hidden md:inline w-24 text-right">{{ new Date(file.lastModified).toLocaleDateString() }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Placeholder to maintain height for non-rendered items -->
          <div v-else :class="isGridView ? 'flex flex-col gap-2' : 'h-[64px] bg-base-100/30 rounded-xl border border-dashed border-base-content/5'">
            <div v-if="isGridView" class="aspect-square bg-base-100/30 rounded-2xl border border-dashed border-base-content/5"></div>
            <div v-if="isGridView" class="h-[48px]"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="flex flex-col items-center justify-center py-32 text-center">
        <div class="bg-base-200/50 p-8 rounded-full mb-6">
          <Icon 
            :name="showFavouritesOnly ? 'mdi:star-outline' : 'mdi:folder-open-outline'" 
            class="w-20 h-20 text-base-content/10" 
          />
        </div>
        <template v-if="showFavouritesOnly">
          <h3 class="text-2xl font-black tracking-tight">No favorites here</h3>
          <p class="text-base-content/50 max-w-xs mt-2 font-medium">You haven't starred any items in this directory yet.</p>
          <button @click="showFavouritesOnly = false" class="btn btn-primary mt-8 px-8 rounded-full shadow-lg shadow-primary/20">
            Show all files
          </button>
        </template>
        <template v-else-if="searchQuery">
          <h3 class="text-2xl font-black tracking-tight">No results found</h3>
          <p class="text-base-content/50 max-w-xs mt-2 font-medium">We couldn't find anything matching "{{ searchQuery }}" in this folder.</p>
          <button @click="searchQuery = ''" class="btn btn-primary mt-8 px-8 rounded-full shadow-lg shadow-primary/20">
            Clear search
          </button>
        </template>
        <template v-else>
          <h3 class="text-2xl font-black tracking-tight">Empty folder</h3>
          <p class="text-base-content/50 max-w-xs mt-2 font-medium">This space is waiting for your content. Drop files here or use the upload button.</p>
          <label class="btn btn-primary mt-8 px-8 rounded-full shadow-lg shadow-primary/20" for="upload-modal">
            Upload Files
          </label>
        </template>
      </div>
    </main>

    <!-- Context Menu (Enhanced) -->
    <transition name="fade">
      <div v-if="showContextMenu" 
           class="fixed bg-base-100 shadow-2xl rounded-2xl border border-base-content/10 z-[100] py-2 min-w-[200px] backdrop-blur-xl bg-base-100/90"
           :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }"
           @click.stop>
        <ul class="menu menu-compact p-0 font-bold text-xs uppercase tracking-wider">
          <li><a class="py-3 px-4 hover:text-primary transition-colors" @click="handleContextAction('open')"><Icon name="mdi:open-in-new" class="w-4 h-4" /> Open</a></li>
          <li v-if="contextMenuFile && isVideoFile(contextMenuFile.name)">
            <a class="py-3 px-4 hover:text-primary transition-colors" @click="handleContextAction('media')">
              <Icon name="mdi:play-box-multiple-outline" class="w-4 h-4" /> Media Tab
            </a>
          </li>
          <div class="h-px bg-base-content/5 mx-2 my-1"></div>
          <li><a class="py-3 px-4" @click="handleContextAction('rename')"><Icon name="mdi:pencil" class="w-4 h-4 text-blue-500" /> Rename</a></li>
          <li><a class="py-3 px-4" @click="handleContextAction('move')"><Icon name="mdi:folder-move" class="w-4 h-4 text-primary" /> Move</a></li>
          <li><a class="py-3 px-4" @click="handleContextAction('description')"><Icon name="mdi:text-box-edit-outline" class="w-4 h-4 text-orange-500" /> Edit Description</a></li>
          <li><a class="py-3 px-4" @click="handleContextAction('info')"><Icon name="mdi:information" class="w-4 h-4 text-primary" /> Details</a></li>
          <li><a class="py-3 px-4" @click="handleContextAction('favourite')">
            <Icon :name="contextMenuFile?.meta.isFavourite ? 'mdi:star' : 'mdi:star-outline'" class="w-4 h-4 text-orange-500" />
            {{ contextMenuFile?.meta.isFavourite ? 'Unstar' : 'Star' }}
          </a></li>
          <li><a class="py-3 px-4" @click="handleContextAction('download')"><Icon name="mdi:download" class="w-4 h-4 text-success" /> Download</a></li>
          <div class="h-px bg-base-content/5 mx-2 my-1"></div>
          <li><a class="py-3 px-4 text-error" @click="handleContextAction('delete')"><Icon name="mdi:delete" class="w-4 h-4" /> Delete</a></li>
        </ul>
      </div>
    </transition>

    <!-- File Info Modal (Overhauled) -->
    <div class="modal backdrop-blur-md" :class="{ 'modal-open': showFileInfoModal }" @click="closeFileModal">
      <div class="modal-box rounded-3xl shadow-2xl p-0 max-w-lg border border-base-content/5 overflow-hidden flex flex-col max-h-[90vh]" @click.stop>
        <div class="bg-primary/5 p-8 border-b border-base-content/5 shrink-0">
          <div class="flex items-center gap-6">
            <div class="bg-base-100 p-4 rounded-2xl shadow-sm ring-1 ring-base-content/5">
              <Icon
                  :name="selectedFile?.isFolder ? 'vscode-icons:default-folder' : getIconForExtension(selectedFile?.name || '')"
                  class="w-12 h-12"
              />
            </div>
            <div class="min-w-0">
              <h3 class="font-black text-xl tracking-tight truncate">{{ selectedFile?.name }}</h3>
              <p class="text-xs font-bold text-base-content/40 uppercase tracking-widest">
                {{ selectedFile?.isFolder ? 'Folder' : 'Document' }}
              </p>
            </div>
          </div>
        </div>

        <div v-if="selectedFile" class="p-8 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
          <div class="grid grid-cols-2 gap-6">
            <div class="flex flex-col gap-1">
              <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Size</span>
              <span class="text-sm font-bold">{{ selectedFile.isFolder ? '--' : (selectedFile.size / 1024 / 1024).toFixed(2) + ' MB' }}</span>
            </div>
            <div class="flex flex-col gap-1 text-right">
              <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Modified</span>
              <span class="text-sm font-bold">{{ new Date(selectedFile.lastModified).toLocaleDateString() }}</span>
            </div>
          </div>

          <div v-if="selectedFile.meta.tags.length || true">
             <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30 block mb-3">Tags</span>
             <div class="flex flex-wrap gap-2 items-center">
                <span v-for="tag in selectedFile.meta.tags"
                      :key="tag.name"
                      class="badge badge-md border-none text-white font-bold py-3.5 shadow-sm group/tag"
                      :style="{ backgroundColor: tag.color }"> 
                  {{ tag.name }} 
                  <Icon name="mdi:close" 
                        class="w-0 group-hover/tag:w-3 h-3 ml-0 group-hover/tag:ml-1 cursor-pointer transition-all" 
                        @click.stop="removeTag(tag)" />
                </span>
                
                <button
                  class="btn btn-ghost btn-xs bg-base-200/50 hover:bg-base-content/10 border border-base-content/5 rounded-full px-3 transition-all"
                  @click="showTagModal = true"
                >
                  <Icon name="mdi:tag-plus-outline" class="w-4 h-4 mr-1 text-primary" /> 
                  <span class="font-bold text-[10px] uppercase tracking-wide">Add Tag</span>
                </button>
             </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30">Description</span>
              <button v-if="!isEditingDescription" class="btn btn-ghost btn-xs rounded-lg" @click="startEditDescription">
                <Icon name="mdi:pencil" class="w-3 h-3 mr-1" /> Edit
              </button>
            </div>
            
            <div v-if="isEditingDescription" class="space-y-3">
              <textarea
                  v-model="editableDescription"
                  class="textarea textarea-bordered w-full h-24 bg-base-200/50 focus:bg-base-100 transition-all font-bold text-sm rounded-xl"
                  placeholder="Enter description..."
              ></textarea>
              <div class="flex justify-end gap-2">
                <button class="btn btn-ghost btn-xs" @click="isEditingDescription = false">Cancel</button>
                <button class="btn btn-primary btn-xs px-4" @click="saveDescription">Save</button>
              </div>
            </div>
            <div v-else>
              <div v-if="selectedFile.meta.description" class="bg-base-200/50 p-4 rounded-xl text-sm font-medium leading-relaxed text-base-content/80 whitespace-pre-line">
                {{ selectedFile.meta.description }}
              </div>
              <button v-else class="btn btn-ghost btn-sm w-full border border-dashed border-base-content/10 rounded-xl italic font-bold text-base-content/30 text-xs" @click="startEditDescription">
                <Icon name="mdi:plus" class="w-4 h-4 mr-1" /> Add details about this file
              </button>
            </div>
          </div>

          <div class="h-px bg-base-content/5"></div>

          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-black tracking-tight">Favorite</span>
                <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">Pin to favorites for quick access</p>
              </div>
              <button 
                class="btn btn-sm btn-ghost btn-circle"
                :class="selectedFile.meta.isFavourite ? 'text-orange-500' : 'text-base-content/20'"
                @click="toggleFavourite(selectedFile)"
              >
                <Icon :name="selectedFile.meta.isFavourite ? 'mdi:star' : 'mdi:star-outline'" class="w-6 h-6" />
              </button>
            </div>

            <div class="flex items-center justify-between">
              <div>
                <span class="text-sm font-black tracking-tight">Public Access</span>
                <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">Enable to share via link</p>
              </div>
              <input type="checkbox" class="toggle toggle-success toggle-sm" :checked="selectedFile.meta.isPublic" @change="togglePublicAccess" />
            </div>
            
            <transition name="fade">
              <div v-if="selectedFile.meta.isPublic" class="bg-success/10 p-4 rounded-2xl flex flex-col gap-3 border border-success/20">
                <p class="text-[11px] font-bold text-success-content/70">Anyone with the link can view this file.</p>
                <button class="btn btn-sm btn-success text-white w-full rounded-xl shadow-lg shadow-success/20" @click="copyPublicLink">
                  <Icon name="mdi:content-copy" class="w-4 h-4 mr-2" />
                  Copy Public Link
                </button>
              </div>
            </transition>
          </div>

          <!-- Preview -->
          <div v-if="!selectedFile.isFolder && (isVideoFile(selectedFile.name) || isImageFile(selectedFile.name))" class="pt-4">
             <span class="text-[10px] font-black uppercase tracking-widest text-base-content/30 block mb-3">Quick Preview</span>
             <div :key="selectedFile.name" class="rounded-2xl overflow-hidden shadow-sm ring-1 ring-base-content/10 bg-base-200 flex items-center justify-center aspect-video">
                <video v-if="isVideoFile(selectedFile.name)" id="previewVideo" controls class="w-full h-full object-contain">
                  <source :src="getStaticUrl(selectedFile)" type="video/mp4" />
                </video>
                <img v-else-if="isImageFile(selectedFile.name)" :src="getStaticUrl(selectedFile)" class="w-full h-full object-cover" />
             </div>
          </div>
        </div>

        <div class="p-6 bg-base-200/50 flex flex-wrap gap-2 justify-center shrink-0">
          <button class="btn btn-sm btn-error btn-outline border-none hover:bg-error/20 rounded-xl px-4" @click="deleteFile(selectedFile)">
            <Icon name="mdi:delete" class="w-4 h-4 mr-1" /> Delete
          </button>
          <button class="btn btn-sm bg-base-100 hover:bg-base-200 border border-base-content/10 rounded-xl px-4" @click="downloadFile(selectedFile)">
            <Icon name="mdi:download" class="w-4 h-4 mr-1" /> Download
          </button>
          <button class="btn btn-sm bg-base-100 hover:bg-base-200 border border-base-content/10 rounded-xl px-4" @click="copyFileLinkStatic(selectedFile)">
            <Icon name="mdi:link" class="w-4 h-4 mr-1" /> Link
          </button>
          <button class="btn btn-sm btn-primary rounded-xl px-6" @click="closeFileModal">Done</button>
        </div>
      </div>
    </div>

    <!-- Image Viewer Modal (Overhauled) -->
    <div class="modal image-viewer-modal backdrop-blur-md" :class="{ 'modal-open': showImageViewerModal }" @click="closeImageViewer">
      <div class="modal-box-image p-4 bg-transparent border-none shadow-none" @click.stop>
        <div class="relative group">
          <img :src="selectedImageUrl" alt="Full size preview" class="max-h-[85vh] max-w-[90vw] rounded-2xl shadow-2xl ring-1 ring-white/10" />
          <button class="btn btn-circle btn-sm absolute -top-4 -right-4 bg-base-100 shadow-xl border-none" @click="closeImageViewer">✕</button>
        </div>
      </div>
    </div>

    <!-- Upload Modal (Overhauled) -->
    <input type="checkbox" id="upload-modal" class="modal-toggle" />
    <div class="modal backdrop-blur-md">
      <div class="modal-box rounded-3xl shadow-2xl p-8 max-w-md border border-base-content/5">
        <div class="flex items-center gap-3 mb-8">
           <div class="bg-primary/10 p-3 rounded-2xl">
             <Icon name="mdi:cloud-upload" class="w-6 h-6 text-primary" />
           </div>
           <div>
             <h3 class="font-black text-xl tracking-tight">Upload Files</h3>
             <p class="text-[11px] font-bold text-base-content/40 uppercase tracking-widest">Add new content to your cloud</p>
           </div>
        </div>

        <div class="form-control">
          <div 
            class="border-2 border-dashed border-base-content/10 rounded-3xl p-12 text-center transition-all hover:border-primary/40 hover:bg-primary/5 cursor-pointer flex flex-col items-center gap-3"
            @click="$refs.fileInput.click()"
          >
            <Icon name="mdi:file-plus-outline" class="w-12 h-12 text-base-content/20" />
            <div>
              <p class="text-sm font-bold">Drop files here</p>
              <p class="text-[10px] font-bold text-base-content/30 uppercase tracking-widest mt-1">or click to browse</p>
            </div>
            <input 
              ref="fileInput"
              type="file" 
              multiple 
              @change="handleFileSelect" 
              class="hidden" 
            />
          </div>
          
          <div v-if="selectedFilesForUpload?.length" class="mt-6 space-y-2">
             <div v-for="file in Array.from(selectedFilesForUpload).slice(0, 3)" :key="file.name" class="flex items-center gap-2 p-2 bg-base-200/50 rounded-xl">
                <Icon :name="getIconForExtension(file.name)" class="w-4 h-4" />
                <span class="text-xs font-bold truncate flex-grow">{{ file.name }}</span>
             </div>
             <p v-if="selectedFilesForUpload.length > 3" class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest text-center">
               + {{ selectedFilesForUpload.length - 3 }} more files
             </p>
          </div>
        </div>

        <div v-if="isUploading" class="mt-8 space-y-3">
          <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
            <span>Uploading...</span>
            <span>{{ uploadProgress }}%</span>
          </div>
          <progress class="progress progress-primary w-full h-2 rounded-full" :value="uploadProgress" max="100"></progress>
        </div>

        <div v-if="uploadError" class="alert alert-error text-xs font-bold mt-6 py-3 rounded-xl shadow-lg shadow-error/10">
          <Icon name="mdi:alert-circle" class="w-4 h-4" />
          {{ uploadError }}
        </div>
        
        <div v-if="uploadSuccess" class="alert alert-success text-xs font-bold mt-6 py-3 rounded-xl shadow-lg shadow-success/10 text-white">
          <Icon name="mdi:check-circle" class="w-4 h-4" />
          Files uploaded!
        </div>

        <div class="modal-action mt-10">
          <label for="upload-modal" class="btn btn-ghost rounded-xl">Cancel</label>
          <button class="btn btn-primary rounded-xl px-8 shadow-lg shadow-primary/20" :disabled="isUploading || !selectedFilesForUpload" @click="uploadFile">
            <span v-if="isUploading" class="loading loading-spinner loading-xs"></span>
            Start Upload
          </button>
        </div>
      </div>
    </div>

    <!-- Create Folder Modal -->
    <div v-if="showCreateFolderModal" class="modal modal-open backdrop-blur-md">
      <div class="modal-box rounded-3xl shadow-2xl p-8 max-w-sm border border-base-content/5">
        <div class="flex items-center gap-3 mb-6">
          <div class="bg-primary/10 p-3 rounded-2xl">
            <Icon name="mdi:folder-plus" class="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 class="font-black text-xl tracking-tight">New Folder</h3>
            <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">Create a new workspace</p>
          </div>
        </div>

        <div class="form-control">
          <label class="label mb-1">
            <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">Folder Name</span>
          </label>
          <input
              v-model="newFolderName"
              type="text"
              placeholder="Documents, Images, Project X..."
              class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-sm h-12 rounded-xl"
              @keyup.enter="executeCreateFolder"
              autoFocus
          />
        </div>

        <div class="flex flex-col gap-3 mt-8">
          <button class="btn btn-primary h-12 rounded-xl shadow-lg" @click="executeCreateFolder">Create Folder</button>
          <button class="btn btn-ghost h-12 rounded-xl" @click="showCreateFolderModal = false">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Move Modal -->
    <div v-if="showMoveModal" class="modal modal-open backdrop-blur-md">
      <div class="modal-box rounded-3xl shadow-2xl p-0 max-w-lg border border-base-content/5 overflow-hidden flex flex-col max-h-[80vh]">
        <div class="bg-primary/5 p-6 border-b border-base-content/5 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="bg-primary/10 p-2 rounded-xl">
              <Icon name="mdi:folder-move" class="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 class="font-black text-lg tracking-tight">Move Items</h3>
              <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest">Select destination folder</p>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm btn-circle" @click="showMoveModal = false">
            <Icon name="mdi:close" class="w-5 h-5" />
          </button>
        </div>

        <div class="p-4 bg-base-200/30 border-b border-base-content/5 flex items-center gap-2 overflow-x-auto shrink-0 no-scrollbar">
          <button 
            class="btn btn-xs btn-ghost gap-1 px-2 h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider"
            @click="fetchPickerFolders('')"
          >
            Root
          </button>
          <template v-for="(part, index) in pickerCurrentPath.split('/')" :key="index">
            <Icon v-if="part" name="mdi:chevron-right" class="w-3 h-3 opacity-30" />
            <button 
              v-if="part"
              class="btn btn-xs btn-ghost gap-1 px-2 h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider max-w-[120px] truncate"
              @click="fetchPickerFolders(pickerCurrentPath.split('/').slice(0, index + 1).join('/'))"
            >
              {{ part }}
            </button>
          </template>
        </div>

        <div class="flex-1 overflow-y-auto p-2 min-h-[300px] custom-scrollbar">
          <div v-if="pickerCurrentPath" 
               class="flex items-center gap-3 p-3 rounded-xl hover:bg-base-200 cursor-pointer group"
               @click="navigatePickerUp">
            <Icon name="mdi:arrow-up-bold-outline" class="w-5 h-5 text-base-content/30 group-hover:text-primary" />
            <span class="text-sm font-bold">Go Up</span>
          </div>

          <div v-for="folder in pickerFolders" 
               :key="folder.name"
               class="flex items-center gap-3 p-3 rounded-xl hover:bg-base-200 cursor-pointer group"
               @click="navigatePicker(folder.name)">
            <Icon name="vscode-icons:default-folder" class="w-5 h-5 group-hover:scale-110 transition-transform" />
            <div class="flex-grow min-w-0">
              <span class="text-sm font-bold truncate block">{{ folder.name }}</span>
            </div>
            <Icon name="mdi:chevron-right" class="w-4 h-4 opacity-0 group-hover:opacity-100 text-primary" />
          </div>

          <div v-if="pickerFolders.length === 0 && !pickerCurrentPath" class="flex flex-col items-center justify-center py-12 opacity-30">
            <Icon name="mdi:folder-open-outline" class="w-12 h-12 mb-2" />
            <p class="text-xs font-bold uppercase tracking-widest">No subfolders found</p>
          </div>
        </div>

        <div class="p-4 bg-base-100 border-t border-base-content/5 flex items-center justify-between gap-4 shrink-0">
          <div class="min-w-0 flex-1">
            <p class="text-[9px] font-black uppercase tracking-[0.2em] text-base-content/30 mb-1">Destination</p>
            <p class="text-xs font-black truncate text-primary">/{{ pickerCurrentPath || 'Root' }}</p>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-sm px-6 rounded-xl font-bold uppercase tracking-wider text-[10px]" @click="showMoveModal = false">Cancel</button>
            <button 
              class="btn btn-sm btn-primary px-8 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
              @click="executeMove"
              :disabled="isMoving"
            >
              <span v-if="isMoving" class="loading loading-spinner loading-xs"></span>
              Move Here
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tag Modal (Overhauled - matches Media tab) -->
    <div v-if="showTagModal" class="modal modal-open backdrop-blur-md">
      <div class="modal-box rounded-3xl shadow-2xl p-8 max-w-lg border border-base-content/5">
        <div class="flex items-center gap-3 mb-8">
          <div class="bg-primary/10 p-3 rounded-2xl">
            <Icon name="mdi:tag-multiple" class="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 class="font-black text-xl tracking-tight">Manage Tags</h3>
            <p class="text-[11px] font-bold text-base-content/40 uppercase tracking-widest">Label your files for quick discovery</p>
          </div>
        </div>

        <div v-if="taggingProgress" class="text-center py-10">
          <div class="loading loading-spinner loading-lg text-primary mb-4"></div>
          <p class="font-black text-sm uppercase tracking-widest text-base-content/60">
            Applying tags... {{ taggingProgress.current }} / {{ taggingProgress.total }}
          </p>
        </div>
        <div v-else-if="showNewTagForm" class="space-y-6">
          <div class="form-control">
            <label class="label mb-1">
              <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">Tag Name</span>
            </label>
            <input
                v-model="newTagName"
                type="text"
                placeholder="Work, Personal, Invoices..."
                class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-sm h-12 rounded-xl"
            />
          </div>
          <div class="form-control">
            <label class="label mb-1">
              <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">Color Identity</span>
            </label>
            <div class="flex gap-4">
              <input v-model="newTagColor" type="color" class="w-16 h-12 rounded-xl cursor-pointer border-none bg-base-200/50" />
              <div class="flex-grow h-12 rounded-xl flex items-center px-4 font-bold text-sm bg-base-200/50 border border-dashed border-base-content/10" :style="{ color: newTagColor }">
                Preview Style
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-3 mt-10">
            <button class="btn btn-primary h-12 rounded-xl shadow-lg" @click="bulkAddTags">Create & Apply</button>
            <button class="btn btn-ghost h-12 rounded-xl" @click="showNewTagForm = false">Use Existing</button>
            <button class="btn btn-ghost h-12 rounded-xl text-error/60" @click="closeTagModal">Cancel</button>
          </div>
        </div>

        <div v-else class="space-y-6">
          <div class="form-control">
            <label class="label mb-3">
              <span class="label-text font-black text-[10px] uppercase tracking-widest text-base-content/40">Select Existing Tags</span>
            </label>
            <div class="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              <div
                  v-for="tag in predefinedTags"
                  :key="tag.name"
                  class="p-4 rounded-xl cursor-pointer text-center font-bold text-xs transition-all border-2"
                  :style="{ 
                    borderColor: tag.color, 
                    backgroundColor: isTagSelected(tag) ? tag.color : 'transparent',
                    color: isTagSelected(tag) ? 'white' : tag.color 
                  }"
                  @click="toggleTagSelection(tag)"
              >
                {{ tag.name }}
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-3 mt-10">
            <button class="btn btn-primary h-12 rounded-xl shadow-lg" @click="bulkAddTags">Apply Selection</button>
            <button class="btn btn-ghost h-12 rounded-xl" @click="showNewTagForm = true">New Identity</button>
            <button class="btn btn-ghost h-12 rounded-xl text-error/60" @click="closeTagModal">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.3s ease-out;
}
.slide-down-enter-from, .slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 10px;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.image-viewer-modal {
  background-color: rgba(0, 0, 0, 0.4);
  display: flex !important;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-box-image img {
  user-select: none;
}
</style>
