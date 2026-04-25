<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { createNotification } from '~/core/notificationManager'
import { NotificationType } from '~/types/Notification'
import type { Tag } from '~/types/File'
import { useState } from 'nuxt/app'

const newPassword = ref('')
const confirmPassword = ref('')
const isChangingPassword = ref(false)

const tags = ref<Tag[]>([])
const newTagName = ref('')
const newTagColor = ref('#4B5EAA')
const isSavingTags = ref(false)

const user = useState<{ name: string } | null>('user')

async function fetchTags() {
  try {
    const response = await fetch('/api/tags', { credentials: 'include' })
    if (response.ok) {
      tags.value = await response.json()
    }
  } catch (err) {
    console.error('Error fetching tags:', err)
  }
}

onMounted(() => {
  fetchTags()
})

async function changePassword() {
  if (newPassword.value !== confirmPassword.value) {
    createNotification('Passwords do not match', NotificationType.WARNING)
    return
  }
  if (newPassword.value.length < 6) {
    createNotification('Password must be at least 6 characters', NotificationType.WARNING)
    return
  }

  isChangingPassword.value = true
  try {
    const response = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: newPassword.value }),
    })

    if (!response.ok) throw new Error('Failed to change password')

    createNotification('Password updated successfully', NotificationType.SUCCESS)
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    createNotification('Failed to update password', NotificationType.ERROR)
  } finally {
    isChangingPassword.value = false
  }
}

async function addTag() {
  if (!newTagName.value.trim()) return
  
  const tagExists = tags.value.some(t => t.name.toLowerCase() === newTagName.value.toLowerCase())
  if (tagExists) {
    createNotification('Tag already exists', NotificationType.WARNING)
    return
  }

  tags.value.push({ name: newTagName.value, color: newTagColor.value })
  newTagName.value = ''
  await saveTags()
}

async function removeTag(index: number) {
  tags.value.splice(index, 1)
  await saveTags()
}

async function saveTags() {
  isSavingTags.value = true
  try {
    const response = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: tags.value }),
    })

    if (!response.ok) throw new Error('Failed to save tags')
    createNotification('Tags updated', NotificationType.SUCCESS)
  } catch (err) {
    createNotification('Failed to save tags', NotificationType.ERROR)
  } finally {
    isSavingTags.value = false
  }
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' })
    user.value = null
    navigateTo('/login')
  } catch (err) {
    createNotification('Failed to logout', NotificationType.ERROR)
  }
}
</script>

<template>
  <div class="container mx-auto p-4 lg:p-6 max-w-4xl">
    <div class="flex items-center gap-2 mb-6">
      <label for="sidebar-drawer" class="btn btn-ghost btn-circle lg:hidden">
        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
        </svg>
      </label>
      <h2 class="text-2xl font-bold">Settings</h2>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      <!-- Change Password Section -->
      <section class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h3 class="card-title mb-4">Change Password</h3>
          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">New Password</span>
            </label>
            <input 
              v-model="newPassword" 
              type="password" 
              placeholder="Min 6 characters" 
              class="input input-bordered w-full" 
            />
          </div>
          <div class="form-control w-full mt-2">
            <label class="label">
              <span class="label-text">Confirm Password</span>
            </label>
            <input 
              v-model="confirmPassword" 
              type="password" 
              class="input input-bordered w-full" 
            />
          </div>
          <div class="card-actions mt-6">
            <button 
              class="btn btn-primary w-full" 
              @click="changePassword" 
              :disabled="isChangingPassword"
            >
              <span v-if="isChangingPassword" class="loading loading-spinner"></span>
              Update Password
            </button>
          </div>
        </div>
      </section>

      <!-- Manage Tags Section -->
      <section class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h3 class="card-title mb-4">Predefined Tags</h3>
          
          <div class="flex flex-wrap gap-2 mb-6 min-h-[40px] p-2 bg-base-200 rounded-lg">
            <div 
              v-for="(tag, index) in tags" 
              :key="tag.name" 
              class="badge badge-lg gap-2 text-white border-none h-auto py-1"
              :style="{ backgroundColor: tag.color }"
            >
              {{ tag.name }}
              <button @click="removeTag(index)" class="hover:text-base-300">
                <Icon name="ic:baseline-close" class="w-4 h-4" />
              </button>
            </div>
            <p v-if="tags.length === 0" class="text-sm text-base-content/50 self-center mx-auto">No tags defined</p>
          </div>

          <div class="divider">Add New Tag</div>

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text">Tag Name</span>
            </label>
            <input 
              v-model="newTagName" 
              type="text" 
              placeholder="Tag name" 
              class="input input-bordered w-full" 
            />
          </div>
          <div class="form-control w-full mt-2">
            <label class="label">
              <span class="label-text">Tag Color</span>
            </label>
            <div class="flex gap-2">
              <input 
                v-model="newTagColor" 
                type="color" 
                class="input input-bordered w-16 h-12 p-1" 
              />
              <input 
                v-model="newTagColor" 
                type="text" 
                class="input input-bordered flex-1" 
              />
            </div>
          </div>
          <div class="card-actions mt-6">
            <button 
              class="btn btn-secondary w-full" 
              @click="addTag" 
              :disabled="isSavingTags"
            >
              Add Tag
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- Danger Zone -->
    <section class="card bg-base-100 shadow-xl mt-8 border border-error/20">
      <div class="card-body flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h3 class="card-title text-error">Logout</h3>
          <p class="text-sm text-base-content/70">Sign out of your account on this device.</p>
        </div>
        <button class="btn btn-error" @click="logout">
          <Icon name="material-symbols:logout" class="w-5 h-5" />
          Log Out
        </button>
      </div>
    </section>
  </div>
</template>
