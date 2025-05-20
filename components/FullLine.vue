<template>
  <div class="relative h-full overflow-auto">
    <!-- Línea vertical principal coloreada -->
    <div 
      class="absolute left-1/8 w-2 transform -translate-x-1/2" 
      :style="{ 
        backgroundColor: lineColorValue,
        top: '4.75%',
        bottom: '4.75%',
        left: 'calc(10% - 8px)',
      }"
    ></div>

    <!-- Contenedor de estaciones -->
    <div class="relative z-10 h-full">
      <!-- Estaciones equidistantes -->
      <div
        v-for="(station, i) in lineStations"
        :key="station.name || i"
        class="absolute w-full"
        :style="{
          top: `${5 + (i / (Math.max(lineStations.length - 1, 1))) * 90}%`,
          transform: 'translateY(-50%)' /* Centra verticalmente la estación */
        }"
        @click="selectStation(station)"
      >
        <div class="relative flex items-center cursor-pointer hover:opacity-80 transition-opacity">
          <!-- Nombre de la estación (posicionado a la izquierda) -->
          <div
            class="absolute left-1/8 ml-2 font-bold text-left transition-all duration-300"
            :class="isActiveStation(station) ? 'text-xl' : 'text-sm dark:text-white text-black'"
            :style="isActiveStation(station) ? { color: lineColorValue } : {}"
          >
            {{ station.name }}
          </div>
          
          <!-- Línea mini horizontal (a la izquierda de la línea principal) -->
          <div 
            class="absolute left-[calc(25%-2px)] transition-all duration-300"
            :class="isActiveStation(station) ? 'w-[24px] h-[6px]' : 'w-[12px] h-[4px]'"
            :style="{
              backgroundColor: lineColorValue,
              left: 'calc(10% - 4px)',
            }"
          ></div>
          
          <!-- Marcador de correspondencia (círculo) -->
          <div
            v-if="station.correspondence"
            class="absolute transform translate-x-10px"
            :style="{
              zIndex: 5,
              left: isActiveStation(station) ? 'calc(10% - 18px)' : 'calc(10% - 15px)',
              }"
          >
            <div
              class="rounded-full"
              :class="isActiveStation(station) ? 'scale-125' : ''"
              :style="{
                width: isActiveStation(station) ? '22px' : '14px',
                height: isActiveStation(station) ? '22px' : '14px',
                left: isActiveStation(station) ? 'calc(10% - 30px)' : 'calc(10% - 5px)',
                backgroundColor: '#fff',
                border: isActiveStation(station) ? `4px solid ${lineColorValue}` : `2px solid ${lineColorValue}`,
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
import { ref, computed, watch, onMounted } from 'vue'
import Papa from 'papaparse'

