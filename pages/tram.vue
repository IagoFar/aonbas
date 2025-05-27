<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { parse } from 'csv-parse/browser/esm/sync'

// Parámetros de ruta
const route = useRoute()
const router = useRouter()
const stopCode = route.query.s as string || ''

const orderedStops = ref<any[]>([])

const arrivalsOutbound = ref<any[]>([])
const arrivalsReturn = ref<any[]>([])

const stationInfo = ref<any[]>([])
const currentStationInterchanges = ref({
  metro: [],
  renfe: [],
  fgc: [],
  tram: []
})

// Datos de paradas
const stops = ref<{
  byName: Map<string, any>;
  byOutboundCode: Map<string, any>;
  byReturnCode: Map<string, any>;
} | null>(null)

const selectedLine = ref<string>('all')
const tramLines = [
  { id: 'all', name: 'Todas las líneas' },
  { id: 'T1', name: 'T1' },
  { id: 'T2', name: 'T2' },
  { id: 'T3', name: 'T3' },
  { id: 'T4', name: 'T4' },
  { id: 'T5', name: 'T5' },
  { id: 'T6', name: 'T6' },
]

const loadInterchangesData = async () => {
  try {
    const res = await fetch('/data/info_stations.csv')
    const text = await res.text()
    const data = parse(text, { columns: true })
    stationInfo.value = data
  } catch (e) {
    console.error('Error loading interchanges data:', e)
  }
}

const findInterchanges = (stopName: string | null) => {
  if (!stopName || !stationInfo.value.length) return
  
  // Reset interchanges
  currentStationInterchanges.value = {
    metro: [],
    renfe: [],
    fgc: [],
    tram: []
  }
  
  // Find matching station in info_stations.csv
  const station = stationInfo.value.find(s => 
    s.NOM_TRAM && s.NOM_TRAM.toLowerCase() === stopName.toLowerCase()
  )
  
  if (!station) return
  
  // Parse metro lines
  if (station.LINIES_METRO) {
    const lines = station.LINIES_METRO.match(/L\d+[NS]?|FM/g) || []
    currentStationInterchanges.value.metro = lines.map((line: string)  => ({
      type: 'metro',
      line
    }))
  }
  
  // Parse renfe lines
  if (station.LINIES_RENFE) {
    const lines = station.LINIES_RENFE.match(/R\d+|RL\d+/g) || []
    currentStationInterchanges.value.renfe = lines.map((line: string) => ({
      type: 'renfe',
      line
    }))
  }
  
  // Parse FGC lines
  if (station.LINIES_FGC) {
    const lines = station.LINIES_FGC.match(/[LS]\d+|R[5-6]|R50|R60/g) || []
    currentStationInterchanges.value.fgc = lines.map((line: string) => ({
      type: 'fgc',
      line
    }))
  }
  
  // Parse tram lines (excluding current line if any)
  if (station.LINIES_TRAM) {
    const lines = station.LINIES_TRAM.match(/T\d+/g) || []
    currentStationInterchanges.value.tram = lines
      .filter((line: string) => line !== selectedLine.value)
      .map((line: string) => ({
        type: 'tram',
        line
      }))
  }
}

const getInterchanges = computed(() => {
  return [
    ...currentStationInterchanges.value.metro,
    ...currentStationInterchanges.value.renfe,
    ...currentStationInterchanges.value.fgc,
    ...currentStationInterchanges.value.tram
  ]
})

const getLogoPath = (interchange: { type: string; line: string }) => {
  if (!interchange) return '';
  
  const { type, line } = interchange;
  
  switch (type) {
    case 'metro':
      return `/Logos/${line}.svg`;
    case 'renfe':
      return `/Logos/${line}.svg`;
    case 'fgc':
      return `/Logos/${line}.svg`;
    case 'tram':
      return `/Logos/${line}.svg`;
    default:
      return '';
  }
};

function switchToLine(line: string) {
  if (line.startsWith('T')) {
    // Switch to tram line
    router.push({
      path: '/tram',
      query: { line: line }
    })
  } else if (line.startsWith('L')) {
    // Switch to metro line
    router.push({
      path: '/tmb',
      query: { line: line }
    })
  }
}


type TramLine = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6'

const fetchStopsForLine = async (lineId: TramLine | 'all') => {
  if (lineId === 'all') {
    orderedStops.value = []
    return
  }

  const lineMap: Record<TramLine, number> = { T1: 1, T2: 2, T3: 3, T4: 4, T5: 5, T6: 6 }
  const lineApiId = lineMap[lineId]

  try {
    const res = await $fetch(`/api/tram/line/${lineApiId}`)
    orderedStops.value = res || []
  } catch (e) {
    console.error('Error fetching line stops:', e)
    orderedStops.value = []
  }
}

