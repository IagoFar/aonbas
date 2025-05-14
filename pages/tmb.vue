<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import Papa from 'papaparse'

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

let apiRefreshTimer = null
let countdownTimer = null

// Aquí pones tu clave y lógica de llamada a la API de TMB
const claveTMB = '5c68a6b4727d9860c62abe6354495735'

const loadStationData = async () => {
  try {
    const response = await fetch('/data/metro/estacions_linia.csv')
    const csvData = await response.text()

    Papa.parse(csvData, {
      header: true,
      complete: (results) => {
        results.data.forEach(station => {
          if (station.CODI_ESTACIO) {
            stationNameMap.value[station.CODI_ESTACIO] = station.NOM_ESTACIO
          }
        })
      }
    })
  } catch (error) {
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
  }
  if (secondCountdown.value > 0) {
    secondCountdown.value--
  }
}

const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return 'Entra'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const formattedCountdown = computed(() =>  formatTime(countdown.value))
const formattedSecondTrainTime = computed(() => formatTime(secondTrainTime.value))

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
//PARTE VISUAL

const stations = [
  { name: 'Clot', correspondence: true },
  { name: 'Navas', correspondence: false },
  { name: 'La Sagrera', correspondence: true },
  { name: 'Fabra i Puig', correspondence: true },
  { name: 'Sant Andreu', correspondence: false }
]
const currentStation = 'La Sagrera'
const lineColor = '#E60012'
</script>

<template>
  <div class="p-10 dark:bg-[#1C6962] bg-[#37cbbf] text-black dark:text-white min-h-screen">
    <!-- Info estació -->
    <div>
      <div class="flex flex-row items-center">
        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Barcelona_Metro_Logo.svg/440px-Barcelona_Metro_Logo.svg.png" alt="Logo TMB" class="h-15 mr-2" /> 
        <img src="../public/metro/L1.png" alt="logo L1" class="w-15 mr-5  ">
        <div>
        <h1 class="text-black dark:text-white "><span class="font-bold">Estació: </span>{{ getStationName }}</h1>
        <h1 class="text-black dark:text-white "><span class="font-bold">Direcció: </span>{{ getDestinationName }}</h1>
        </div>
      </div>
    </div>
    <div class="flex-row text-center my-15">
      <h1 class="text-black dark:text-white"><span class="font-bold">Següent tren: </span>{{ formattedCountdown }}</h1>
      <div>
        <MetroLine
          :stations="stations"
          :currentStation="currentStation"
          :lineColor="lineColor"
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
        <img src="../public/metro/L5_barcelona.png" alt="L5" class="py-2 w-10 mr-5">
        <img src="../public/metro/L9N_Barcelona.svg" alt="L9N" class="py-2 w-10 mr-5">
        <img src="../public/metro/L10_Nord_barcelona.png" alt="L10N" class="py-2 w-10 mr-5">
        <img src="../public/renfe/Rodalies.png" alt="L5" class="py-2 w-10 mr-5">
      </div> 
    </div>
  </div>
  <div>
    <img src="../public/Aonbas-Eslogan.png" alt="eslogan aonbas">
  </div>
</template>
