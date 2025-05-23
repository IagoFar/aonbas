<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Papa from 'papaparse'

const route = useRoute()
const router = useRouter()

// Route parameters
const stopId = route.query.s

// State management
const data = ref(null)
const isLoading = ref(false)
const error = ref(null)
const stations = ref([])
const stationMap = ref({})
const interchangeData = ref({})
const remainingTimes = ref({})

// Constants for Rodalies lines
const lines = ['R1', 'R2', 'R3', 'R4', 'R7', 'R8', 'R11', 'R12']

// Timers
let refreshTimer = null
let countdownTimer = null

// Load station data from CSV
const loadStationData = async () => {
  try {
    const response = await fetch('/data/rodalies/stops.csv')
    const csvData = await response.text()
    
    Papa.parse(csvData, {
      header: true,
      complete: (results) => {
        stations.value = results.data.map(station => ({
          id: station.stop_id,
          name: station.stop_name,
          lat: parseFloat(station.stop_lat),
          lon: parseFloat(station.stop_lon)
        }))
        
        // Create a map for quick lookup
        stations.value.forEach(station => {
          stationMap.value[station.id] = station
        })
        
        console.log('Loaded station data:', stations.value.length, 'stations')
      }
    })
  } catch (error) {
    console.error('Error loading station data:', error)
  }
}

// Load interchange data from CSV
const loadInterchangeData = async () => {
  try {
    const response = await fetch('/data/info_stations.csv')
    const csvData = await response.text()
    
    Papa.parse(csvData, {
      header: true,
      complete: (results) => {
        results.data.forEach(station => {
          if (station.NOM_RENFE) {
            // Parse metro lines
            const metroLines = station.LINIES_METRO ? 
              station.LINIES_METRO.match(/L[0-9]+[NS]*/g) : [];
            
            // Parse Renfe lines
            const renfeLines = station.LINIES_RENFE ? 
              station.LINIES_RENFE.match(/R[0-9]+|RG[0-9]+/g) : [];
            
            // Parse FGC lines
            const fgcLines = station.LINIES_FGC ? 
              station.LINIES_FGC.match(/[SLR][0-9]+|RL[0-9]+/g) : [];
            
            // Parse Tram lines
            const tramLines = station.LINIES_TRAM ? 
              station.LINIES_TRAM.match(/T[0-9]+/g) : [];
            
            interchangeData.value[station.NOM_RENFE] = {
              metro: metroLines || [],
              renfe: renfeLines || [], 
              fgc: fgcLines || [],
              tram: tramLines || []
            }
          }
        })
        console.log('Loaded interchange data:', Object.keys(interchangeData.value).length, 'stations')
      }
    })
  } catch (error) {
    console.error('Error loading interchange data:', error)
  }
}

// Fetch train information from API
const fetchRodalies = async () => {
  if (!stopId) return
  
  isLoading.value = true
  error.value = null
  
  try {
    const url = `/api/rodalies/${stopId}`
    const result = await $fetch(url)
    data.value = result
    
    // Set up countdown times
    if (result.nextTrains && result.nextTrains.length > 0) {
      result.nextTrains.forEach(train => {
        const uniqueId = train.tripId
        const arrivalTime = convertTimeToSeconds(train.arrival)
        const now = convertTimeToSeconds(getCurrentTime())
        
        // Calculate seconds until arrival
        const remainingSeconds = arrivalTime > now 
          ? arrivalTime - now 
          : 0
          
        remainingTimes.value[uniqueId] = remainingSeconds
      })
    }
    
    console.log('API response:', data.value)
  } catch (e) {
    console.error('API error:', e)
    error.value = 'Error al carregar dades de Rodalies'
  } finally {
    isLoading.value = false
  }
}

// Function to get the current time in HH:MM:SS format
const getCurrentTime = () => {
  const now = new Date()
  return now.toTimeString().substring(0, 8)
}

// Convert time string (HH:MM:SS) to seconds
const convertTimeToSeconds = (timeStr) => {
  if (!timeStr) return 0
  
  const parts = timeStr.split(':')
  if (parts.length !== 3) return 0
  
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2])
}