// Load and transform CSV data into maps
const initializeStops = async () => {
  try {
    const data = await loadData()
    const byName = new Map()
    const byOutboundCode = new Map()
    const byReturnCode = new Map()
    
    data.forEach((stop: any) => {
      const stopInfo = {
        name: stop.Name,
        outboundCode: stop.OutboundCode,
        returnCode: stop.ReturnCode,
        latitude: parseFloat(stop.Latitude),
        longitude: parseFloat(stop.Longitude),
        connections: stop.Connections,
        gtfsCode: stop.GtfsCode,
        tramLines: stop.TramLines ? stop.TramLines.match(/T\d+/g) : []
      }
      
      byName.set(stop.Name, stopInfo)
      byOutboundCode.set(stop.OutboundCode, stopInfo)
      byReturnCode.set(stop.ReturnCode, stopInfo)
    })
    
    stops.value = { byName, byOutboundCode, byReturnCode }
    console.log('Loaded stops data:', stops.value)
  } catch (e) {
    console.error('Error loading stops data:', e)
    error.value = "No s'han pogut carregar les parades."
  }
}

const filteredStops = computed(() => {
  if (!stops.value?.byName) return []
  
  if (selectedLine.value === 'all') {
    return [...stops.value.byName.entries()]
  }
  
  // Filter based on the TramLines data from CSV
  return [...stops.value.byName.entries()].filter(([_, stop]) => {
    return stop.tramLines && stop.tramLines.includes(selectedLine.value)
  })
})


// Estado
const arrivals = computed(() => [...arrivalsOutbound.value, ...arrivalsReturn.value])
const isLoading   = ref(false)
const error       = ref<string|null>(null)
const remaining   = ref<Record<string, number>>({})  // serviceId → segundos

// Temporizadores
let refreshTimer: ReturnType<typeof setInterval>
let countdownTimer: ReturnType<typeof setInterval>

// Llamada al endpoint interno
async function fetchTramBoth() {
  if (!stopCode || !stops.value) return

  const stop = stops.value.byOutboundCode.get(stopCode) || stops.value.byReturnCode.get(stopCode)
  if (!stop) {
    error.value = "Parada no trobada."
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const [resOut, resRet] = await Promise.all([
      $fetch(`/api/tram/${stop.outboundCode}`),
      $fetch(`/api/tram/${stop.returnCode}`)
    ])
    arrivalsOutbound.value = Array.isArray(resOut) ? resOut : []
    arrivalsReturn.value = Array.isArray(resRet) ? resRet : []
    
    // Update remaining time immediately for new arrivals
    updateRemainingTimes()
  } catch (e: any) {
    console.error('TRAM API error', e)
    error.value = "No s'han pogut carregar els horaris."
  } finally {
    isLoading.value = false
  }
}

function getStopName(code: string | number): string | null {
  if (!stops.value) return null

  const stop =
    stops.value.byOutboundCode.get(String(code)) ||
    stops.value.byReturnCode.get(String(code))

  return stop ? stop.name : null
}


// Update remaining times for all arrivals
function updateRemainingTimes() {
  const now = Date.now()
  const allArrivals = [...arrivalsOutbound.value, ...arrivalsReturn.value]
  
  // Create a new object to avoid reactivity issues
  const newRemaining: Record<string, number> = {}
  
  allArrivals.forEach(item => {
    if (item && item.vehicleId && item.arrivalTime) {
      // Create a unique key using vehicleId + arrivalTime
      const uniqueKey = `${item.vehicleId}-${item.arrivalTime}`
      const diff = Math.floor((new Date(item.arrivalTime).getTime() - now) / 1000)
      newRemaining[uniqueKey] = diff > 0 ? diff : 0
    }
  })
  
  remaining.value = newRemaining
}

// Load data from CSV
const loadData = async () => {
  const res = await fetch('/data/tram/Stops.csv')
  const text = await res.text()
  const data = parse(text, { columns: true })
  return data
}

const goBack = () => {
  if (route.query.s) {
    router.replace({ query: {} })
  } else {
    router.push({ path: '/' })
  }
}
 
// Cuenta atrás de cada servicio
function tick() {
  Object.keys(remaining.value).forEach(id => {
    if (remaining.value[id] > 0) remaining.value[id]--
  })
}

// Después de traer arrivals, llenamos `remaining`
watch([arrivalsOutbound, arrivalsReturn], () => {
  updateRemainingTimes()
}, { immediate: true })

// Inicia timers
onMounted(() => {
  loadInterchangesData()
  initializeStops().then(() => {
    if (stopCode) {
      fetchTramBoth()
      const stopName = getStopName(stopCode)
      findInterchanges(stopName)
    } else {
      router.replace({ path: '/tram' })
    }
  })
  
  refreshTimer = setInterval(fetchTramBoth, 20_000)  // cada 20s
  countdownTimer = setInterval(tick, 1_000)   // cada 1s
})

onUnmounted(() => {
  clearInterval(refreshTimer)
  clearInterval(countdownTimer)
})

watch(selectedLine, (newLine) => {
  fetchStopsForLine(newLine as TramLine | 'all')
}, { immediate: true })

