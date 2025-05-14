<template>
  <div class="relative px-4 py-6">
    <!-- Línea base completa -->
    <div class="absolute left-0 right-0 top-1/2 h-1" :style="{ backgroundColor: '#ccc' }"></div>

    <!-- Línea coloreada hasta estación actual -->
    <div
      v-if="currentIndex > 0"
      class="absolute left-0 top-1/2 h-1"
      :style="{ width: `${(currentIndex / (stations.length - 1)) * 100}%`, backgroundColor: lineColor }"
    ></div>

    <!-- Contenedor de estaciones -->
    <div class="relative z-10" style="height: 2rem;">
      <!-- Estaciones -->
      <div
        v-for="(station, i) in stations"
        :key="station.name || i"
        class="absolute flex flex-col items-center"
        :style="{
          left: stations.length === 1 ? '50%' : `${(i / (stations.length - 1)) * 100}%`,
          transform: 'translateX(-50%)'
        }"
      >
        <!-- Icono estación -->
        <div class="h-4 flex items-center justify-center">
          <div
            v-if="station.correspondence"
            class="rounded-full bg-white"
            :style="{
              width: '16px',
              height: '16px',
              border: `3px solid ${i <= currentIndex ? lineColor : '#999'}`
            }"
          ></div>
          <div
            v-else
            :style="{
              width: '4px',
              height: '12px',
              backgroundColor: i <= currentIndex ? lineColor : '#999'
            }"
          ></div>
        </div>

        <!-- Nombre de estación -->
        <div
          class="mt-1 text-xs text-center rotate-45 origin-bottom-left whitespace-nowrap"
          :class="{
            'text-gray-400': i < currentIndex,
            'font-bold': i === currentIndex,
            'text-gray-600': i > currentIndex
          }"
          :style="i === currentIndex ? { color: lineColor } : {}"
        >
          {{ station.name }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stations: {
    type: Array,
    required: true
  },
  currentStation: {
    type: String,
    required: true
  },
  lineColor: {
    type: String,
    default: '#FF0000'
  }
})

const currentIndex = computed(() => {
  const idx = props.stations.findIndex(s => s.name === props.currentStation)
  return idx >= 0 ? idx : 0
})
</script>

<style scoped>
.relative {
  min-height: 6rem;
}
</style>