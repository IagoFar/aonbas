<template>
  <div class="min-h-screen bg-teal-400 flex flex-col items-center justify-center space-y-4">
    <h1 class="text-white text-4xl font-bold">Aonbas</h1>
    <p class="text-white text-center">La teva ruta, el teu ritme, tu on vas?</p>

    <div class="w-80 space-y-3">
      <select v-model="selectedTransport" @change="onTransportChange" class="w-full p-2 rounded">
        <option value="">Transport</option>
        <option v-for="t in transports" :key="t" :value="t">{{ t }}</option>
      </select>

      <select v-model="selectedLine" @change="onLineChange" class="w-full p-2 rounded" :disabled="!selectedTransport">
        <option value="">Línia</option>
        <option v-for="line in filteredLines" :key="line" :value="line">{{ line }}</option>
      </select>

      <select v-model="selectedStop" class="w-full p-2 rounded" :disabled="!selectedLine">
        <option value="">Parada</option>
        <option v-for="stop in filteredStops" :key="stop" :value="stop">{{ stop }}</option>
      </select>

      <select v-model="selectedDirection" class="w-full p-2 rounded" :disabled="!selectedLine">
        <option value="">Direcció</option>
        <option v-for="dir in filteredDirections" :key="dir" :value="dir">{{ dir }}</option>
      </select>

      <button class="w-full bg-black text-white py-2 rounded">Busca</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const selectedTransport = ref('')
const selectedLine = ref('')
const selectedStop = ref('')
const selectedDirection = ref('')

const transportData = {
  Metro: {
    L1: {
      paradas: [
        "Hospital de Bellvitge", "Bellvitge", "Av. Carrilet", "Rambla Just Oliveras", "Can Serra", "Florida", "Torrassa", "Santa Eulàlia", "Mercat Nou", "Plaça de Sants", "Hostafrancs", "Espanya", "Rocafort", "Urgell", "Universitat", "Catalunya", "Urquinaona", "Arc de Triomf", "Marina", "Glòries", "Clot", "Navas", "La Sagrera", "Fabra i Puig", "Sant Andreu", "Torras i Bages", "Trinitat Vella", "Baró de Viver", "Santa Coloma", "Fondo"
      ],
      direcciones: ["Fondo", "Hospital de Bellvitge"]
    },
    L2: { paradas: [], direcciones: ["Badalona Pompeu Fabra", "Paral·lel"] },
    // Añadir más líneas del Metro aquí...
  },
  Bus: {
    L9nort: { paradas: [], direcciones: ["...", "..."] },
    // Añadir líneas de bus aquí...
  },
  Tren: {
    L10sur: { paradas: [], direcciones: ["...", "..."] },
    // Añadir líneas de tren aquí...
  },
  Tramvia: {
    L2: { paradas: [], direcciones: ["...", "..."] },
    // Añadir líneas de tramvia aquí...
  }
}

const transports = Object.keys(transportData)

const filteredLines = computed(() => {
  return selectedTransport.value ? Object.keys(transportData[selectedTransport.value]) : []
})

const filteredStops = computed(() => {
  return selectedLine.value ? transportData[selectedTransport.value][selectedLine.value].paradas : []
})

const filteredDirections = computed(() => {
  return selectedLine.value ? transportData[selectedTransport.value][selectedLine.value].direcciones : []
})

function onTransportChange() {
  selectedLine.value = ''
  selectedStop.value = ''
  selectedDirection.value = ''
}

function onLineChange() {
  selectedStop.value = ''
  selectedDirection.value = ''
}
</script>

<style scoped>
select:disabled {
  background-color: #ccc;
}
</style>