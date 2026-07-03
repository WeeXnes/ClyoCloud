<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'

useHead({
  title: 'Favorites'
})
import { getIconForExtension } from '~/core/fileIcons'
import type { File, Tag } from '~/types/File'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'
import { ProgressManager, startOperation, updateOperation, completeOperation, failOperation } from '~/core/progressManager'
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
const isUploading = ref(false)

const isEditingDescription = ref(false)
const editableDescription = ref('')
const searchQuery = ref('')

const formatSize = (bytes: number) => {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

const sortOption = useCookie<'name' | 'size' | 'date'>('favorites-sort-option', {
  default: () => 'name',
  maxAge: 60 * 60 * 24 * 365 // 1 year
})

const startEditDescription = () => {
  editableDescription.value = (selectedFile.value?.meta.description || '') as string
  isEditingDescription.value = true
}

const saveDescription = async () => {
  if (!selectedFile.value) return

  try {
    const filePath = selectedFile.value.name

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
  newName.value = file.name.split('/').pop() || file.name
}

const bulkDelete = async () => {
  if (selectedFiles.value.size === 0) return
  const count = selectedFiles.value.size
  if (!confirm(`Are you sure you want to delete ${count} file(s)?`)) return

  const op = startOperation('fav-bulk-delete', 'Deleting Favorites', count)

  try {
    let current = 0
    for (const filePath of selectedFiles.value) {
        await fetch('/api/files', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath }),
        })
        current++
        updateOperation('fav-bulk-delete', current)
    }
    createNotification(`${count} file(s) deleted successfully`, NotificationType.SUCCESS)
    completeOperation('fav-bulk-delete')
  } catch (err) {
    console.error('Error in bulk delete:', err)
    createNotification('Failed to delete some files', NotificationType.ERROR)
    failOperation('fav-bulk-delete')
  }
  selectedFiles.value.clear()
  await fetchFavorites()
}

const bulkDownload = () => {
  // Bulk download across different folders might be complex if the API doesn't support it well.
  // For now, let's just warn or handle it if bulk-download API supports absolute relative paths.
  createNotification('Bulk download from Favorites is currently limited.', NotificationType.INFO)
}

const isGridViewCookie = useCookie<boolean>('isGridView', { 
  default: () => false,
  maxAge: 60 * 60 * 24 * 365 // 1 year
})
const isGridView = ref(isGridViewCookie.value)
watch(isGridView, (newVal) => {
  isGridViewCookie.value = newVal
})

const hoveredFile = ref<string | null>(null)
const visibleFiles = ref<Set<string>>(new Set())
const isMobile = ref(false)
const mobileAutoPreview = ref(true)
let touchTimer: any = null
let observer: IntersectionObserver | null = null

const fetchUserSettings = async () => {
  try {
    const response = await fetch('/api/user-settings', { credentials: 'include' })
    if (response.ok) {
      const data = await response.json()
      mobileAutoPreview.value = data.mobileAutoPreview ?? true
    }
  } catch (err) {
    console.error('Error fetching user settings:', err)
  }
}

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

const handleTouchStart = (fileName: string) => {
  if (isMobile.value && mobileAutoPreview.value) return 
  if (touchTimer) clearTimeout(touchTimer)
  touchTimer = setTimeout(() => {
    hoveredFile.value = fileName
  }, 200)
}

const handleTouchEnd = () => {
  if (isMobile.value && mobileAutoPreview.value) return
  if (touchTimer) clearTimeout(touchTimer)
  hoveredFile.value = null
}

const setupObserver = () => {
  if (!mobileAutoPreview.value) {
    if (observer) observer.disconnect()
    visibleFiles.value.clear()
    return
  }
  
  if (observer) observer.disconnect()
  
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const fileName = (entry.target as HTMLElement).dataset.fileName
      if (!fileName) return
      
      if (entry.isIntersecting) {
        visibleFiles.value.add(fileName)
      } else {
        visibleFiles.value.delete(fileName)
      }
    })
  }, { threshold: 0.5 })

  setTimeout(() => {
    const elements = document.querySelectorAll('.video-thumbnail-container')
    elements.forEach(el => observer?.observe(el))
  }, 100)
}

watch(sortedFiles, () => {
  if (isMobile.value) {
    setupObserver()
  }
}, { deep: true })

const openBulkTagModal = () => {
  selectedTags.value = []
  showNewTagForm.value = true
  newTagName.value = ''
  newTagColor.value = '#4B5EAA'
  showTagModal.value = true
}

const openSingleTagModal = () => {
  if (selectedFile.value) {
    selectedTags.value = selectedFile.value.meta.tags ? [...selectedFile.value.meta.tags] : []
    showNewTagForm.value = false
  } else {
    selectedTags.value = []
    showNewTagForm.value = true
  }
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
    const filePath = selectedFile.value.name
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
    await fetchFavorites()
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
    const targetPaths = selectedFiles.value.size > 0 
      ? Array.from(selectedFiles.value) 
      : (selectedFile.value ? [selectedFile.value.name] : [])

    if (targetPaths.length === 0) {
      createNotification('No file selected', NotificationType.ERROR)
      return
    }

    taggingProgress.value = { current: 0, total: targetPaths.length }

    for (const filePath of targetPaths) {
      const file = files.value.find(f => f.name === filePath)
      if (!file) {
        taggingProgress.value.current++
        continue
      }
      
      const currentTags = file.meta.tags || []
      let updatedTags = []

      if (!showNewTagForm.value && targetPaths.length === 1) {
        // For single file, sync tags exactly (allows removal)
        const isSame = currentTags.length === tagsToAdd.length && 
                      currentTags.every(ct => tagsToAdd.some(ta => ta.name === ct.name))
        
        if (isSame) {
          taggingProgress.value.current++
          continue
        }
        updatedTags = tagsToAdd
      } else {
        // For bulk or new tag, strictly additive
        const tagsToActuallyAdd = tagsToAdd.filter(newTag => 
          !currentTags.some(existingTag => existingTag.name.toLowerCase() === newTag.name.toLowerCase())
        )

        if (tagsToActuallyAdd.length === 0) {
          taggingProgress.value.current++
          continue
        }

        updatedTags = [...currentTags, ...tagsToActuallyAdd]
      }
      
      const response = await fetch('/api/file-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullPath: filePath,
          tags: updatedTags,
        }),
      })
      if (!response.ok) throw new Error(`Failed to add tags for ${filePath}`)
      
      if (selectedFile.value && filePath === selectedFile.value.name) {
        selectedFile.value.meta.tags = updatedTags
      }
      taggingProgress.value.current++
    }

    createNotification('Tags added successfully', NotificationType.SUCCESS)

    // Automatically add new tag to predefined tags
    if (showNewTagForm.value) {
      const newTag = tagsToAdd[0];
      const exists = predefinedTags.value.some(t => t.name.toLowerCase() === newTag.name.toLowerCase());
      if (!exists) {
        try {
          const updatedPredefinedTags = [...predefinedTags.value, newTag];
          await fetch('/api/tags', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: updatedPredefinedTags }),
          });
          await fetchPredefinedTags();
        } catch (tagErr) {
          console.error('Failed to update predefined tags:', tagErr);
        }
      }
    }

    await fetchFavorites()
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