// Format seconds to MM:SS
const formatTime = (seconds) => {
  if (seconds === undefined || seconds === null) return '--:--'
  if (seconds <= 0) return 'Imminent'
  
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

// Extract line from tripId (e.g. "5101S77642R4" -> "R4")
const getLineFromTripId = (tripId) => {
  const match = tripId.match(/R\d+/)
  return match ? match[0] : 'R?'
}

// Function to navigate back
const goBack = () => {
  if (route.query.s) {
    router.replace({ query: {} })
  } else {
    router.push({ path: '/' })
  }
}

// Get station name from station ID
const getStationName = computed(() => {
  if (data.value && data.value.stopName) {
    return data.value.stopName
  }
  
  if (stopId && stationMap.value[stopId]) {
    return stationMap.value[stopId].name
  }
  
  return 'Estació desconeguda'
})

// Get interchanges for current station
const getInterchanges = computed(() => {
  const stationName = getStationName.value
  if (!stationName || !interchangeData.value[stationName]) return []
  
  const interchange = interchangeData.value[stationName]
  const result = []
  
  // Add Metro interchanges
  if (interchange.metro && interchange.metro.length > 0) {
    interchange.metro.forEach(line => {
      result.push({
        type: 'metro',
        line: line
      })
    })
  }
  
  // Add Renfe interchanges (excluding current line)
  if (interchange.renfe && interchange.renfe.length > 0) {
    interchange.renfe.forEach(line => {
      // Don't add the current line as an interchange
      const currentLine = data.value?.nextTrains?.[0] 
        ? getLineFromTripId(data.value.nextTrains[0].tripId)
        : null
        
      if (line !== currentLine) {
        result.push({
          type: 'renfe',
          line: line
        })
      }
    })
  }
  
  // Add FGC interchanges
  if (interchange.fgc && interchange.fgc.length > 0) {
    interchange.fgc.forEach(line => {
      result.push({
        type: 'fgc',
        line: line
      })
    })
  }
  
  // Add Tram interchanges
  if (interchange.tram && interchange.tram.length > 0) {
    interchange.tram.forEach(line => {
      result.push({
        type: 'tram',
        line: line
      })
    })
  }
  
  return result
})

// Get path to logo image
const getLogoPath = (interchange) => {
  if (!interchange) return ''
  
  const { type, line } = interchange
  
  switch (type) {
    case 'metro':
      return `/Logos/${line}.svg`
    case 'renfe':
      return `/Logos/${line}.svg`
    case 'fgc':
      return `/Logos/${line}.svg`
    case 'tram':
      return `/Logos/${line}.svg`
    default:
      return ''
  }
}

// Navigate to another transit app
const switchToLine = (line) => {
  if (line.startsWith('L')) {
    // Metro
    router.push({
      path: '/tmb',
      query: { line: line.substring(1) } // Remove L prefix
    })
  } else if (line.startsWith('T')) {
    // Tram
    router.push({
      path: '/tram',
      query: { line: line }
    })
  } else if (line.startsWith('R')) {
    // Rodalies
    router.push({
      path: '/renfe',
      query: { line: line }
    })
  }
}

// Countdown function
const tick = () => {
  Object.keys(remainingTimes.value).forEach(id => {
    if (remainingTimes.value[id] > 0) {
      remainingTimes.value[id]--
    }
  })
}

// Initialize the component
onMounted(async () => {
  await loadStationData()
  await loadInterchangeData()
  
  if (stopId) {
    fetchRodalies()
    
    // Set up timers
    refreshTimer = setInterval(fetchRodalies, 30000) // Refresh every 30 seconds
    countdownTimer = setInterval(tick, 1000) // Update countdown every second
  }
})

// Clean up timers
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<template>
  <div class="p-4 min-h-screen dark:bg-[#DC0032] bg-[#f58220] text-black dark:text-white">
    <div class="mb-4">
      <button 
        class="p-1 px-2 bg-[#FFFFFF3d] dark:bg-[#0000003d] text-semibold text-black dark:text-white rounded-lg"
        @click="goBack"
      > &lt;- Volver</button>
    </div>
    
    <!-- Station selection view -->
    <div v-if="!stopId">
      <div class="flex items-center mb-4">
        <img src="/Logos/ROD.svg" alt="Rodalies" class="h-8 mr-2" />
        <h1 class="text-2xl font-bold">Rodalies de Catalunya</h1>
      </div>
      
      <div class="mb-6">
        <h2 class="mb-2 font-medium">Línies disponibles:</h2>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="line in lines"
            :key="line"
            class="p-2 rounded-lg bg-[#FFFFFF3d] dark:bg-[#0000003d] cursor-pointer hover:bg-[#FFFFFF6d] dark:hover:bg-[#0000006d]"
            @click="router.push({ query: { line } })"
          >
            <img :src="`/Logos/${line}.svg`" :alt="line" class="h-8" />
          </div>
        </div>
      </div>
      
      <h2 class="mb-2 font-medium">Estacions:</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="station in stations"
          :key="station.id"
          @click="router.push({ query: { s: station.id } })"
          class="p-3 bg-[#FFFFFF3d] dark:bg-[#0000003d] rounded-lg shadow cursor-pointer hover:bg-[#FFFFFF6d] dark:hover:bg-[#00000060] transition"
        >
          <h3 class="font-medium text-lg">{{ station.name }}</h3>
          <div class="text-sm opacity-75">ID: {{ station.id }}</div>
        </div>
      </div>
    </div>
    
    <!-- Station detail view -->
    <div v-if="stopId">
      <div class="flex items-center mb-4">
        <img src="/Logos/ROD.svg" alt="Rodalies" class="h-8 mr-2" />
        <h1 class="text-2xl font-bold">{{ getStationName }}</h1>
      </div>
      
      <div v-if="isLoading" class="py-4">Carregant dades...</div>
      <div v-else-if="error" class="py-4 text-red-700 dark:text-red-300">{{ error }}</div>
      
      <div v-if="data && data.nextTrains && data.nextTrains.length > 0" class="mb-4">
        <h2 class="font-bold mb-2">Próxims trens:</h2>
        <div class="space-y-2">
          <div
            v-for="train in data.nextTrains"
            :key="train.tripId"
            class="p-3 bg-[#FFFFFF3d] dark:bg-[#0000003d] rounded shadow"
          >
            <div class="flex justify-between items-center">
              <div>
                <div class="font-semibold flex items-center">
                  <img 
                    :src="`/Logos/${getLineFromTripId(train.tripId)}.svg`" 
                    :alt="getLineFromTripId(train.tripId)" 
                    class="h-6 mr-2" 
                  />
                  <span>{{ getLineFromTripId(train.tripId) }}</span>
                </div>
                <div class="text-sm text-gray-700 dark:text-gray-300">
                  ID: {{ train.tripId }}
                </div>
              </div>
              <div class="flex flex-col items-end">
                <div class="text-2xl font-bold">{{ formatTime(remainingTimes[train.tripId]) }}</div>
                <div class="text-xs">Arribada: {{ train.arrival }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div v-else-if="!isLoading" class="mb-4 p-3 bg-[#FFFFFF3d] dark:bg-[#0000003d] rounded text-center">
        No hi ha trens programats en les properes hores
      </div>
      
      <!-- Interchanges section -->
      <div class="bg-[#DC0032] dark:bg-[#f58220] rounded-md w-full p-2 mt-4">
        <h1 class="ml-2 font-bold text-black dark:text-white mb-2">Enllaços:</h1>
        
        <!-- If no interchanges available -->
        <div v-if="getInterchanges.length === 0" class="text-black dark:text-white ml-2">
          No hi ha enllaços disponibles
        </div>
        
        <div class="space-y-3">
          <!-- Metro interchanges with click functionality -->
          <div v-if="getInterchanges.filter(i => i.type === 'metro').length > 0" class="ml-2">
            <div class="flex items-center mb-1">
              <img src="/Logos/FMB.svg" alt="Metro" class="h-6 w-auto mr-2" />
              <span class="text-sm font-semibold">Metro</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <img
                v-for="interchange in getInterchanges.filter(i => i.type === 'metro')"
                :key="`metro-${interchange.line}`"
                :src="getLogoPath(interchange)"
                :alt="interchange.line"
                :title="`Canviar a ${interchange.line}`"
                class="h-8 w-auto cursor-pointer hover:scale-110 transition-transform"
                @click="switchToLine(interchange.line)"
              />
            </div>
          </div>
          
          <!-- Renfe interchanges -->
          <div v-if="getInterchanges.filter(i => i.type === 'renfe').length > 0" class="ml-2">
            <div class="flex items-center mb-1">
              <img src="/Logos/ROD.svg" alt="Rodalies" class="h-6 w-auto mr-2" />
              <span class="text-sm font-semibold">Rodalies</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <img
                v-for="interchange in getInterchanges.filter(i => i.type === 'renfe')"
                :key="`renfe-${interchange.line}`"
                :src="getLogoPath(interchange)"
                :alt="interchange.line"
                class="h-8 w-auto cursor-pointer hover:scale-110 transition-transform"
                @click="switchToLine(interchange.line)"
              />
            </div>
          </div>
          
          <!-- FGC interchanges -->
          <div v-if="getInterchanges.filter(i => i.type === 'fgc').length > 0" class="ml-2">
            <div class="flex items-center mb-1">
              <img src="/Logos/FGC.svg" alt="FGC" class="h-6 w-auto mr-2" />
              <span class="text-sm font-semibold">FGC</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <img
                v-for="interchange in getInterchanges.filter(i => i.type === 'fgc')"
                :key="`fgc-${interchange.line}`"
                :src="getLogoPath(interchange)"
                :alt="interchange.line"
                class="h-8 w-auto cursor-pointer hover:scale-110 transition-transform"
                @click="switchToLine(interchange.line)"
              />
            </div>
          </div>
          
          <!-- Tram interchanges -->
          <div v-if="getInterchanges.filter(i => i.type === 'tram').length > 0" class="ml-2">
            <div class="flex items-center mb-1">
              <img src="/Logos/TRAM.svg" alt="TRAM" class="h-6 w-auto mr-2" />
              <span class="text-sm font-semibold">TRAM</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <img
                v-for="interchange in getInterchanges.filter(i => i.type === 'tram')"
                :key="`tram-${interchange.line}`"
                :src="getLogoPath(interchange)"
                :alt="interchange.line"
                class="h-8 w-auto cursor-pointer hover:scale-110 transition-transform"
                @click="switchToLine(interchange.line)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Add any scoped styles here */
</style>