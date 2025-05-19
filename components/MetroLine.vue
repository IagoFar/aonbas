<template>
  <div class="relative py-4 px-6 h-full">
    <!-- Línea vertical principal coloreada -->
    <div 
      class="absolute right-1/4 w-2 transform -translate-x-1/2" 
      :style="{ 
        backgroundColor: lineColorValue,
        top: '5%',
        bottom: '5%'
      }"
    ></div>

    <!-- Línea gris para estaciones pasadas -->
    <div
      v-if="currentIndex >= 0"
      class="absolute right-1/4 w-2 transform -translate-x-1/2"
      :style="{
        top: '5%',
        height: `${(currentIndex / (stations.length - 1)) * 84}%`, 
        backgroundColor: '#999'
      }"
    ></div>

    <!-- Contenedor de estaciones -->
    <div class="relative z-10 h-full">
      <!-- Estaciones equidistantes -->
      <div
        v-for="(station, i) in stations"
        :key="station.name || i"
        class="absolute w-full"
        :style="{
          top: `${5 + (i / (stations.length - 1)) * 80}%`,
          transform: 'translateY(-50%)' /* Centra verticalmente la estación */
        }"
      >
        <div class="relative flex items-center">
          <!-- Nombre de la estación (posicionado a la izquierda) -->
          <div
            class="absolute right-1/4 mr-[32px] text-sm font-bold text-right"
            :class="{
              'text-gray-400': i < currentIndex,
              'text-gray-500': i > currentIndex && i !== currentIndex
            }"
            :style="i === currentIndex ? { color: lineColorValue } : {}"
          >
            {{ station.name }}
          </div>
          
          <!-- Línea mini horizontal (a la izquierda de la línea principal) -->
          <div 
            class="absolute right-[calc(25%-2px)] w-[12px] h-[4px]"
            :style="{
              backgroundColor: i < currentIndex ? '#999' : lineColorValue,
              right: 'calc(25%)'
            }"
          ></div>
          
          <!-- Marcador de correspondencia (círculo) -->
          <div
            v-if="station.correspondence"
            class="absolute right-14 transform translate-x-10px"
            style="z-index: 5;"
          >
            <div
              class="rounded-full"
              :style="{
                width: '14px',
                height: '14px',
                backgroundColor: '#fff',
                border: i < currentIndex ? `2px solid #999` : `2px solid ${lineColorValue}`
              }"
            ></div>
          </div>
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
  line: {
    type: [String, Number],
    default: '11'
  }
})

// Mapa de números de línea a sus colores estándar
const lineColorValue = computed(() => {
  const lineColors = {
    '1': '#E60012', // Rojo (L1)
    '2': '#722283', // Púrpura (L2)
    '3': '#00AB4F', // Verde (L3)
    '4': '#FFCC00', // Amarillo (L4)
    '5': '#0073C7', // Azul (L5)
    '9': '#F38143', // Naranja (L9)
    '91': '#F38143', // Naranja (L9S)
    '94': '#F38143', // Naranja (L9N)
    '10': '#0093D0', // Azul claro (L10)
    '101': '#0093D0', // Azul claro (L10S)
    '104': '#0093D0', // Azul claro (L10N)
    '11': '#6CC24A' // Verde claro (L11)
  }
  
  return lineColors[props.line.toString()] || '#E60012' // Por defecto, rojo L1
})

// Encontrar el índice de la estación actual
const currentIndex = computed(() => {
  const idx = props.stations.findIndex(s => 
    typeof s === 'string' ? s === props.currentStation : s.name === props.currentStation
  )
  return idx >= 0 ? idx : 0
})
</script>

<style scoped>
.h-full {
  height: 600px; /* Altura fija para asegurar un espaciado adecuado */
}

@media (max-height: 700px) {
  .h-full {
    height: 500px;
  }
}

@media (max-height: 600px) {
  .h-full {
    height: 400px;
  }
}
</style>