watch(() => route.query.s, (newCode) => {
  if (newCode && stops.value) {
    const stopName = getStopName(newCode as string)
    findInterchanges(stopName)
  }
})

// Helpers para formato
const fourNext = computed(() => arrivals.value.slice(0, 4))
function fmt(sec: number) {
  if (sec <= 0) return 'Ara'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2,'0')}`
}

const sortedOutbound = computed(() =>
  [...arrivalsOutbound.value].sort(
    (a, b) => (remaining.value[a.vehicleId] ?? 99999) - (remaining.value[b.vehicleId] ?? 99999)
  )
)

const sortedReturn = computed(() =>
  [...arrivalsReturn.value].sort(
    (a, b) => (remaining.value[a.vehicleId] ?? 99999) - (remaining.value[b.vehicleId] ?? 99999)
  )
)

function getUniqueKey(tram: any) {
  return `${tram.vehicleId}-${tram.arrivalTime}`
}

</script>

<template>
  <div class="p-4 min-h-screen dark:bg-[#1C6962] bg-[#37cbbf] text-black dark:text-white">
    <div class="mb-4">
      <button 
        class="p-1 px-2 bg-[#FFFFFF3d] dark:bg-[#0000003d] text-semibold text-black dark:text-white rounded-lg"
        @click="goBack"
      > <- Volver</button>
    </div>
    <div v-if="!stopCode">
      <!-- Line filter selector -->
      <div class="mb-4">
        <label class="block mb-2 font-medium">Filtrar por línea:</label>
        <div class="flex flex-wrap gap-2">
          <button 
            v-for="line in tramLines" 
            :key="line.id"
            @click="selectedLine = line.id"
            class="px-3 py-1 rounded-full text-sm"
            :class="selectedLine === line.id ? 
              'bg-white dark:bg-gray-800 text-[#1C6962] dark:text-[#37cbbf] font-bold' : 
              'bg-[#FFFFFF3d] dark:bg-[#0000003d] hover:bg-[#FFFFFF6d] dark:hover:bg-[#00000060]'"
          >
            {{ line.name }}
          </button>
        </div>
      </div>
      
      <!-- Stops grid -->
      <div class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="stop in (selectedLine === 'all' ? filteredStops.map(([_, s]) => s) : orderedStops)"
          :key="stop.outboundCode"
          @click="router.push({ query: { s: stop.outboundCode } })"
          class="p-3 bg-[#FFFFFF3d] dark:bg-[#0000003d] rounded-lg shadow cursor-pointer hover:bg-[#FFFFFF6d] dark:hover:bg-[#00000060] transition"
        >
          <h3 class="font-medium text-lg">{{ stop.name }}</h3>
          <div class="text-sm opacity-75">Codi: {{ stop.outboundCode }}</div>
        </div>
      </div>
    </div>
    <div v-if="stopCode">
      <h1 class="text-2xl mb-2">Parada: <strong>{{ getStopName(stopCode) }}</strong></h1>
      <div v-if="isLoading" class="py-4">Carregant…</div>
      <div v-else-if="error" class="py-4 text-red-500">{{ error }}</div>
      
      <div class="grid md:grid-cols-2 gap-4">
        <div>
          <h2 class="font-bold mb-2">→ Anada</h2>
          <ul class="space-y-2">
            <li v-for="tram in sortedOutbound.slice(0, 4)" :key="getUniqueKey(tram)" class="p-3 bg-[#FFFFFF3d] dark:bg-[#0000003d] rounded shadow">
              <div class="flex justify-between items-center">
                <div>
                  <div class="font-semibold">Línia {{ tram.lineName }} → {{ tram.destination }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">Vehicle #{{ tram.vehicleId }}</div>
                </div>
                <div class="text-2xl font-bold">{{ fmt(remaining[getUniqueKey(tram)]) }}</div>
              </div>
            </li>
            <li v-if="arrivalsOutbound.length === 0" class="text-sm text-center text-gray-500">No hi ha serveis</li>
          </ul>
        </div>

        <div>
          <h2 class="font-bold mb-2">← Tornada</h2>
          <ul class="space-y-2">
            <li v-for="tram in sortedReturn.slice(0, 4)" :key="getUniqueKey(tram)" class="p-3 bg-[#FFFFFF3d] dark:bg-[#0000003d] rounded shadow">
              <div class="flex justify-between items-center">
                <div>
                  <div class="font-semibold">Línia {{ tram.lineName }} → {{ tram.destination }}</div>
                  <div class="text-sm text-gray-600 dark:text-gray-400">Vehicle #{{ tram.vehicleId }}</div>
                </div>
                <div class="text-2xl font-bold">{{ fmt(remaining[getUniqueKey(tram)]) }}</div>
              </div>
            </li>
            <li v-if="arrivalsReturn.length === 0" class="text-sm text-center text-gray-500">No hi ha serveis</li>
          </ul>
        </div>
      </div>
      
    </div>
  </div>
</template>

<style scoped>
/* tus estilos… */
</style>
