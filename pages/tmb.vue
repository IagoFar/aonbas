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
</script>

<template>
  <!-- Info estació -->
  <div>
    <div>
      
    </div>

  </div>
  <!-- Mapa -->
  <div>
    <div class="line-container">
    <div class="line">
      <div
        v-for="(station, index) in stations"
        :key="station.name"
        class="station"
      >
        <div
          class="circle"
          :class="{
            past: index < currentIndex,
            current: index === currentIndex,
            future: index > currentIndex
          }"
        ></div>
        <div class="station-name" :class="{ current: index === currentIndex }">
          {{ station.name }}
        </div>
      </div>
    </div>
  </div>
  </div>
  <!-- Pròxims trens -->
  <div>

  </div>
  <!-- Enllaços -->
  <div>

  </div>
</template>
