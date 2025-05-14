<script setup>
const route = useRoute()

const estacion = route.query.s
const linea = route.query.l
const destino = route.query.d

// Aquí pones tu clave y lógica de llamada a la API de TMB
const claveTMB = '5c68a6b4727d9860c62abe6354495735'
const data = ref(null)

const fetchTMB = async () => {
  if (!estacion || !linea) return

  // Aquí pondrías la URL de la API real
  // https://api.tmb.cat/v1/imetro/linia/3/estacio/323?app_id=135507ad&app_key=5c68a6b4727d9860c62abe6354495735
  const url = `https://api.tmb.cat/v1/imetro/linia/${linea}/estacio/${estacion}?app_id=135507ad&app_key=${claveTMB}`

  try {
    const res = await $fetch(url)
    data.value = res
  } catch (e) {
    console.error('Error al cargar datos TMB', e)
  }
}

onMounted(fetchTMB)
//PARTE VISUAL

import MetroLine from '@/components/MetroLine.vue'
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
        <h1 class="text-black dark:text-white "><span class="font-bold">Estació: </span>La Sagrera</h1>
        <h1 class="text-black dark:text-white "><span class="font-bold">Direcció: </span>Fondo</h1>
        </div>
      </div>
    </div>
      <div class="flex-row text-center my-15">
        <h1 class="text-black dark:text-white"><span class="font-bold">Sigiente: </span>1:20 min</h1>
        <div>
          <MetroLine
            :stations="stations"
            :currentStation="currentStation"
            :lineColor="lineColor"
          />
        </div>
        <h1 class="text-black dark:text-white "><span class="font-bold">Proxima: </span>3:20 min</h1>
      </div>
    <!-- Mapa -->
    <!-- Pròxims trens -->
    <div>

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
