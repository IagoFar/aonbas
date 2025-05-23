<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Papa from 'papaparse'

const route = useRoute()
const router = useRouter()

// Route parameters
const stopId = route.query.s
const selectedLine = route.query.l

// State management
const data = ref(null)
const isLoading = ref(false)
const error = ref(null)
const stations = ref([])
const stationMap = ref({})
const stationsByLine = ref({})
const interchangeData = ref({})
const remainingTimes = ref({})

const tripsMap = ref(new Map()) // Maps trip_id to route_id
const routesMap = ref(new Map()) // Maps route_id to route destination

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
        // Initialize the stationsByLine map
        lines.forEach(line => {
          stationsByLine.value[line] = []
        })
        
        // Group stations by line
        results.data.forEach(row => {
          if (row.LINIA && row.ESTACIO && row.STOPID) {
            // Create station object
            const station = {
              id: row.STOPID,
              name: row.ESTACIO,
              line: row.LINIA
            }
            
            // Add to the appropriate line array
            if (stationsByLine.value[row.LINIA]) {
              stationsByLine.value[row.LINIA].push(station)
            }
            
            // Add to station map for lookup
            stationMap.value[station.id] = station
            
            // Also add to the general stations list
            // (only if not already present)
            if (!stations.value.some(s => s.id === station.id)) {
              stations.value.push(station)
            }
          }
        })
        
        // Sort stations alphabetically within each line
        Object.keys(stationsByLine.value).forEach(line => {
          stationsByLine.value[line].sort((a, b) => 
            a.name.localeCompare(b.name)
          )
        })
        
        console.log('Loaded station data:', stations.value.length, 'stations')
        console.log('Stations by line:', Object.keys(stationsByLine.value).length, 'lines')
      }
    })
  } catch (error) {
    console.error('Error loading station data:', error)
  }
}

const loadGTFSData = async () => {
  try {
    console.log('Starting GTFS data loading process...')
    
    // Load trips.txt and routes.txt files
    const [tripsResponse, routesResponse] = await Promise.all([
      fetch('/data/rodalies/gtfs/trips.txt').catch(err => {
        console.error('Failed to fetch trips.txt:', err)
        return { text: () => Promise.resolve('') }
      }),
      fetch('/data/rodalies/gtfs/routes.txt').catch(err => {
        console.error('Failed to fetch routes.txt:', err)
        return { text: () => Promise.resolve('') }
      })
    ])
    
    const tripsCsvData = await tripsResponse.text()
    const routesCsvData = await routesResponse.text()
    
    if (!tripsCsvData) {
      console.error('trips.txt data is empty')
      return
    }
    
    if (!routesCsvData) {
      console.error('routes.txt data is empty')
      return
    }
    
    console.log('GTFS files fetched successfully')
    
    // Parse trips.txt to map trip_id to route_id
    Papa.parse(tripsCsvData, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          console.error('Error parsing trips.txt:', results.errors)
        }
        
        let tripsMapCount = 0
        results.data.forEach(trip => {
          if (trip.trip_id && trip.route_id) {
            // Store the direct mapping
            tripsMap.value.set(trip.trip_id, trip.route_id)
            tripsMapCount++
            
            // Store normalized version (lowercase)
            const normalizedTripId = trip.trip_id.trim().toLowerCase()
            tripsMap.value.set(normalizedTripId, trip.route_id)
            
            // Store just the route ID prefix part (e.g., "5101S77564" from "5101S77564R4")
            const baseId = trip.trip_id.replace(/R\d+$/, '')
            if (baseId !== trip.trip_id) {
              tripsMap.value.set(baseId, trip.route_id)
            }
          }
        })
        console.log(`Loaded ${tripsMapCount} trips from GTFS data`)
      }
    })
    
    // Parse routes.txt with more robust error handling
    Papa.parse(routesCsvData, {
      header: true,
      skipEmptyLines: true,
      error: (error) => {
        console.error('CSV parsing error:', error)
      },
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          console.error('Error parsing routes.txt:', results.errors)
        }
        
        results.data.forEach(route => {
          if (route.route_id) {
            // Extract route information, handling missing fields
            routesMap.value.set(
              route.route_id, 
              {
                name: cleanRouteName(route.route_long_name || ''),
                shortName: route.route_short_name || '',
                color: route.route_color || ''
              }
            )
            
            // Also map by route_short_name if available
            if (route.route_short_name) {
              routesMap.value.set(
                route.route_short_name.trim(),
                {
                  name: cleanRouteName(route.route_long_name || ''),
                  shortName: route.route_short_name || '',
                  color: route.route_color || ''
                }
              )
            }
          }
        })
        console.log(`Loaded ${routesMap.value.size} routes from GTFS data`)
      }
    })
  } catch (error) {
    console.error('Error loading GTFS data:', error)
  }
}

