<!-- pages/tram.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import papa from 'papaparse'

// Parámetros de ruta
const route = useRoute()
const router = useRouter()
const stopCode = route.query.s as string || ''

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

// Load and transform CSV data into maps
const initializeStops = async () => {
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
const arrivals    = ref<any[]>([])    // lista de próximos trams
const isLoading   = ref(false)
const error       = ref<string|null>(null)
const remaining   = ref<Record<string, number>>({})  // serviceId → segundos

// Temporizadores
let refreshTimer: ReturnType<typeof setInterval>
let countdownTimer: ReturnType<typeof setInterval>

// Llamada al endpoint interno
async function fetchTram() {
  if (!stopCode) return
  isLoading.value = true
  error.value     = null
  try {
    const res = await $fetch(`/api/tram/${stopCode}`)
    // res es un array de StopTime:
    // { vehicleId, stopName, code, arrivalTime, destination, lineName, occupancy }
    arrivals.value = Array.isArray(res) 
      ? res 
      : []
    console.log('Fetched tram data:', arrivals.value)
  } catch (e: any) {
    console.error('TRAM API error', e)
    error.value = "No s'han pogut carregar els horaris."
  } finally {
    isLoading.value = false
  }
}

// Load data from CSV
const loadData = async () => {
  const res = await fetch('/data/tram/Stops.csv')
  const text = await res.text()
  const data = papa.parse(text, { header: true })
  return data.data
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
watch(arrivals, (list) => {
  const now = Date.now()
  remaining.value = {}
  list.forEach(item => {
    // arrivalTime: "2025-05-22 15:45:40"
    const diff = Math.floor((new Date(item.arrivalTime).getTime() - now) / 1000)
    remaining.value[item.vehicleId] = diff > 0 ? diff : 0
  })
}, { immediate: true })

// Inicia timers
onMounted(() => {
  initializeStops()
  if (!stopCode) {
    router.replace({ path: '/tram' })
    return
  }
  fetchTram()
  refreshTimer   = setInterval(fetchTram,   20_000)  // cada 20s
  countdownTimer = setInterval(tick,         1_000)   // cada 1s
})
onUnmounted(() => {
  clearInterval(refreshTimer)
  clearInterval(countdownTimer)
})

// Helpers para formato
const fourNext = computed(() => arrivals.value.slice(0, 4))
function fmt(sec: number) {
  if (sec <= 0) return 'Ara'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m} :${String(s).padStart(2,'0')}`
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
          v-for="[name, stopInfo] in filteredStops"
          :key="stopInfo.outboundCode"
          @click="router.push({ query: { s: stopInfo.outboundCode } })"
          class="p-3 bg-[#FFFFFF3d] dark:bg-[#0000003d] rounded-lg shadow cursor-pointer hover:bg-[#FFFFFF6d] dark:hover:bg-[#00000060] transition"
        >
          <h3 class="font-medium text-lg">{{ name }}</h3>
          <div class="text-sm opacity-75">Codi: {{ stopInfo.outboundCode }}</div>
        </div>
      </div>
    </div>
    <div v-if="stopCode">
      <h1 class="text-2xl mb-2">Horaris TRAM – Parada {{ stopCode }}</h1>
      <div v-if="isLoading" class="py-4">Carregant…</div>
      <div v-else-if="error" class="py-4 text-red-500">{{ error }}</div>
      
      <ul v-else class="space-y-4">
        <li v-for="tram in fourNext" :key="tram.vehicleId" class="p-4 bg-[#FFFFFF3d] dark:bg-[#0000003d] rounded shadow">
          <div class="flex justify-between items-center">
            <div class="max-w-[75%] ">
              <div class="text-lg font-semibold">
                Línia {{ tram.lineName }} → {{ tram.destination }}
              </div>
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Vehicle #{{ tram.vehicleId }}
              </div>
            </div>
            <div class="text-3xl font-bold">
              {{ fmt(remaining[tram.vehicleId]) }}
            </div>
          </div>
        </li>
        <li v-if="fourNext.length === 0" class="text-center text-gray-500">
          No hi ha pròxims serveis
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
/* tus estilos… */
</style>
