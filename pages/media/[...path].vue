<template>
  <div class="max-w-screen-xl mx-auto px-4 py-6">
    <!-- Video Player -->
    <div class="w-full">
      <video
          id="previewVideo"
          controls
          class="w-full rounded-lg aspect-video bg-black"
      >
        <source src="" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
    </div>

    <!-- Video Info and Sidebar -->
    <div class="mt-6 flex flex-col lg:flex-row gap-8">
      <!-- Left: Video Title & Description -->
      <div class="flex-1">
        <!-- Title -->
        <h1 class="text-2xl font-bold mb-2">
          Sample Video Title
        </h1>

        <!-- Metadata -->
        <div class="text-sm text-gray-500 mb-4">
          10,000 views • Sep 30, 2025
        </div>

        <!-- Description -->
        <div class="bg-gray-100 p-4 rounded-lg text-sm text-gray-700 whitespace-pre-line">
          This is a sample description for the video. You can add links, hashtags, and any text content here to mimic a real social media video description section.
        </div>
      </div>

      <!-- Right: Recommended Videos -->
      <div class="w-full lg:w-80">
        <h2 class="text-lg font-semibold mb-4">Recommended Videos</h2>
        <div class="space-y-4">
          <!-- Video Card -->
          <div class="flex gap-3 hover:bg-gray-100 p-2 rounded-lg cursor-pointer">
            <img
                src="https://via.placeholder.com/120x67"
                alt="Thumbnail"
                class="w-32 h-auto rounded"
            />
            <div class="flex flex-col">
              <p class="font-medium line-clamp-2">Another Cool Video Title</p>
              <span class="text-sm text-gray-500">Uploader Name • 20K views</span>
            </div>
          </div>

          <!-- Repeat for more recommended videos -->
          <div class="flex gap-3 hover:bg-gray-100 p-2 rounded-lg cursor-pointer">
            <img
                src="https://via.placeholder.com/120x67"
                alt="Thumbnail"
                class="w-32 h-auto rounded"
            />
            <div class="flex flex-col">
              <p class="font-medium line-clamp-2">Interesting Tutorial You Might Like</p>
              <span class="text-sm text-gray-500">Tech Channel • 5K views</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">

import type {File} from "~/types/File";

const getStaticUrl = () => {
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


const isVideoFile = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ['mp4', 'webm'].includes(ext)
}

</script>

<style scoped>
/* Tailwind handles most styling. Additional tweaks below. */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>