const props = defineProps({
  stations: {
    type: Array,
    required: false,
    default: () => []
  },
  currentStation: {
    type: String,
    required: false,
    default: ''
  },
  line: {
    type: [String, Number],
    default: '1'
  },
  interchangeData: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['station-selected'])
const lineStations = ref([])

// Data mappings
const stationNameMap = ref({})
const stationDataMap = ref({})
const lineStationMap = ref({})
const isDataLoaded = ref(false)

// Helper function to check if a station is the active one
const isActiveStation = (station) => {
  if (!props.currentStation) return false;
  return station.name === props.currentStation;
}

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

// Function to load all stations for the selected line
const loadLineStations = async (line) => {
  try {
    const response = await fetch('/data/metro/estacions_linia.csv')
    const csvData = await response.text()
    
    return new Promise((resolve) => {
      Papa.parse(csvData, {
        header: true,
        complete: (results) => {
          // Filter stations for the current line
          const stations = results.data
            .filter(s => s.CODI_LINIA === line.toString())
            .map(s => ({
              code: s.CODI_ESTACIO,
              name: s.NOM_ESTACIO,
              order: s.ORDRE_ESTACIO ? parseInt(s.ORDRE_ESTACIO) : null,
              picto: s.PICTO || s.PICTO_GRUP,
              correspondence: false // Will update this later
            }))
            .sort((a, b) => {
              // Sort by order if available, otherwise by code
              if (a.order !== null && b.order !== null) {
                return a.order - b.order
              }
              
              // Extract numeric part of code for sorting
              const codeA = parseInt(a.code.toString().replace(/^\D+/g, ''))
              const codeB = parseInt(b.code.toString().replace(/^\D+/g, ''))
              return codeA - codeB
            })
          
          // Build line-station mappings
          if (!lineStationMap.value[line]) {
            lineStationMap.value[line] = []
          }
          
          stations.forEach(station => {
            // Map station code to name for future lookups
            stationNameMap.value[station.code] = station.name
            
            // Only add to line-station map if not already there
            if (!lineStationMap.value[line].includes(station.name)) {
              lineStationMap.value[line].push(station.name)
            }
          })
          
          // Return the stations for further processing
          resolve(stations)
        }
      })
    })
  } catch (error) {
    console.error('Error loading line stations:', error)
    return []
  }
}

// Function to load station data with interchange information
const loadStationData = async () => {
  try {
    const response = await fetch('/data/metro/estacions.csv')
    const csvData = await response.text()
    
    return new Promise((resolve) => {
      Papa.parse(csvData, {
        header: true,
        complete: (results) => {
          results.data.forEach(station => {
            if (station.NOM_ESTACIO) {
              const isInterchange = station.PICTO && station.PICTO.length > 3 && 
                                    (station.PICTO.match(/L/g) || []).length > 1
              
              stationDataMap.value[station.NOM_ESTACIO] = {
                name: station.NOM_ESTACIO,
                code: station.CODI_GRUP_ESTACIO,
                picto: station.PICTO,
                isInterchange: isInterchange
              }
            }
          })
          
          resolve()
        }
      })
    })
  } catch (error) {
    console.error('Error loading station data:', error)
  }
}

// Main function to load and process all data
const loadAllData = async () => {
  if (isDataLoaded.value) {
    await updateLineStations()
    return
  }
  
  try {
    // Load station interchange data first
    await loadStationData()
    
    // Then load stations for the current line
    await updateLineStations()
    
    isDataLoaded.value = true
  } catch (error) {
    console.error('Error loading all data:', error)
  }
}

// Update stations for the current line
const updateLineStations = async () => {
  // Load stations for the current line
  const stations = await loadLineStations(props.line)
  
  // Update correspondence info from interchange data or props
  stations.forEach(station => {
    station.correspondence = checkInterchange(station)
  })
  
  lineStations.value = stations
  console.log(`Loaded ${stations.length} stations for line ${props.line}`)
}

// Function to check if a station is an interchange
const checkInterchange = (station) => {
  // 1. Check station data map first (from estacions.csv)
  if (stationDataMap.value[station.name] && stationDataMap.value[station.name].isInterchange) {
    return true
  }
  
  // 2. Check picto field directly (patterns like L1L3 indicate interchange)
  if (station.picto) {
    if (station.picto.length > 2 && (station.picto.match(/L/g) || []).length > 1) {
      return true
    }
  }
  
  // 3. Check interchange data from props
  if (props.interchangeData && props.interchangeData[station.name]) {
    const data = props.interchangeData[station.name]
    if ((data.metro && data.metro.length > 1) || 
        (data.renfe && data.renfe.length > 0) || 
        (data.fgc && data.fgc.length > 0) || 
        (data.tram && data.tram.length > 0)) {
      return true
    }
  }
  
  // 4. Check if it's marked as correspondence in stations prop
  if (props.stations && props.stations.length > 0) {
    const stationFromProps = props.stations.find(s => 
      typeof s === 'string' ? s === station.name : s.name === station.name
    )
    if (stationFromProps && stationFromProps.correspondence) {
      return true
    }
  }
  
  return false
}

// Watch for line changes to reload the stations
watch(() => props.line, () => {
  updateLineStations()
})

// Load all data on component mount
onMounted(() => {
  loadAllData()
})
</script>

<style scoped>
.h-full {
  height: 700px; /* Increased height for full lines */
  position: relative;
}

.overflow-auto {
  overflow-y: auto;
}

@media (max-height: 800px) {
  .h-full {
    height: 600px;
  }
}

@media (max-height: 600px) {
  .h-full {
    height: 500px;
  }
}
</style>