function cleanRouteName(name) {
  return name.trim()
    .replace(/\s+/g, ' ')  // Replace multiple spaces with a single space
    .replace(/\s*-\s*/g, ' - ') // Standardize dashes
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
      console.log('First train trip ID:', result.nextTrains[0].tripId)
      console.log('Trip ID in tripsMap?', tripsMap.value.has(result.nextTrains[0].tripId))

      result.nextTrains.forEach(train => {
        const uniqueId = train.tripId
        const arrivalTime = convertTimeToSeconds(train.arrival)
        const now = convertTimeToSeconds(getCurrentTime())
        
        console.log(
          `Trip ID: ${train.tripId}, ` + 
          `Destination: ${getDestinationFromTripId(train.tripId)}`
        )

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

const filteredStations = computed(() => {
  if (!selectedLine) {
    return stations.value
  }
  
  return stationsByLine.value[selectedLine] || []
})

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

// Format arrival time to HH:MM format
const formatArrivalTime = (timeStr) => {
  if (!timeStr) return '--:--';
  
  // Handle format "HH:MM:SS"
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  
  return timeStr;
};

// Update the getDestinationFromTripId function with better trip ID matching
const getDestinationFromTripId = (tripId) => {
  if (!tripId) return 'Desconegut'
  
  console.log(`Looking up destination for trip ID: "${tripId}"`)
  
  // Extract line code for fallback options
  const line = getLineFromTripId(tripId)
  
  // Strategy 1: Exact match
  let routeId = tripsMap.value.get(tripId)
  
  // Strategy 2: Try normalized version (lowercase)
  if (!routeId) {
    const normalizedTripId = tripId.trim().toLowerCase()
    routeId = tripsMap.value.get(normalizedTripId)
  }
  
  // Strategy 3: Try line code as route ID
  if (!routeId && line !== 'R?') {
    if (routesMap.value.has(line)) {
      routeId = line
    }
  }
  
  // Strategy 4: Try without line suffix
  if (!routeId) {
    const baseId = tripId.replace(/R\d+$/, '')
    if (baseId !== tripId) {
      routeId = tripsMap.value.get(baseId)
    }
  }
  
  // Strategy 5: Try matching by prefix
  if (!routeId) {
    // Get the first part of the ID (before any underscore)
    const prefix = tripId.split('_')[0]
    // Look for any trip ID that starts with this prefix
    if (prefix && prefix.length > 4) {
      for (const [key, value] of tripsMap.value.entries()) {
        if (key.startsWith(prefix)) {
          routeId = value
          console.log(`Found match by prefix ${prefix} -> ${routeId}`)
          break
        }
      }
    }
  }
  
  // If route ID found, get destination from routes map
  if (routeId && routesMap.value.has(routeId)) {
    const route = routesMap.value.get(routeId)
    if (route && route.name) {
      return route.name
    }
  }
  
  console.log(`No GTFS match found for ${tripId}, using line fallback`)
  
  // Fall back to line-specific destinations
  const destinations = {
    'R1': 'Maçanet-Massanes / Molins de Rei',
    'R2': 'Sant Celoni / Aeroport',
    'R2Nord': 'Maçanet-Massanes / Sant Celoni',
    'R2Sud': 'Vilanova / Aeroport',
    'R3': 'Puigcerdà / L\'Hospitalet',
    'R4': 'Manresa / Sant Vicenç',
    'R7': 'Cerdanyola Universitat / Barcelona',
    'R8': 'Martorell / Granollers Centre',
    'R11': 'Portbou / Barcelona',
    'R12': 'Lleida / L\'Hospitalet',
    'R13': 'Cerbère / Barcelona',
    'R14': 'Lleida / Barcelona',
    'R15': 'Riba-roja d\'Ebre / Barcelona',
    'R16': 'Tortosa / Barcelona',
    'R17': 'Portbou / Barcelona'
  }
  
  return destinations[line] || 'Desconegut'
}

// Add this helper for day indication - it was missing
const getDayIndicator = (timeStr) => {
  if (!timeStr) return '';
  
  const now = new Date();
  const hours = parseInt(timeStr.split(':')[0]);
  
  // If current time is PM and arrival time is AM, it's likely tomorrow
  if (now.getHours() >= 18 && hours <= 6) {
    return 'Demà';
  }
  
  return 'Avui';
};

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
  
  await Promise.all([
    loadStationData(),
    loadInterchangeData(),
    loadGTFSData() 
  ])
  
  if (stopId) {
    fetchRodalies()
    
    // Set up timers
    countdownTimer = setInterval(tick, 1000) // Update countdown every second
  }
})

// Clean up timers
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (countdownTimer) clearInterval(countdownTimer)
})

