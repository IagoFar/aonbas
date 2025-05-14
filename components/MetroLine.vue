<template>
  <div class="relative px-4 py-6">
    <!-- Línea base gris -->
    <div class="absolute left-0 right-0 top-1/2 h-1 bg-gray-300"></div>
    <!-- Línea coloreada hasta estación actual -->
    <div
      v-if="currentIndex > 0"
      class="absolute left-0 top-1/2 h-1"
      :style="{ width: `${(currentIndex / (stations.length - 1)) * 100}%`, backgroundColor: lineColor }"
    ></div>

    <div class="flex justify-between items-center relative z-10">
      <div
        v-for="(station, i) in stations"
        :key="station.name || i"
        class="flex flex-col items-center relative"
      >
        <!-- Si hay correspondencia, dibuja anillo exterior -->
        <div
          v-if="station.correspondence"
          class="absolute"
          :style="{
            top: '-6px',
            width: '24px',
            height: '24px',
            borderRadius: '9999px',
            border: `2px solid ${lineColor}`,
            backgroundColor: 'white'
          }"
        ></div>

        <!-- Círculo de estación -->
        <div
          class="w-6 h-6 rounded-full flex items-center justify-center"
          :class="{
            'bg-gray-200 border border-gray-400': i < currentIndex,    // ya pasada
            'bg-white border-4 border-white': i === currentIndex,      // actual (se pinta con línea abajo)
            'bg-white border border-gray-400': i > currentIndex         // futura
          }"
          :style="i === currentIndex
            ? { backgroundColor: lineColor, borderColor: lineColor }
            : {}"
        ></div>

        <!-- Nombre -->
        <div
          class="mt-2 text-xs text-center"
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
    // cada item: { name: String, correspondence: Boolean }
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
  min-height: 4rem;
}
</style>
