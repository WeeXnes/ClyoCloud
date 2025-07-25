<template>
  <div class="min-h-screen bg-base-200" data-theme="onedev">
    <div class="drawer lg:drawer-open">
      <input id="sidebar-drawer" type="checkbox" class="drawer-toggle" />
      <div class="drawer-content flex flex-col">
        <div class="flex-1 p-4 lg:p-6">
          <NuxtPage />
        </div>
      </div>
      <div class="drawer-side">
        <label for="sidebar-drawer" class="drawer-overlay"></label>
        <div class="w-64 bg-base-100 shadow-xl h-full">
          <div v-if="false" class="p-4 flex items-center space-x-4">
            <img src="/clyo.png" alt="Clyo" class="h-6 lg:h-8" />
            <h1 class="text-xl lg:text-2xl font-bold text-primary">Clyo Cloud</h1>
          </div>
          <ul class="menu menu-compact flex flex-col p-4">
            <li>
              <NuxtLink to="/">
                <Icon name="ic:baseline-house" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" />
                Home
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/files">
                <Icon name="ic:round-folder" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" />
                Folders
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/shared">
                <Icon name="ic:round-folder-shared" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" />
                Shared
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>