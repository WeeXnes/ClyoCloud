<script setup lang="ts">
import { useState } from 'nuxt/app'
const user = useState<{ name: string } | null>('user')
</script>

<template>
  <div>
    <h1>Debug stuff</h1>
    <h1>Logged in as {{ user?.name }}</h1>
  </div>
</template>

<style scoped>

</style>