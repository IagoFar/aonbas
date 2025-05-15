<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import Papa from 'papaparse'
import MetroLine from '@/components/MetroLine.vue'

const route = useRoute()

const estacion = route.query.s
const linea = route.query.l
const destino = route.query.d

const data = ref(null)
const isLoading = ref(false)
const error = ref(null)

const nextTrainTime = ref(null)
const secondTrainTime = ref(null)
const countdown = ref(null)
const secondCountdown = ref(null)

const stationNameMap = ref({})
const stationDataMap = ref({})
const lineStationMap = ref({})

let apiRefreshTimer = null
let countdownTimer = null

// Aquí pones tu clave y lógica de llamada a la API de TMB
const claveTMB = '5c68a6b4727d9860c62abe6354495735'

const loadStationData = async () => {
  try {
    // Load both CSVs
    const [stationResponse, lineStationResponse] = await Promise.all([
      fetch('/data/metro/estacions.csv'),
      fetch('/data/metro/estacions_linia.csv')
    ])
    
    const stationCsvData = await stationResponse.text()
    const lineStationCsvData = await lineStationResponse.text()
    
    // Parse station data with interchanges
    Papa.parse(stationCsvData, {
      header: true,
      complete: (results) => {
        results.data.forEach(station => {
          if (station.NOM_ESTACIO && station.PICTO) {
            // Check if station has multiple lines (interchange)
            const isInterchange = station.PICTO && (
              station.PICTO.includes(',') || // Contains comma separator
              (station.PICTO.match(/L\d+/g) || []).length > 1 // Contains multiple line codes
            );
            
            stationDataMap.value[station.NOM_ESTACIO] = {
              name: station.NOM_ESTACIO,
              code: station.CODI_GRUP_ESTACIO,
              picto: station.PICTO,
              isInterchange: isInterchange
            }
          }
        })
        
        console.log('Loaded station data with interchanges:', stationDataMap.value)
      }
    })
    
    // Update the parsing of line-station data to track line associations
    Papa.parse(lineStationCsvData, {
      header: true,
      complete: (results) => {
        // Initialize line-station map
        lineStationMap.value = {}
        
        results.data.forEach(station => {
          if (station.CODI_ESTACIO && station.CODI_LINIA) {
            // Map station code to name
            stationNameMap.value[station.CODI_ESTACIO] = station.NOM_ESTACIO
            
            // Group stations by line
            if (!lineStationMap.value[station.CODI_LINIA]) {
              lineStationMap.value[station.CODI_LINIA] = []
            }
            
            // Only add if not already in array
            if (!lineStationMap.value[station.CODI_LINIA].includes(station.NOM_ESTACIO)) {
              lineStationMap.value[station.CODI_LINIA].push(station.NOM_ESTACIO)
            }
          }
        })
        
        console.log('Loaded line-station mappings:', lineStationMap.value)
      }
    })
  } catch (error) {
    console.error('Error loading station data:', error)
  }
}

const fetchTMB = async () => {
  if (!estacion || !linea) return

  isLoading.value = true

  try {
    const url = `https://api.tmb.cat/v1/imetro/linia/${linea}/estacio/${estacion}?app_id=135507ad&app_key=${claveTMB}`
    const res = await $fetch(url)
    data.value = res

    if (Array.isArray(data.value) && data.value.length > 0) {

      const directionData = data.value.find(d => d.codi_via.toString() === destino.toString())

      if (directionData && directionData.propers_trens && directionData.propers_trens.length > 0) {
        nextTrainTime.value = directionData.propers_trens[0].temps_restant
        countdown.value = nextTrainTime.value

        if (directionData.propers_trens.length > 1) {
          secondTrainTime.value = directionData.propers_trens[1].temps_restant
          secondCountdown.value = secondTrainTime.value
        }
      }
    }
  } catch (e) {
    error.value = 'Error al cargar datos'
  } finally {
    isLoading.value = false
  }
}

const updateCountdown = () => {
  if (countdown.value > 0) {
    countdown.value--
  } else {
    countdown.value = "Surt"
  }
  if (secondCountdown.value > 0) {
    secondCountdown.value--
  }
}

const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return '--:--'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const formattedCountdown = computed(() =>  formatTime(countdown.value))
const formattedSecondTrainTime = computed(() => formatTime(secondCountdown.value))

const getStationName = computed(() => {
  if (!data.value || !Array.isArray(data.value) || data.value.length === 0) {
    return 'Carregant estació...'
  }

  const station = data.value[0]
  if (station) {
    const stationCode = station.codi_estacio.toString()

    if (stationNameMap.value && stationNameMap.value[stationCode]) {
      return stationNameMap.value[stationCode]
    } 

    if (station.nom_estacio) {
      return station.nom_estacio
    }
    return `Estació ${stationCode} no trobada`
  }
})

