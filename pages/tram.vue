<!-- pages/tram.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

// Parámetros de ruta
const route = useRoute()
const router = useRouter()
const stopCode = route.query.s as string || ''

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
  } catch (e: any) {
    console.error('TRAM API error', e)
    error.value = "No s'han pogut carregar els horaris."
  } finally {
    isLoading.value = false
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
const twoNext = computed(() => arrivals.value.slice(0, 2))
function fmt(sec: number) {
  if (sec <= 0) return 'Ara'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m} :${String(s).padStart(2,'0')}`
}
</script>

<template>
  <div class="p-4 min-h-screen bg-[#f0f0f0] dark:bg-[#222] text-black dark:text-white">
    <button @click="router.push('/tram')" class="mb-4 underline">← Canvia parada</button>
    <h1 class="text-2xl mb-2">Horaris TRAM – Parada {{ stopCode }}</h1>
    
    <div v-if="isLoading" class="py-4">Carregant…</div>
    <div v-else-if="error" class="py-4 text-red-500">{{ error }}</div>
    
    <ul v-else class="space-y-4">
      <li v-for="tram in twoNext" :key="tram.vehicleId" class="p-4 bg-white dark:bg-[#333] rounded shadow">
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
      <li v-if="twoNext.length === 0" class="text-center text-gray-500">
        No hi ha pròxims serveis
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* tus estilos… */
</style>