watch(() => route.query.line, (newLine) => {
  if (newLine && stationsByLine.value[newLine]) {
    console.log(`Showing stations for line ${newLine}`)
  }
})

</script>

<template>
  <div class="p-4 min-h-screen dark:bg-[#1C6962] bg-[#37cbbf] text-black dark:text-white">
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
            class="p-2 rounded-lg"
            :class="[
              selectedLine === line ? 
                'bg-[#FFFFFF70] dark:bg-[#00000070]' : 
                'bg-[#FFFFFF3d] dark:bg-[#0000003d]'
            ]"
            @click="router.push({ query: { line } })"
          >
            <img :src="`/Logos/${line}.svg`" :alt="line" class="h-8" />
          </div>
        </div>
      </div>
      
      <!-- Show line name if line is selected -->
      <div v-if="selectedLine" class="mb-4">
        <h2 class="mb-2 font-medium flex items-center">
          <img :src="`/Logos/${selectedLine}.svg`" :alt="selectedLine" class="h-6 mr-2" />
          <span>Estacions de la línia {{ selectedLine }}:</span>
          <button 
            class="ml-2 text-sm p-1 rounded-md bg-[#FFFFFF3d] dark:bg-[#0000003d]"
            @click="router.push({ query: {} })"
          >
            Mostrar totes
          </button>
        </h2>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="station in filteredStations"
          :key="station.id"
          @click="router.push({ query: { s: station.id } })"
          class="p-3 bg-[#FFFFFF3d] dark:bg-[#0000003d] rounded-lg shadow cursor-pointer hover:bg-[#FFFFFF6d] dark:hover:bg-[#00000060] transition"
        >
          <div class="flex justify-between items-center">
            <h3 class="font-medium text-lg">{{ station.name }}</h3>
            <img 
              v-if="station.line" 
              :src="`/Logos/${station.line}.svg`" 
              :alt="station.line" 
              class="h-6 w-auto ml-2" 
            />
          </div>
          <div class="text-sm opacity-75 flex items-center gap-1">
            <span class="bg-[#FFFFFF30] dark:bg-[#00000030] px-2 rounded-md">ID: {{ station.id }}</span>
          </div>
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
              <div class="flex flex-col">
                <div class="font-semibold flex items-center">
                  <!-- Route logo -->
                  <img 
                    :src="`/Logos/${getLineFromTripId(train.tripId)}.svg`" 
                    :alt="getLineFromTripId(train.tripId)" 
                    class="h-8 mr-2" 
                  />
                  <!-- Line info -->
                  <div class="flex flex-col">
                    <span class="text-lg">{{ getLineFromTripId(train.tripId) }}</span>
                    <!-- Destination -->
                    <span class="text-sm font-normal">
                      {{ getDestinationFromTripId(train.tripId) || "Destí desconegut" }}
                    </span>
                  </div>
                </div>
              </div>
              
              <div class="flex flex-col items-end">
                <!-- Arrival time - larger and more prominent -->
                <div class="text-xl font-bold">{{ formatArrivalTime(train.arrival) }}</div>
                <div class="text-xs text-gray-600 dark:text-gray-400">
                  {{ getDayIndicator(train.arrival) }}
                </div>
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