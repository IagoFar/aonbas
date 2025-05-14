<template>
  <div class="min-h-screen bg-teal-400 flex flex-col items-center justify-center space-y-4">
    <h1 class="text-white text-4xl font-bold">Aonbas</h1>
    <p class="text-white text-center">La teva ruta, el teu ritme, tu on vas?</p>

    <form @submit.prevent="handleSubmit">
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

        <button class="w-full bg-black text-white py-2 rounded" type="submit">Busca</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'	
import Papa from 'papaparse'

const router = useRouter()
const selectedTransport = ref('')
const selectedLine = ref('')
const selectedStop = ref('')
const selectedDirection = ref('')
const isLoading = ref(false)

const transportData = ref({
  Metro: {},
  Bus: {},
  Tren: {},
  Tramvia: {}
})

const stationCodes = ref({})
const lineCodes = ref({})

onMounted(async () => {
  try {
    const response = await fetch('/data/metro/estacions_linia.csv') // assets\data\metro\estacions_linia.csv
    const csvData = await response.text()

    Papa.parse(csvData, {
      header: true,
      complete: (results) => {
        processMetroData(results.data)
        isLoading.value = false
      }
    })
  } catch (error) {
    console.error('Error loading CSV data:', error)
    isLoading.value = false
  }
})

function processMetroData(data) {
  const lineGroups = {}

  data.forEach(station => {
    if (!station.NOM_LINIA || !station.NOM_ESTACIO) return

    const lineName = station.NOM_LINIA
    const stationName = station.NOM_ESTACIO
    const stationCode = station.CODI_ESTACIO
    const lineCode = station.CODI_LINIA

    // Store in global mappings
    stationCodes.value[stationName] = stationCode
    lineCodes.value[lineName] = lineCode

    if (!lineGroups[lineName]) {
      lineGroups[lineName] = {
        stations: [],
        directions: new Set(),
        stationCodes: {} // Initialize the stationCodes object
      }
    }

    // Store station code within the line's stationCodes object
    lineGroups[lineName].stationCodes[stationName] = stationCode
    lineGroups[lineName].stations.push(stationName)

    if (station.ORIGEN_SERVEI) lineGroups[lineName].directions.add(station.ORIGEN_SERVEI)
    if (station.DESTI_SERVEI) lineGroups[lineName].directions.add(station.DESTI_SERVEI)
  })

  Object.entries(lineGroups).forEach(([lineName, lineData]) => {
    transportData.value.Metro[lineName] = {
      paradas: [...new Set(lineData.stations)],
      direcciones: [...lineData.directions],
      stationCodes: lineData.stationCodes, // Make sure to include stationCodes
      lineCode: lineCodes.value[lineName]
    }
  })
}

const transports = computed(() => Object.keys(transportData.value))

const filteredLines = computed(() => {
  return selectedTransport.value ? Object.keys(transportData.value[selectedTransport.value]) : []
})

const filteredStops = computed(() => {
  if (!selectedLine.value) return []
  return selectedTransport.value && selectedLine.value 
    ? transportData.value[selectedTransport.value][selectedLine.value].paradas 
    : []
})

const filteredDirections = computed(() => {
  if (!selectedLine.value) return []
  return selectedTransport.value && selectedLine.value
    ? transportData.value[selectedTransport.value][selectedLine.value].direcciones
    : []
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


function handleSubmit() {
  if (!selectedTransport.value || !selectedLine.value || !selectedStop.value || !selectedDirection.value) {
    alert('Si us plau, selecciona totes les opcions.')
    return
  }
  const routeMap = {
    'Metro': '/tmb',
    'Bus': '/bus',
    'Tren': '/rodalies',
    'Tramvia': '/tram'
  }

  const basePath = routeMap[selectedTransport.value] || '/'

  let stationCode = selectedStop.value // Default to station name
  let lineCode = selectedLine.value

  if (selectedTransport.value === 'Metro') {
    // Check if we have station codes for this line
    if (transportData.value.Metro[selectedLine.value]) {
      // Debugging: Log the station codes for this line
      console.log('Station codes for line:', transportData.value.Metro[selectedLine.value].stationCodes)
      
      // Get the station code using the station name
      const stationCodeMap = transportData.value.Metro[selectedLine.value].stationCodes
      if (stationCodeMap && stationCodeMap[selectedStop.value]) {
        stationCode = stationCodeMap[selectedStop.value]
        console.log('Found station code:', stationCode)
      } else {
        // Fallback: Try the global stationCodes map
        if (stationCodes.value[selectedStop.value]) {
          stationCode = stationCodes.value[selectedStop.value]
          console.log('Found station code from global map:', stationCode)
        }
      }
      
      lineCode = transportData.value.Metro[selectedLine.value].lineCode || selectedLine.value
    }
  }

  let directionValue = "1" // Default first direction
  
  if (selectedTransport.value && selectedLine.value) {
    const directions = transportData.value[selectedTransport.value][selectedLine.value].direcciones || []
    
    // If the selected direction is the second one in the array, use "2"
    if (directions.length > 1 && directions[1] === selectedDirection.value) {
      directionValue = "2"
    }
  }

  const queryParams = {
    s: stationCode, // Use the station code
    l: lineCode,
    d: directionValue
  }

  router.push({
    path: basePath,
    query: queryParams
  })
}
</script>

<style scoped>
select:disabled {
  background-color: #ccc;
}
</style>