const saveRename = async (oldPath: string) => {
  if (!newName.value || newName.value === oldPath.split('/').pop()) {
    editingName.value = null
    return
  }

  try {
    const response = await fetch('/api/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath, newName: newName.value }),
    })

    if (!response.ok) throw new Error('Failed to rename')
    
    createNotification('Renamed successfully', NotificationType.SUCCESS)
    await fetchFavorites()
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

const showPickerCreateFolderInput = ref(false)
const newPickerFolderName = ref('')
const lastSelectedIndex = ref(-1)

const scrollIndex = ref(0)
const itemsPerRow = ref(6)

const handleMainScroll = () => {
  const scrollTop = window.scrollY
  const gridElement = document.getElementById('file-grid-container')
  if (!gridElement) return

  const offsetTop = gridElement.offsetTop
  const viewportHeight = window.innerHeight
  const relativeScroll = Math.max(0, scrollTop - offsetTop)

  if (!isGridView.value) {
    const itemHeight = 66 // 56px row + 10px gap
    scrollIndex.value = Math.floor(relativeScroll / itemHeight)
  } else {
    const containerWidth = gridElement.clientWidth
    const gaps = itemsPerRow.value - 1
    const totalGapWidth = gaps * 24
    const itemWidth = (containerWidth - totalGapWidth) / itemsPerRow.value
    const itemHeight = itemWidth + 8 + 40 + 24 // thumbnail + gap-2 + metadata (h-40) + gap-6
    const rowsScrolled = Math.floor(relativeScroll / itemHeight)
    scrollIndex.value = rowsScrolled * itemsPerRow.value
  }
}

const isFileVisible = (index: number) => {
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
  if (file) {
    movingItems.value = [file.name]
  } else if (selectedFiles.value.size > 0) {
    movingItems.value = Array.from(selectedFiles.value)
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
    pickerFolders.value = allItems.filter(item => item.isFolder && !movingItems.value.includes(path ? `${path}/${item.name}` : item.name))
    pickerCurrentPath.value = path
  } catch (err) {
    console.error('Error fetching picker folders:', err)
    createNotification('Failed to load folders', NotificationType.ERROR)
  }
}

const navigatePicker = (folderName: string) => {
  const newPath = pickerCurrentPath.value ? `${pickerCurrentPath.value}/${folderName}` : folderName
  showPickerCreateFolderInput.value = false
  newPickerFolderName.value = ''
  fetchPickerFolders(newPath)
}

const navigatePickerUp = () => {
  if (!pickerCurrentPath.value) return
  const parts = pickerCurrentPath.value.split('/')
  parts.pop()
  const newPath = parts.join('/')
  showPickerCreateFolderInput.value = false
  newPickerFolderName.value = ''
  fetchPickerFolders(newPath)
}

const executePickerCreateFolder = async () => {
  if (!newPickerFolderName.value.trim()) {
    createNotification('Folder name is required', NotificationType.WARNING)
    return
  }

  try {
    const response = await fetch('/api/folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newPickerFolderName.value, path: pickerCurrentPath.value }),
    })
    if (!response.ok) throw new Error('Failed to create folder')
    
    await fetchPickerFolders(pickerCurrentPath.value)
    showPickerCreateFolderInput.value = false
    newPickerFolderName.value = ''
    createNotification('Folder created successfully', NotificationType.SUCCESS)
  } catch (err) {
    console.error(err)
    createNotification('Failed to create folder', NotificationType.ERROR)
  }
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
    
    const data = await response.json()
    const movedCount = data.results?.filter((r: any) => r.success && !r.skipped).length || 0
    const errors = data.results?.filter((r: any) => !r.success) || []

    if (movedCount > 0) {
      createNotification('Items moved successfully', NotificationType.SUCCESS)
    } else if (errors.length > 0) {
      createNotification(errors[0].error || 'Failed to move items', NotificationType.ERROR)
    }
    
    showMoveModal.value = false
    selectedFiles.value.clear()
    await fetchFavorites()
  } catch (err) {
    console.error('Error moving items:', err)
    createNotification('Failed to move items', NotificationType.ERROR)
  } finally {
    isMoving.value = false
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    if (event.key === 'Escape') target.blur()
    return
  }

  if (event.key === 'Escape') {
    showFileInfoModal.value = false
    showImageViewerModal.value = false
    showTagModal.value = false
    showMoveModal.value = false
    showPickerCreateFolderInput.value = false
    selectedFile.value = null
    editingName.value = null
  }

  if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
    event.preventDefault()
    toggleSelectAll()
  }

  if (event.key === 'Delete' && selectedFiles.value.size > 0) {
    bulkDelete()
  }

  if (event.key === 'Enter') {
    if (selectedFiles.value.size === 1) {
      const filePath = Array.from(selectedFiles.value)[0]
      const file = files.value.find(f => f.name === filePath)
      if (file) onFileClick(new MouseEvent('click'), file)
    }
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
      const segments = file.name.split('/')
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
    case 'reset-folder-icon':
      resetFolderIcon()
      break
  }
}

const resetFolderIcon = async () => {
  const file = contextMenuFile.value
  if (!file || !file.isFolder) return

  try {
    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullPath: file.name,
        previewImage: null,
      }),
    })

    if (!response.ok) throw new Error('Failed to reset folder icon')

    file.meta.previewImage = null
    createNotification('Folder icon reset', NotificationType.SUCCESS)
  } catch (err) {
    console.error(err)
    createNotification('Failed to reset folder icon', NotificationType.ERROR)
  }
}

onMounted(async () => {
  await fetchFavorites()
  await fetchPredefinedTags()
  await fetchUserSettings()
  updateItemsPerRow()
  checkMobile()
  if (isMobile.value && mobileAutoPreview.value) setupObserver()
  
  window.addEventListener('resize', () => {
    updateItemsPerRow()
    checkMobile()
  })
  window.addEventListener('scroll', handleMainScroll, { passive: true })
  window.addEventListener('keydown', handleKeydown)

  window.addEventListener('click', () => {
    showContextMenu.value = false
  })
})
onUnmounted(() => {
  window.removeEventListener('resize', updateItemsPerRow)
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('scroll', handleMainScroll)
  window.removeEventListener('keydown', handleKeydown)
  if (observer) observer.disconnect()
})

const isLoading = ref(true)

const fetchFavorites = async () => {
  isLoading.value = true
  try {
    const response = await fetch('/api/favorites', { credentials: 'include' })
    if (!response.ok) throw new Error('Failed to fetch favorites')
    files.value = await response.json()
  } catch (error) {
    console.error('Error fetching favorites:', error)
  } finally {
    isLoading.value = false
  }
}

