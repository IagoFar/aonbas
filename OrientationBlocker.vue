<template>
  <div>
    <div v-if="showBlocker" class="orientation-blocker">
      <div class="blocker-content">
        <div class="rotate-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="64" height="64">
            <path fill="currentColor" d="M7.5 21H2V9h5.5v12zm7.25-18h-5.5v18h5.5V3zM22 9h-5.5v12H22V9z"/>
          </svg>
        </div>
        <p>Please rotate your device to portrait mode</p>
      </div>
    </div>
    <slot v-if="!isDesktop"></slot>
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
  // Simple check: if window width is greater than typical tablet size
  isDesktop.value = window.innerWidth > 1024
}

// Check if orientation is landscape
const checkOrientation = () => {
  isLandscape.value = window.innerWidth > window.innerHeight
  showBlocker.value = isLandscape.value && !isDesktop.value
}

// Handle orientation change
const handleOrientationChange = () => {
  checkOrientation()
}

// Handle resize (for desktop detection)
const handleResize = () => {
  checkDeviceType()
  checkOrientation()
}

onMounted(() => {
  if (import.meta.client) {
    checkDeviceType()
    checkOrientation()
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleOrientationChange)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('orientationchange', handleOrientationChange)
  }
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
  background-color: #ffffff;
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
}

.blocker-content {
  text-align: center;
  padding: 20px;
}

.rotate-icon {
  animation: rotate 2s infinite ease-in-out;
  margin-bottom: 20px;
  color: #333;
}

@keyframes rotate {
  0% { transform: rotate(0deg); }
  50% { transform: rotate(90deg); }
  100% { transform: rotate(0deg); }
}
</style>