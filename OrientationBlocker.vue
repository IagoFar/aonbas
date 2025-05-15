<template>
  <div>
    <div v-if="showBlocker" class="orientation-blocker">
      <div class="blocker-content">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64">
          <path fill="currentColor" d="M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 9h-5.5v12H22V9z"/>
        </svg>
        <p>Please rotate your device to portrait mode</p>
      </div>
    </div>
    <slot v-if="!isDesktop && !showBlocker"></slot>
    <div v-else class="desktop-blocker">
      <div class="blocker-content">
        <p>This application is only available on mobile devices</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isLandscape = ref(false)
const isDesktop = ref(false)
const showBlocker = ref(false)

// Check if device is desktop
const checkDeviceType = () => {
  isDesktop.value = window.innerWidth > 1024
}

// Check if orientation is landscape or exceeds max size
const checkOrientation = () => {
  const width = window.innerWidth
  const height = window.innerHeight

  isLandscape.value = width > height
  showBlocker.value = isLandscape.value || width > 600 || height > 1000
}

// Add event listeners for resize and orientation change
onMounted(() => {
  checkDeviceType()
  checkOrientation()
  window.addEventListener('resize', checkOrientation)
  window.addEventListener('orientationchange', checkOrientation)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkOrientation)
  window.removeEventListener('orientationchange', checkOrientation)
})
</script>

<style scoped>
.orientation-blocker,
.desktop-blocker {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  text-align: center;
  z-index: 9999;
}

.blocker-content {
  max-width: 90%;
}

html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

body {
  max-width: 600px;
  max-height: 1000px;
  margin: auto;
}
</style>