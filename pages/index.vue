<template>
  <div>
    <div class="flex justify-between items-center mb-4 lg:mb-6">
      <div class="flex items-center gap-2">
        <label for="sidebar-drawer" class="btn btn-ghost btn-circle lg:hidden">
          <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" />
          </svg>
        </label>
        <h2 class="text-lg lg:text-xl font-semibold">Home</h2>
      </div>
    </div>

    <div class="text-center">
      <h2 class="text-2xl font-bold">Welcome to Clyo Cloud</h2>
      <p class="mt-4">Your personal cloud storage solution.</p>
      
      <div class="mt-6">
        <NuxtLink to="/files" class="btn btn-primary">Go to Files</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>