const deleteFile = async (file: File) => {
  if (!file) return;
  if (!confirm(`Are you sure you want to delete "${file.name.split('/').pop()}"?`)) return

  try {
    const response = await fetch('/api/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: file.name }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to delete file')
    }

    await fetchFavorites()
    if (showFileInfoModal.value) showFileInfoModal.value = false;
    createNotification('File deleted successfully', NotificationType.SUCCESS)
  } catch (error: any) {
    console.error('Error deleting file:', error)
    createNotification(error.message || 'Failed to delete file', NotificationType.ERROR)
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

const getThumbnailUrl = (fullPath: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  const segments = fullPath.split('/')
  const encodedPath = segments.map(segment => encodeURIComponent(segment)).join('/')
  return `${baseUrl}/thumbnail/${encodedPath}`
}

const onFileClick = (event: MouseEvent, file: File) => {
  const currentIndex = sortedFiles.value.findIndex(f => f.name === file.name)
  
  if (event.shiftKey && lastSelectedIndex.value !== -1) {
    const start = Math.min(lastSelectedIndex.value, currentIndex)
    const end = Math.max(lastSelectedIndex.value, currentIndex)
    for (let i = start; i <= end; i++) {
      selectedFiles.value.add(sortedFiles.value[i].name)
    }
    lastSelectedIndex.value = currentIndex
    return
  }

  lastSelectedIndex.value = currentIndex

  if (selectedFiles.value.size > 0 && !event.ctrlKey && !event.metaKey) {
    toggleSelection(file.name)
    return
  }

  if (event.ctrlKey || event.metaKey) {
    toggleSelection(file.name)
    return
  }

  const target = event.target as HTMLElement
  const isThumbnail = target.dataset.isThumbnail === 'true'

  if (file.isFolder) {
    const segments = file.name.split('/')
    const encodedPath = segments.map(segment => encodeURIComponent(segment)).join('/')
    navigateTo(`/files/${encodedPath}`)
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
  const isVideo = isVideoFile(file.name)
  const endpoint = isVideo ? '/stream' : '/file'
  const segments = file.name.split('/')
  const encodedPath = segments.map(segment => encodeURIComponent(segment)).join('/')
  return `${baseUrl}${endpoint}/${encodedPath}`
}

const copyFileLinkStatic = async (file: File) => {
  const success = await copyToClipboard(getStaticUrl(file));
  if (!success) console.error('Failed to copy link')
}

const downloadFile = (file: File) => {
  if (file.isFolder) {
    window.location.href = `/api/zip?path=${encodeURIComponent(file.name)}`
  } else {
    const url = getStaticUrl(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name.split('/').pop() || file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
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
    const filePath = selectedFile.value.name
    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullPath: filePath, isPublic }),
    })
    
    if (!response.ok) throw new Error('Failed to update visibility')
    
    selectedFile.value.meta.isPublic = isPublic
    const fileInList = files.value.find(f => f.name === selectedFile.value?.name)
    if (fileInList) fileInList.meta.isPublic = isPublic
    
    createNotification(`Public access ${isPublic ? 'enabled' : 'disabled'}`, NotificationType.INFO)
    
  } catch (err) {
    console.error(err)
    createNotification('Failed to update public access', NotificationType.ERROR)
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

  const filePath = file.name
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
    const filePath = file.name
    const response = await fetch('/api/file-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullPath: filePath, isFavourite }),
    })
    
    if (!response.ok) throw new Error('Failed to update favorite status')
    
    file.meta.isFavourite = isFavourite
    if (!isFavourite) {
      files.value = files.value.filter(f => f.name !== file.name)
      if (showFileInfoModal.value) showFileInfoModal.value = false
    }
    createNotification(`File ${isFavourite ? 'added to' : 'removed from'} favorites`, NotificationType.INFO)
    
  } catch (err) {
    console.error(err)
    createNotification('Failed to update favorite status', NotificationType.ERROR)
  }
}

// Mouse Area Selection
const isSelecting = ref(false)
const selectionBox = ref({ x: 0, y: 0, width: 0, height: 0 })
const selectionStart = ref({ x: 0, y: 0 })

const handleMouseDown = (event: MouseEvent) => {
  if (isMobile.value) return
  const target = event.target as HTMLElement
  if (target.closest('.file-item-container') || target.closest('.btn') || target.closest('.input') || target.closest('.modal')) return
  if (event.button !== 0) return 

  isSelecting.value = true
  selectionStart.value = { x: event.clientX, y: event.clientY }
  selectionBox.value = { x: event.clientX, y: event.clientY, width: 0, height: 0 }

  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isSelecting.value) return

  const currentX = event.clientX
  const currentY = event.clientY

  selectionBox.value = {
    x: Math.min(selectionStart.value.x, currentX),
    y: Math.min(selectionStart.value.y, currentY),
    width: Math.abs(selectionStart.value.x - currentX),
    height: Math.abs(selectionStart.value.y - currentY)
  }

  updateSelection()
}

const updateSelection = () => {
  const elements = document.querySelectorAll('.file-item-container')
  elements.forEach((el) => {
    const rect = el.getBoundingClientRect()
    const fileName = (el as HTMLElement).dataset.fileName
    if (!fileName) return

    const intersects = (
      rect.left < selectionBox.value.x + selectionBox.value.width &&
      rect.right > selectionBox.value.x &&
      rect.top < selectionBox.value.y + selectionBox.value.height &&
      rect.bottom > selectionBox.value.y
    )

    if (intersects) {
      selectedFiles.value.add(fileName)
    } else if (!window.event?.ctrlKey && !window.event?.metaKey) {
      selectedFiles.value.delete(fileName)
    }
  })
}

const handleMouseUp = (event: MouseEvent) => {
  isSelecting.value = false
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)

  // If it was a simple click on empty space (not a drag), clear selection
  const deltaX = Math.abs(event.clientX - selectionStart.value.x)
  const deltaY = Math.abs(event.clientY - selectionStart.value.y)
  
  if (deltaX < 5 && deltaY < 5 && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    selectedFiles.value.clear()
    lastSelectedIndex.value = -1
  }
}

const getPreviewUrl = (fullPath: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  const segments = fullPath.split('/')
  const encodedPath = segments.map(segment => encodeURIComponent(segment)).join('/')
  return `${baseUrl}/preview/${encodedPath}`
}
</script>

