<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { SlideshowMedia } from '~/types/File'

const props = defineProps<{
  media: SlideshowMedia
  isActive: boolean
  isAutoscrollEnabled: boolean
}>()

const emit = defineEmits(['completed'])

const currentIndex = ref(0)
const timer = ref<any>(null)
const transitionName = ref('slide-right')

const getImageUrl = (fullPath: string) => {
  const url = useRequestURL()
  const baseUrl = url.origin
  return `${baseUrl}/file/${encodeURIComponent(fullPath)}`
}

const nextImage = (isAuto = false) => {
  transitionName.value = 'slide-right'
  if (currentIndex.value < props.media.images.length - 1) {
    currentIndex.value++
  } else {
    if (isAuto && props.isAutoscrollEnabled) {
      emit('completed')
    } else {
      currentIndex.value = 0
    }
  }
  resetTimer()
}

const prevImage = () => {
  transitionName.value = 'slide-left'
  if (currentIndex.value > 0) {
    currentIndex.value--
  } else {
    currentIndex.value = props.media.images.length - 1
  }
  resetTimer()
}

const startTimer = () => {
  stopTimer()
  if (props.isActive) {
    timer.value = setInterval(() => {
      nextImage(true)
    }, 5000)
  }
}

const stopTimer = () => {
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
}

const resetTimer = () => {
  if (props.isActive) {
    startTimer()
  }
}

const touchStartX = ref(0)
const touchEndX = ref(0)

const handleTouchStart = (event: TouchEvent) => {
  touchStartX.value = event.touches[0].clientX
}

const handleTouchEnd = (event: TouchEvent) => {
  touchEndX.value = event.changedTouches[0].clientX
  handleSwipe()
}

const handleSwipe = () => {
  const swipeThreshold = 50
  const diff = touchEndX.value - touchStartX.value
  
  if (Math.abs(diff) > swipeThreshold) {
    if (diff > 0) {
      prevImage()
    } else {
      nextImage()
    }
  }
}

const handleInteraction = (event: MouseEvent) => {
  // Ignore clicks if on mobile where we use touch
  if (window.innerWidth < 768) return

  const width = (event.currentTarget as HTMLElement).clientWidth
  const x = event.offsetX
  if (x < width / 3) {
    prevImage()
  } else {
    nextImage()
  }
}

watch(() => props.isActive, (active) => {
  if (active) {
    startTimer()
  } else {
    stopTimer()
    currentIndex.value = 0
  }
})

onMounted(() => {
  if (props.isActive) {
    startTimer()
  }
})

onUnmounted(() => {
  stopTimer()
})
</script>

<template>
  <div 
    class="h-full w-full relative overflow-hidden flex items-center justify-center bg-black group" 
    @click="handleInteraction"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
  >
    <!-- Images -->
    <div class="relative w-full h-full flex items-center justify-center">
      <transition :name="transitionName" mode="out-in">
        <img
          :key="media.images[currentIndex]"
          :src="getImageUrl(media.images[currentIndex])"
          class="max-h-full max-w-full object-contain pointer-events-none select-none"
          alt="Slideshow Image"
        />
      </transition>
    </div>

    <!-- Indicator Dots -->
    <div class="absolute bottom-32 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-none">
      <div
        v-for="(_, index) in media.images"
        :key="index"
        class="w-1.5 h-1.5 rounded-full transition-all duration-300"
        :class="index === currentIndex ? 'bg-white scale-125 shadow-lg' : 'bg-white/30 scale-100'"
      ></div>
    </div>

    <!-- Navigation Hints (Desktop/Hover) -->
    <div class="absolute inset-y-0 left-0 w-1/3 cursor-pointer z-10 hidden md:block"></div>
    <div class="absolute inset-y-0 right-0 w-2/3 cursor-pointer z-10 hidden md:block"></div>
    
    <!-- Navigation Buttons (Desktop) -->
    <button @click.stop="prevImage" class="absolute left-4 top-1/2 -translate-y-1/2 btn btn-circle btn-ghost bg-black/20 text-white opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex z-30">
      <Icon name="mdi:chevron-left" class="w-8 h-8" />
    </button>
    <button @click.stop="nextImage" class="absolute right-4 top-1/2 -translate-y-1/2 btn btn-circle btn-ghost bg-black/20 text-white opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex z-30">
      <Icon name="mdi:chevron-right" class="w-8 h-8" />
    </button>
  </div>
</template>

<style scoped>
.slide-right-enter-active,
.slide-right-leave-active,
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s ease-out;
}

.slide-right-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.slide-right-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

.slide-left-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}
.slide-left-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