const getDestinationName = computed(() => {
  if (data.value && data.value.length > 0) {
    const directionData = data.value.find(d => d.codi_via.toString() === destino.toString())
    if (directionData && directionData.propers_trens && directionData.propers_trens.length > 0) {
      return directionData.propers_trens[0].desti_trajecte || 'Direcció no trobada'
    }
  }
  return 'Direcció no trobada'
})

const contextualStations = computed(() => {
  if (!getStationName.value || !stationDataMap.value) {
    return getDefaultStations();
  }
  
  // Get 5 stations centered on the current one (or suitable range if near end)
  const currentStationName = getStationName.value;
  const allStations = data.value && Array.isArray(data.value) && data.value.length > 0
    ? getLineStations(data.value[0].codi_linia)
    : getDefaultStations().map(s => s.name);
  
  const currentIndex = allStations.indexOf(currentStationName);
  
  // If station not found, return default
  if (currentIndex === -1) {
    return getDefaultStations();
  }
  
  // Calculate range of stations to show (2 before, current, 2 after - or adjusted if near end)
  const start = Math.max(0, currentIndex - 2);
  const end = Math.min(allStations.length, start + 5);
  
  // Adjust start if we're near the end to ensure we always show 5 stations if possible
  const adjustedStart = end - 5 >= 0 ? Math.max(start, end - 5) : start;
  
  return allStations.slice(adjustedStart, end).map(name => ({
    name,
    correspondence: stationDataMap.value[name]?.isInterchange || false
  }));
})

// Default stations if we can't get real data
function getDefaultStations() {
  return [
    { name: 'Clot', correspondence: true },
    { name: 'Navas', correspondence: false },
    { name: 'La Sagrera', correspondence: true },
    { name: 'Fabra i Puig', correspondence: false },
    { name: 'Sant Andreu', correspondence: false }
  ];
}

function getLineStations(lineCode) {
  // Return only stations for the specified line
  if (lineCode && lineStationMap.value[lineCode]) {
    return lineStationMap.value[lineCode]
  }
  // Fallback to default stations if line not found
  return getDefaultStations().map(s => s.name)
}

const getLineLogoPath = computed(() => {
  if (linea) {
    return `/metro/L${linea}.png`
  }
  return '/metro/L1.png' // Default fallback
})

onMounted(() => {
  loadStationData()

  fetchTMB()

  apiRefreshTimer = setInterval(() => {
    fetchTMB()
  }, 10000) // 10 seconds

  countdownTimer = setInterval(() => {
    updateCountdown()
  }, 1000) // 1 second
})

onUnmounted(() => {
  if (apiRefreshTimer) clearInterval(apiRefreshTimer)
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<template>
  <div class="p-10 dark:bg-[#1C6962] bg-[#37cbbf] text-black dark:text-white min-h-screen">
    <!-- Info estació -->
    <div>
      <div class="flex flex-row items-center">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Barcelona_Metro_Logo.svg/440px-Barcelona_Metro_Logo.svg.png" alt="Logo TMB" class="h-15 mr-2" /> 
        <img :src="getLineLogoPath" :alt="`Línia ${linea}`" class="w-15 mr-5">
        <div>
        <h1 class="text-black dark:text-white "><span class="font-bold">Estació: </span>{{ getStationName }}</h1>
        <h1 class="text-black dark:text-white "><span class="font-bold">Direcció: </span>{{ getDestinationName }}</h1>
        </div>
      </div>
    </div>
    <div class="flex-row text-center my-15">
      <h1 class="text-black dark:text-white"><span class="font-bold">Següent tren: </span>{{ formattedCountdown }}</h1>
      <div class="py-20 dark:bg-black bg-white rounded-md">
        <MetroLine
          :stations="contextualStations"
          :currentStation="getStationName"
          :line="linea"
        />
      </div>
      <h1 class="text-black dark:text-white "><span class="font-bold">Pròxim tren: </span>{{ formattedSecondTrainTime }}</h1>
    </div>
    <div v-if="isLoading" class="text-center py-4">
      Carregant dades...
    </div>
    <div v-if="error" class="text-center py-4 text-red-500">
      Error al carregar dades
    </div>
    <!-- Enllaços -->
    <div class="bg-[#1C6962] dark:bg-[#37cbbf] rounded-md w-full">
      <h1 class="pt-2 pl-3 font-bold text-black dark:text-white">Enllaços:</h1>
      <div class="flex pl-3">
        <img src="../public/metro/L5.png" alt="L5" class="py-2 w-10 mr-5">
        <img src="../public/metro/L9N.png" alt="L9N" class="py-2 w-10 mr-5">
        <img src="../public/metro/L10N.png" alt="L10N" class="py-2 w-10 mr-5">
        <img src="../public/renfe/Rodalies.png" alt="L5" class="py-2 w-10 mr-5">
      </div> 
    </div>
  </div>
</template>
