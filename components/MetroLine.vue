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
        @click="selectStation(station)"
      >
        <div class="relative flex items-center cursor-pointer hover:opacity-80 transition-opacity">
          <!-- Nombre de la estación (posicionado a la izquierda) -->
          <div
            class="absolute right-1/4 mr-[32px] font-bold text-right transition-all duration-300"
            :class="i === currentIndex ? 'text-xl' : 'text-sm text-black dark:text-white'"
            :style="i === currentIndex ? { color: lineColorValue } : {}"
          >
            {{ station.name }}
          </div>
          
          <!-- Línea mini horizontal (a la izquierda de la línea principal) -->
          <div 
            class="absolute right-[calc(25%-2px)] transition-all duration-300"
            :class="i === currentIndex ? 'w-[24px] h-[6px]' : 'w-[12px] h-[4px]'"
            :style="{
              backgroundColor: lineColorValue,
              right: 'calc(25%)'
            }"
          ></div>
          
          <!-- Marcador de correspondencia (círculo) -->
          <div
            v-if="station.correspondence"
            class="absolute transform translate-x-10px"
            :style="{
              zIndex: 5,
              right: i === currentIndex ? 'calc(25% - 15px)' : 'calc(25% - 11px)',
              }"
          >
            <div
              class="rounded-full"
              :class="i === currentIndex ? 'scale-125' : ''"
              :style="{
                width: i === currentIndex ? '22px' : '14px',
                height: i === currentIndex ? '22px' : '14px',
                right: i === currentIndex ? 'calc(25% - 30px)' : 'calc(25% - 5px)',
                backgroundColor: '#fff',
                border: i === currentIndex ? `4px solid ${lineColorValue}` : `2px solid ${lineColorValue}`,
                transition: 'all 0.3s'
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

const emit = defineEmits(['station-selected'])

// Function to handle station selection
const selectStation = (station) => {
  // Get the station name, handling both string and object cases
  const stationName = typeof station === 'string' ? station : station.name
  emit('station-selected', stationName)
}

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