<template>
  <div class="min-h-screen bg-base-200/50" @mousedown="handleMouseDown">
    <!-- Selection Box -->
    <div v-if="isSelecting" 
         class="fixed border-2 border-primary bg-primary/10 z-[100] pointer-events-none"
         :style="{
           left: selectionBox.x + 'px',
           top: selectionBox.y + 'px',
           width: selectionBox.width + 'px',
           height: selectionBox.height + 'px'
         }">
    </div>

    <!-- Edge-to-Edge Sticky Header -->
    <header class="sticky top-0 z-[40] w-full bg-base-100/80 backdrop-blur-md border-b border-base-content/10">
      <div class="w-full px-4 py-3 md:py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          
          <!-- Title -->
          <div class="flex flex-col gap-0.5 md:gap-1 min-w-0">
            <div class="flex items-center gap-2">
              <label for="sidebar-drawer" class="btn btn-ghost btn-circle btn-xs md:btn-sm lg:hidden">
                <Icon name="mdi:menu" class="w-5 h-5" />
              </label>
              <h1 class="text-base md:text-lg font-bold tracking-tight flex items-center gap-2 text-base-content">
                <Icon name="mdi:star" class="text-orange-500 w-5 h-5" />
                Favorites
              </h1>
            </div>
            <p class="text-[9px] md:text-[10px] font-bold text-base-content/40 uppercase tracking-widest pl-1">Your starred collection</p>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap items-center gap-2 md:gap-3">
             <!-- Search -->
             <div class="relative flex-1 md:flex-none md:min-w-[240px]">
                <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Icon name="mdi:magnify" class="w-4 h-4 text-base-content/30" />
                </div>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Filter favorites..."
                  class="input input-xs md:input-sm input-bordered w-full pl-9 bg-base-100/50 focus:bg-base-100 transition-all border-base-content/10 font-bold text-xs h-8 md:h-10"
                />
             </div>

             <div class="flex items-center gap-1.5 md:gap-2 ml-auto md:ml-0">
               <div class="dropdown dropdown-end">
                 <button tabindex="0" class="btn btn-xs md:btn-sm btn-ghost gap-2 border border-base-content/10 bg-base-100/50 font-bold text-[10px] uppercase tracking-widest">
                    <Icon name="mdi:sort-variant" class="w-4 h-4" />
                    <span class="hidden sm:inline">Sort</span>
                 </button>
                 <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow-lg bg-base-100 rounded-lg w-40 border border-base-content/10 mt-2 font-bold text-[10px] uppercase tracking-widest">
                   <li><a @click="sortOption = 'name'" :class="{ 'active': sortOption === 'name' }">Name</a></li>
                   <li><a @click="sortOption = 'size'" :class="{ 'active': sortOption === 'size' }">Size</a></li>
                   <li><a @click="sortOption = 'date'" :class="{ 'active': sortOption === 'date' }">Date</a></li>
                 </ul>
               </div>

               <div class="h-6 w-px bg-base-content/10 mx-0.5 md:mx-1"></div>

               <div class="flex bg-base-200/50 p-1 rounded-lg border border-base-content/10">
                 <button 
                  class="btn btn-xs btn-ghost rounded-md px-1.5" 
                  :class="{ 'bg-base-100 shadow-sm text-primary': !isGridView }"
                  @click="isGridView = false"
                 >
                   <Icon name="mdi:view-list" class="w-4 h-4" />
                 </button>
                 <button 
                  class="btn btn-xs btn-ghost rounded-md px-1.5" 
                  :class="{ 'bg-base-100 shadow-sm text-primary': isGridView }"
                  @click="isGridView = true"
                 >
                   <Icon name="mdi:view-grid" class="w-4 h-4" />
                 </button>
               </div>
             </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Bulk Action Bar -->
    <transition name="slide-down">
      <div v-if="selectedFiles.size > 0" class="sticky top-[99px] md:top-[80px] z-[50] w-full bg-primary text-primary-content shadow-lg py-2 md:py-2.5 px-4 sm:px-8">
        <div class="max-w-[1600px] mx-auto flex flex-nowrap items-center justify-between gap-4 overflow-x-auto no-scrollbar">
          <div class="flex items-center gap-4 shrink-0">
            <button class="btn btn-xs btn-outline btn-ghost border-white/30 text-white rounded-md font-bold" @click="toggleSelectAll">
              {{ selectedFiles.size === sortedFiles.length ? 'Deselect All' : 'Select All' }}
            </button>
            <span class="text-[10px] font-bold uppercase tracking-widest">{{ selectedFiles.size }} selected</span>
          </div>
          
          <div class="flex items-center gap-2 shrink-0">
            <button class="btn btn-xs bg-white/10 hover:bg-white/20 border-none text-white gap-2 font-bold uppercase tracking-wider rounded-md" @click="bulkDownload">
              <Icon name="mdi:download" class="w-3.5 h-3.5" /> Download
            </button>
            <button class="btn btn-xs bg-white/10 hover:bg-white/20 border-none text-white gap-2 font-bold uppercase tracking-wider rounded-md" @click="openBulkTagModal">
              <Icon name="mdi:tag-plus" class="w-3.5 h-3.5" /> Tags
            </button>
            <button class="btn btn-xs bg-white/10 hover:bg-white/20 border-none text-white gap-2 font-bold uppercase tracking-wider rounded-md" @click="openMoveModal()">
              <Icon name="mdi:folder-move" class="w-3.5 h-3.5" /> Move
            </button>
            <button class="btn btn-xs bg-error/20 hover:bg-error/40 border-none text-white gap-2 font-bold uppercase tracking-wider rounded-md" @click="bulkDelete">
              <Icon name="mdi:delete" class="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>
    </transition>

    <main class="max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-8 min-h-[70vh]">
      
      <!-- Skeleton Loading -->
      <div v-if="isLoading" :class="isGridView ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6' : 'space-y-3'">
        <div v-for="i in 12" :key="i" class="flex flex-col gap-3">
          <div :class="isGridView ? 'aspect-square rounded-lg bg-base-300 animate-pulse' : 'h-14 rounded-lg bg-base-300 animate-pulse'"></div>
          <div v-if="isGridView" class="h-3.5 w-3/4 bg-base-300 animate-pulse rounded mx-auto"></div>
        </div>
      </div>

      <!-- File Grid -->
      <div 
        v-else-if="sortedFiles.length"
        id="file-grid-container"
        :class="isGridView ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6' : 'flex flex-col gap-2.5'"
      >
        <div 
          v-for="(file, index) in sortedFiles" 
          :key="file.name" 
          class="group relative file-item-container"
          :data-file-name="file.name"
        >
          <template v-if="isFileVisible(index)">
            <!-- Grid Item -->
            <div v-if="isGridView" 
                 class="flex flex-col gap-2 transition-all duration-300"
            >
              <!-- Thumbnail Container -->
              <div 
                class="relative aspect-square rounded-lg bg-base-100 border border-base-content/10 shadow-sm hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden flex items-center justify-center group/item ring-primary/30"
                :class="{ 
                  'ring-1': selectedFiles.has(file.name),
                  'video-thumbnail-container': isVideoFile(file.name)
                }"
                :data-file-name="file.name"
                @click="onFileClick($event, file)" 
                @contextmenu.prevent="handleContextMenu($event, file)"
                @mouseenter="hoveredFile = file.name"
                @mouseleave="hoveredFile = null"
                @touchstart.passive="handleTouchStart(file.name)"
                @touchend="handleTouchEnd"
                @touchmove="handleTouchEnd"
              >
                <!-- Selection Checkbox (Top Left) -->
                <div class="absolute top-2 left-2 z-10 opacity-0 group-hover/item:opacity-100 transition-opacity" :class="{ 'opacity-100': selectedFiles.size > 0 }">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-xs checkbox-primary bg-base-100/80 backdrop-blur-md rounded-sm"
                    :checked="selectedFiles.has(file.name)"
                    @change="toggleSelection(file.name)"
                    @click.stop
                  />
                </div>

                <!-- Shared Indicator (Top Right) -->
                <div class="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
                  <div v-if="file.meta.isPublic"
                       class="bg-success text-success-content w-6 h-6 flex items-center justify-center rounded shadow-sm backdrop-blur-md hover:scale-105 transition-all"
                       title="Copy Shared Link"
                       @click.stop="copyPublicLinkForFile(file)">
                    <Icon name="mdi:share-variant" class="w-3.5 h-3.5" />
                  </div>
                  <div class="bg-base-100/80 text-orange-500 w-6 h-6 flex items-center justify-center rounded shadow-sm backdrop-blur-md hover:scale-105 transition-all"
                       title="Remove from Favorite"
                       @click.stop="toggleFavourite(file)">
                    <Icon name="mdi:star" class="w-3.5 h-3.5" />
                  </div>
                </div>

                <!-- File Content -->
                <template v-if="file.isFolder">
                  <img v-if="file.meta?.previewImage"
                       :src="getThumbnailUrl(file.name + '/' + file.meta.previewImage)"
                       class="w-full h-full object-cover transition-transform duration-500 group-hover/item:scale-105"
                       alt=""
                       data-is-thumbnail="true"
                       loading="lazy" />
                  <Icon v-else name="vscode-icons:default-folder" class="w-12 h-12 group-hover/item:scale-105 transition-transform duration-300" />
                  <!-- Folder indicator in corner if there's a custom preview image -->
                  <div v-if="file.meta?.previewImage" class="absolute bottom-2 right-2 bg-base-100/90 backdrop-blur-md border border-base-content/10 p-1.5 rounded shadow-lg flex items-center justify-center pointer-events-none z-10">
                    <Icon name="vscode-icons:default-folder" class="w-4 h-4" />
                  </div>
                </template>
                <template v-else>
                  <img v-if="hasThumbnail(file.name)"
                       :src="getThumbnailUrl(file.name)"
                       class="w-full h-full object-cover transition-transform duration-500 group-hover/item:scale-105"
                       alt=""
                       data-is-thumbnail="true"
                       loading="lazy" />
                  <Icon v-else
                        class="w-12 h-12 group-hover/item:scale-105 transition-transform duration-300"
                        :name="getIconForExtension(file.name)"
                        data-is-thumbnail="true" />

                  <!-- Video Preview Overlay -->
                  <div v-if="isVideoFile(file.name) && (hoveredFile === file.name || (isMobile && visibleFiles.has(file.name)))"
                       class="absolute inset-0 animate-in fade-in duration-200">
                    <img :src="getPreviewUrl(file.name)"
                         class="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                         @load="$event.target.classList.remove('opacity-0')"
                         alt="Preview" />
                  </div>
                </template>
                <!-- Hover Action Overlay -->
                <div class="absolute inset-0 bg-black/5 opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none"></div>
              </div>

              <!-- Grid Metadata -->
              <div class="px-1 text-center h-[40px] flex flex-col justify-center">
                <div class="min-w-0 px-1">
                  <input v-if="editingName === file.name" 
                         v-model="newName" 
                         class="input input-xs input-bordered w-full text-center font-bold" 
                         @keyup.enter="saveRename(file.name)" 
                         @blur="saveRename(file.name)" 
                         @click.stop />
                  <h3 v-else class="text-[11px] font-bold truncate block group-hover:text-primary transition-colors leading-tight text-base-content">{{ file.name.split('/').pop() }}</h3>
                  <div class="text-[9px] font-bold text-base-content/40 uppercase tracking-wider mt-0.5">
                    <span v-if="!file.isFolder">{{ formatSize(file.size) }}</span>
                    <span v-else>&nbsp;</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modernized List Item -->
            <div v-else 
                 class="flex items-center gap-4 p-2.5 bg-base-100 rounded-lg border border-base-content/10 hover:border-primary/30 transition-all cursor-pointer group/row ring-primary/30 h-[56px]"
                 :class="{ 
                   'ring-1 border-primary/30': selectedFiles.has(file.name)
                 }"
                 @click="onFileClick($event, file)" 
                 @contextmenu.prevent="handleContextMenu($event, file)"
            >
              <!-- Checkbox -->
              <div class="flex items-center justify-center shrink-0">
                <input type="checkbox" 
                       class="checkbox checkbox-xs checkbox-primary rounded-sm" 
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
                <div class="flex-grow min-w-0 mr-4 flex flex-col">
                  <input v-if="editingName === file.name" 
                         v-model="newName" 
                         class="input input-sm input-bordered w-full font-bold h-8 text-xs" 
                         @keyup.enter="saveRename(file.name)" 
                         @blur="saveRename(file.name)" 
                         @click.stop />
                  <h3 v-else class="text-xs font-bold truncate group-hover/row:text-primary transition-colors m-0 leading-none text-base-content">{{ file.name.split('/').pop() }}</h3>
                  <span class="text-[9px] font-bold text-base-content/20 truncate">{{ file.name }}</span>
                </div>
                
                <!-- Metadata Group -->
                <div class="flex items-center gap-6 text-[9px] font-bold text-base-content/40 uppercase tracking-widest shrink-0">
                  <div class="flex items-center gap-2">
                    <div v-if="file.meta.isPublic" 
                         class="flex items-center justify-center w-6 h-6 rounded bg-success/10 text-success hover:bg-success hover:text-white transition-all"
                         title="Copy Shared Link"
                         @click.stop="copyPublicLinkForFile(file)">
                      <Icon name="mdi:share-variant" class="w-3.5 h-3.5" />
                    </div>
                    <div class="flex items-center justify-center w-6 h-6 rounded bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white transition-all"
                         title="Remove from Favorite"
                         @click.stop="toggleFavourite(file)">
                      <Icon name="mdi:star" class="w-3.5 h-3.5" />
                    </div>
                  </div>
                  
                  <span v-if="!file.isFolder" class="hidden sm:inline w-20 text-right">{{ formatSize(file.size) }}</span>
                  <span v-else class="hidden sm:inline w-20 text-right">&nbsp;</span>
                  
                  <span class="hidden md:inline w-24 text-right">{{ new Date(file.lastModified).toLocaleDateString() }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Placeholder -->
          <div v-else :class="isGridView ? 'flex flex-col gap-2' : 'h-[56px] bg-base-100/30 rounded-lg border border-dashed border-base-content/10'">
            <div v-if="isGridView" class="aspect-square bg-base-100/30 rounded-lg border border-dashed border-base-content/10"></div>
            <div v-if="isGridView" class="h-[40px]"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="flex flex-col items-center justify-center py-24 text-center">
        <div class="bg-base-200/50 p-6 rounded-xl mb-6">
          <Icon name="mdi:star-outline" class="w-16 h-16 text-base-content/10" />
        </div>
        <h3 class="text-xl font-bold tracking-tight text-base-content">Your star collection is empty</h3>
        <p class="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">Favorite files and folders to see them here for lightning-fast access.</p>
        <NuxtLink to="/files" class="btn btn-primary btn-sm mt-8 px-8 rounded-lg shadow-sm font-bold uppercase tracking-widest text-[10px]">
          Go to Files
        </NuxtLink>
      </div>
    </main>

    <!-- Context Menu -->
    <transition name="fade">
      <div v-if="showContextMenu" 
           class="fixed bg-base-100 shadow-xl rounded-lg border border-base-content/10 z-[100] py-1.5 min-w-[180px] backdrop-blur-xl bg-base-100/90"
           :style="{ top: contextMenuY + 'px', left: contextMenuX + 'px' }"
           @click.stop>
        <ul class="menu menu-compact p-0 font-bold text-[10px] uppercase tracking-wider">
          <li><a class="py-2.5 px-4 hover:text-primary transition-colors" @click="handleContextAction('open')"><Icon name="mdi:open-in-new" class="w-4 h-4" /> Open Original</a></li>
          <li v-if="contextMenuFile && isVideoFile(contextMenuFile.name)">
            <a class="py-2.5 px-4 hover:text-primary transition-colors" @click="handleContextAction('media')">
              <Icon name="mdi:play-box-multiple-outline" class="w-4 h-4" /> Media Tab
            </a>
          </li>
          <li v-if="contextMenuFile?.isFolder && contextMenuFile.meta?.previewImage">
            <a class="py-2.5 px-4 hover:text-primary transition-colors" @click="handleContextAction('reset-folder-icon')">
              <Icon name="mdi:folder-refresh-outline" class="w-4 h-4 text-primary" /> Reset Folder Icon
            </a>
          </li>
          <div class="h-px bg-base-content/5 mx-2 my-1"></div>
          <li><a class="py-2.5 px-4" @click="handleContextAction('rename')"><Icon name="mdi:pencil" class="w-4 h-4 text-blue-500" /> Rename</a></li>
          <li><a class="py-2.5 px-4" @click="handleContextAction('move')"><Icon name="mdi:folder-move" class="w-4 h-4 text-primary" /> Move</a></li>
          <li><a class="py-2.5 px-4" @click="handleContextAction('description')"><Icon name="mdi:text-box-edit-outline" class="w-4 h-4 text-orange-500" /> Edit Notes</a></li>
          <li><a class="py-2.5 px-4" @click="handleContextAction('info')"><Icon name="mdi:information" class="w-4 h-4 text-primary" /> Details</a></li>
          <li><a class="py-2.5 px-4" @click="handleContextAction('favourite')">
            <Icon name="mdi:star" class="w-4 h-4 text-orange-500" /> Unstar
          </a></li>
          <li><a class="py-2.5 px-4" @click="handleContextAction('download')"><Icon name="mdi:download" class="w-4 h-4 text-success" /> Download</a></li>
          <div class="h-px bg-base-content/5 mx-2 my-1"></div>
          <li><a class="py-2.5 px-4 text-error" @click="handleContextAction('delete')"><Icon name="mdi:delete" class="w-4 h-4" /> Delete</a></li>
        </ul>
      </div>
    </transition>

    <!-- File Info Modal -->
    <div class="modal backdrop-blur-md" :class="{ 'modal-open': showFileInfoModal }" @click="closeFileModal">
      <div class="modal-box rounded-xl shadow-xl p-0 max-w-2xl border border-base-content/10 overflow-hidden flex flex-col max-h-[90vh]" @click.stop>
        <!-- Modal Header -->
        <div class="bg-base-200/30 p-6 border-b border-base-content/10 shrink-0">
          <div class="flex items-center gap-4">
            <div class="bg-base-100 p-3 rounded-lg border border-base-content/10 shadow-sm shrink-0">
              <Icon
                  :name="selectedFile?.isFolder ? 'vscode-icons:default-folder' : getIconForExtension(selectedFile?.name || '')"
                  class="w-10 h-10"
              />
            </div>
            <div class="min-w-0">
              <h3 class="font-bold text-lg tracking-tight truncate text-base-content">{{ selectedFile?.name.split('/').pop() }}</h3>
              <p class="text-[9px] font-bold text-base-content/30 truncate mb-0.5">{{ selectedFile?.name }}</p>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-[9px] font-bold uppercase tracking-widest text-base-content/40">
                  {{ selectedFile?.isFolder ? 'Folder' : 'Document' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Scrollable Content -->
        <div v-if="selectedFile" class="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
          <!-- Main Visual Preview -->
          <div v-if="!selectedFile.isFolder && (isVideoFile(selectedFile.name) || isImageFile(selectedFile.name))" class="w-full">
             <div class="flex items-center gap-2 mb-3">
                <span class="text-[9px] font-bold uppercase tracking-widest text-base-content/30">File Preview</span>
             </div>
             <div :key="selectedFile.name" class="rounded-lg overflow-hidden border border-base-content/10 bg-black flex items-center justify-center aspect-video group/preview relative">
                <video v-if="isVideoFile(selectedFile.name)" id="previewVideo" controls class="w-full h-full object-contain">
                  <source :src="getStaticUrl(selectedFile)" type="video/mp4" />
                </video>
                <img v-else-if="isImageFile(selectedFile.name)" :src="getStaticUrl(selectedFile)" class="w-full h-full object-contain transition-transform duration-300 group-hover/preview:scale-105 cursor-pointer" @click="selectedImageUrl = getStaticUrl(selectedFile), showImageViewerModal = true" />
             </div>
          </div>

          <!-- Stats Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div v-if="!selectedFile.isFolder" class="bg-base-200/50 p-4 rounded-lg flex flex-col gap-0.5 border border-base-content/10">
              <span class="text-[9px] font-bold uppercase tracking-widest text-base-content/30">Size</span>
              <span class="text-sm font-bold text-base-content">{{ formatSize(selectedFile.size) }}</span>
            </div>
            <div class="bg-base-200/50 p-4 rounded-lg flex flex-col gap-0.5 border border-base-content/10" :class="{ 'col-span-2': selectedFile.isFolder }">
              <span class="text-[9px] font-bold uppercase tracking-widest text-base-content/30">Modified</span>
              <span class="text-sm font-bold text-base-content">{{ new Date(selectedFile.lastModified).toLocaleDateString() }}</span>
            </div>
            <div class="bg-base-200/50 p-4 rounded-lg flex flex-col gap-0.5 border border-base-content/10">
              <span class="text-[9px] font-bold uppercase tracking-widest text-base-content/30">Access</span>
              <span class="text-sm font-bold text-success uppercase tracking-wider">Writeable</span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- Left Column: Notes & Tags -->
            <div class="space-y-6">
              <div>
                <div class="flex items-center justify-between mb-3">
                  <span class="text-[9px] font-bold uppercase tracking-widest text-base-content/30">Description / Notes</span>
                  <button v-if="!isEditingDescription" class="btn btn-ghost btn-xs rounded-md h-6 font-bold text-[9px] uppercase tracking-wider" @click="startEditDescription">
                    Edit
                  </button>
                </div>
                
                <div v-if="isEditingDescription" class="space-y-3">
                  <textarea
                      v-model="editableDescription"
                      class="textarea textarea-bordered w-full h-24 bg-base-100 focus:bg-base-100 transition-all font-bold text-xs rounded-lg"
                      placeholder="Add some notes about this file..."
                  ></textarea>
                  <div class="flex justify-end gap-2">
                    <button class="btn btn-ghost btn-xs h-7 rounded-md px-3 font-bold text-[9px] uppercase" @click="isEditingDescription = false">Cancel</button>
                    <button class="btn btn-primary btn-xs h-7 rounded-md px-4 font-bold text-[9px] uppercase" @click="saveDescription">Save</button>
                  </div>
                </div>
                <div v-else>
                  <div v-if="selectedFile.meta.description" class="bg-base-200/30 p-4 rounded-lg text-xs font-bold leading-relaxed text-base-content/70 border border-base-content/10">
                    {{ selectedFile.meta.description }}
                  </div>
                  <button v-else class="w-full border border-dashed border-base-content/20 rounded-lg py-6 font-bold text-base-content/30 text-[10px] uppercase tracking-widest hover:border-primary/30 hover:bg-primary/5 transition-all" @click="startEditDescription">
                    Add description
                  </button>
                </div>
              </div>

              <div>
                <span class="text-[9px] font-bold uppercase tracking-widest text-base-content/30 mb-3 block">Tags</span>
                <div class="flex flex-wrap gap-2 items-center bg-base-200/30 p-3 rounded-lg border border-base-content/10">
                    <span v-for="tag in (selectedFile.meta.tags || [])"
                          :key="tag.name"
                          class="badge badge-sm border-none text-white font-bold py-2.5 px-3 shadow-sm rounded-md"
                          :style="{ backgroundColor: tag.color }"> 
                      {{ tag.name }} 
                      <Icon name="mdi:close" 
                            class="w-3 h-3 ml-1.5 cursor-pointer opacity-50 hover:opacity-100" 
                            @click.stop="removeTag(tag)" />
                    </span>
                    
                    <button
                      class="btn btn-ghost btn-xs bg-base-100 hover:bg-base-200 border border-base-content/10 rounded-md px-3 h-7 transition-all font-bold text-[9px] uppercase tracking-wider"
                      @click="openSingleTagModal"
                    >
                      <Icon name="mdi:plus" class="w-3.5 h-3.5 mr-1 text-primary" /> 
                      Add
                    </button>
                </div>
              </div>
            </div>

            <!-- Right Column: Settings -->
            <div class="space-y-6">
              <div class="bg-base-100 rounded-lg p-5 border border-base-content/10 space-y-5 shadow-sm">
                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-xs font-bold tracking-tight text-base-content uppercase">Favorite</span>
                    <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">Pin for quick access</p>
                  </div>
                  <button 
                    class="btn btn-xs btn-ghost btn-circle rounded-md h-8 w-8 bg-base-200/50 text-orange-500"
                    @click="toggleFavourite(selectedFile)"
                  >
                    <Icon name="mdi:star" class="w-4 h-4" />
                  </button>
                </div>

                <div class="h-px bg-base-content/5"></div>

                <div class="flex items-center justify-between">
                  <div>
                    <span class="text-xs font-bold tracking-tight text-base-content uppercase">Public Access</span>
                    <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">Share via link</p>
                  </div>
                  <input type="checkbox" class="toggle toggle-success toggle-xs rounded-sm" :checked="selectedFile.meta.isPublic" @change="togglePublicAccess" />
                </div>
                
                <transition name="fade">
                  <div v-if="selectedFile.meta.isPublic" class="bg-success/5 p-3 rounded-lg flex flex-col gap-2 border border-success/10">
                    <p class="text-[9px] font-bold text-success uppercase tracking-widest">Link Active</p>
                    <button class="btn btn-xs btn-success text-white w-full rounded-md font-bold uppercase tracking-wider h-8 shadow-sm" @click="copyPublicLink">
                      <Icon name="mdi:content-copy" class="w-3.5 h-3.5 mr-1.5" />
                      Copy Link
                    </button>
                  </div>
                </transition>
              </div>
            </div>
          </div>
        </div>

        <!-- Sticky Footer -->
        <div class="p-4 bg-base-100 border-t border-base-content/10 flex items-center justify-between gap-3 px-6 shrink-0">
          <button class="btn btn-sm btn-error btn-ghost font-bold text-[10px] uppercase tracking-widest rounded-md px-4" @click="deleteFile(selectedFile)">
            Delete
          </button>
          <div class="flex gap-2">
            <button class="btn btn-sm bg-base-200 hover:bg-base-300 border-none font-bold text-[10px] uppercase tracking-widest rounded-md px-4" @click="downloadFile(selectedFile)">
              Download
            </button>
            <button class="btn btn-sm btn-primary font-bold text-[10px] uppercase tracking-widest rounded-md px-8 shadow-sm" @click="closeFileModal">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Image Viewer -->
    <div class="modal image-viewer-modal backdrop-blur-md" :class="{ 'modal-open': showImageViewerModal }" @click="closeImageViewer">
      <div class="modal-box-image p-2 bg-transparent border-none shadow-none" @click.stop>
        <div class="relative group">
          <img :src="selectedImageUrl" alt="Full size preview" class="max-h-[85vh] max-w-[90vw] rounded-lg shadow-2xl ring-1 ring-white/10" />
          <button class="btn btn-circle btn-xs absolute -top-3 -right-3 bg-base-100 shadow-lg border-none" @click="closeImageViewer">✕</button>
        </div>
      </div>
    </div>

    <!-- Move Modal -->
    <div v-if="showMoveModal" class="modal modal-open backdrop-blur-md">
      <div class="modal-box rounded-xl shadow-xl p-0 max-w-md border border-base-content/10 overflow-hidden flex flex-col max-h-[75vh]">
        <div class="bg-base-200/30 p-5 border-b border-base-content/10 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <Icon name="mdi:folder-move" class="w-5 h-5 text-primary" />
            <div>
              <h3 class="font-bold text-base tracking-tight text-base-content">Move Items</h3>
              <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">Select destination</p>
            </div>
          </div>
          <button class="btn btn-ghost btn-xs btn-circle" @click="showMoveModal = false">
            <Icon name="mdi:close" class="w-4 h-4" />
          </button>
        </div>

        <!-- Breadcrumbs for picker -->
        <div class="px-4 py-2.5 bg-base-100 border-b border-base-content/5 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <button 
            class="btn btn-xs btn-ghost gap-1 px-1.5 h-7 rounded-md font-bold text-[9px] uppercase tracking-wider"
            @click="fetchPickerFolders('')"
          >
            Root
          </button>
          <template v-for="(part, index) in pickerCurrentPath.split('/')" :key="index">
            <Icon v-if="part" name="mdi:chevron-right" class="w-3 h-3 opacity-30" />
            <button 
              v-if="part"
              class="btn btn-xs btn-ghost gap-1 px-1.5 h-7 rounded-md font-bold text-[9px] uppercase tracking-wider max-w-[100px] truncate"
              @click="fetchPickerFolders(pickerCurrentPath.split('/').slice(0, index + 1).join('/'))"
            >
              {{ part }}
            </button>
          </template>
        </div>

        <div class="flex-1 overflow-y-auto p-2 min-h-[240px] custom-scrollbar">
          <div v-if="pickerCurrentPath" 
               class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-base-200/50 cursor-pointer group"
               @click="navigatePickerUp">
            <Icon name="mdi:arrow-up" class="w-4 h-4 text-base-content/30 group-hover:text-primary" />
            <span class="text-xs font-bold text-base-content/70">Go Up</span>
          </div>

          <div v-for="folder in pickerFolders" 
               :key="folder.name"
               class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-base-200/50 cursor-pointer group"
               @click="navigatePicker(folder.name)">
            <Icon name="vscode-icons:default-folder" class="w-4 h-4" />
            <div class="flex-grow min-w-0">
              <span class="text-xs font-bold truncate block text-base-content">{{ folder.name }}</span>
            </div>
            <Icon name="mdi:chevron-right" class="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
          </div>
        </div>

        <div class="p-4 bg-base-100 border-t border-base-content/10 flex items-center justify-between gap-4 shrink-0">
          <div class="min-w-0 flex-1">
            <p class="text-[8px] font-bold uppercase tracking-[0.2em] text-base-content/30 mb-0.5">Move to</p>
            <p class="text-[10px] font-bold truncate text-primary uppercase tracking-wider">/{{ pickerCurrentPath || 'Root' }}</p>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-xs h-8 px-4 rounded-md font-bold uppercase tracking-widest text-[9px]" @click="showMoveModal = false">Cancel</button>
            <button 
              class="btn btn-xs btn-primary h-8 px-6 rounded-md font-bold uppercase tracking-widest text-[9px] shadow-sm"
              @click="executeMove"
              :disabled="isMoving"
            >
              <span v-if="isMoving" class="loading loading-spinner loading-xs mr-1"></span>
              Move Here
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tag Modal -->
    <div v-if="showTagModal" class="modal modal-open backdrop-blur-md">
      <div class="modal-box rounded-xl shadow-xl p-8 max-w-sm border border-base-content/10">
        <div class="flex items-center gap-3 mb-8">
          <div class="bg-primary/10 p-2.5 rounded-lg border border-primary/10 text-primary">
            <Icon name="mdi:tag-multiple" class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-bold text-base tracking-tight text-base-content">Manage Tags</h3>
            <p class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest">Add tags to your favorites</p>
          </div>
        </div>

        <div v-if="taggingProgress" class="text-center py-10">
          <div class="loading loading-spinner loading-lg text-primary mb-4"></div>
          <p class="font-bold text-[10px] uppercase tracking-widest text-base-content/60">
            Applying tags... {{ taggingProgress.current }} / {{ taggingProgress.total }}
          </p>
        </div>
        <div v-else-if="showNewTagForm" class="space-y-5">
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">Tag Name</span>
            </label>
            <input
              v-model="newTagName"
              type="text"
              placeholder="Work, Personal, Favorites..."
              class="input input-bordered w-full bg-base-200/50 focus:bg-base-100 transition-all font-bold text-xs h-11 rounded-lg border-base-content/10"
            />
          </div>
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">Tag Color</span>
            </label>
            <div class="flex gap-3 items-center">
              <input
                v-model="newTagColor"
                type="color"
                class="w-11 h-11 rounded-lg cursor-pointer border-none bg-base-200/50"
              />
              <div class="flex-grow h-11 rounded-lg flex items-center px-4 font-bold text-[11px] bg-base-200/50 border border-dashed border-base-content/10 uppercase tracking-widest" :style="{ color: newTagColor }">
                 Color Preview
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2 mt-10">
            <button class="btn btn-primary btn-sm h-10 rounded-lg shadow-sm font-bold uppercase tracking-widest text-[10px]" @click="bulkAddTags">Create & Apply</button>
            <button class="btn btn-ghost btn-sm h-10 rounded-lg font-bold uppercase tracking-widest text-[10px]" @click="showNewTagForm = false">Existing Tags</button>
            <button class="btn btn-ghost btn-sm h-10 rounded-lg font-bold uppercase tracking-widest text-[10px] text-error/60" @click="closeTagModal">Cancel</button>
          </div>
        </div>

        <div v-else class="space-y-5">
          <div class="form-control">
            <label class="label py-1">
              <span class="label-text font-bold text-[10px] uppercase tracking-widest text-base-content/40">Select Existing Tags</span>
            </label>
            <div class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              <div
                v-for="tag in predefinedTags"
                :key="tag.name"
                class="p-3 rounded-lg cursor-pointer text-center font-bold text-[9px] uppercase tracking-wider transition-all border border-base-content/10"
                :style="{ 
                  borderColor: isTagSelected(tag) ? tag.color : '',
                  backgroundColor: isTagSelected(tag) ? tag.color : 'transparent', 
                  color: isTagSelected(tag) ? 'white' : tag.color
                }"
                @click="toggleTagSelection(tag)"
              >
                {{ tag.name }}
              </div>
            </div>
          </div>
          <div class="flex flex-col gap-2 mt-10">
            <button class="btn btn-primary btn-sm h-10 rounded-lg shadow-sm font-bold uppercase tracking-widest text-[10px]" @click="bulkAddTags">Apply Selection</button>
            <button class="btn btn-ghost btn-sm h-10 rounded-lg font-bold uppercase tracking-widest text-[10px]" @click="showNewTagForm = true">New Tag</button>
            <button class="btn btn-ghost btn-sm h-10 rounded-lg font-bold uppercase tracking-widest text-[10px] text-error/60" @click="closeTagModal">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s ease-out; }
.slide-down-enter-from, .slide-down-leave-to { transform: translateY(-100%); opacity: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); border-radius: 10px; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
.image-viewer-modal { background-color: rgba(0, 0, 0, 0.4); display: flex !important; align-items: center; justify-content: center; z-index: 10000; }
.modal-box-image img { user-select: none; }
</style>
