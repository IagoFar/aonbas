<template>
  <div>

    <!-- Main Content -->
    <div class="min-h-screen bg-teal-400 dark:bg-teal-700 flex flex-col items-center pt-10 space-y-4 pb-20">
      <img src="/Aonbas.png" alt="Aonbas" class="w-50 rounded-2xl">
      <h1 class="text-white text-4xl font-bold">Aonbas</h1>
      <p class="text-white text-center">La teva ruta, el teu ritme, tu on vas?</p>

      <div 
        v-for="transport in transports"
        :key="transport"
        class="flex gap-y-4 w-[80%] bg-[#ffffff3d] dark:bg-[#0000003d] hover:size-110 items-center rounded-md "
        @click="selectTranport(transport)"
      >
        <img :src="getTransportLogo(transport)" :alt="`${transport} logo`" class="w-15 h-15 rounded-sm ml-[30%] m-2">
        <h2 class="text-white text-2xl font-bold">{{ transport }}</h2>
      </div>
    </div>
    <div>
      <button
      @click="router.push('/testapi')">
        Test API Page
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'    

const router = useRouter()

const transports = ref(['Metro', 'Rodalies', 'FGC', 'Tramvia'])

const routeMap = {
  'Metro': '/tmb',
  'Rodalies': '/renfe',
  'FGC': '/fgc',
  'Tramvia': '/tram'
}

const stationCodes = ref({})
const lineCodes = ref({})

 
const getTransportLogo = (transport) => {
  switch (transport) {
    case 'Metro':
      return '/Logos/FMB.svg'
    case 'Rodalies':
      return '/Logos/ROD.svg'
    case 'FGC':
      return '/Logos/FGC.svg'
    case 'Tramvia':
      return '/Logos/TRAM.svg'
    default:
      return ''
  }
}

const selectTranport = (transport) => {
  router.push(routeMap[transport])
}

</script>

<style scoped>
select:disabled {
  background-color: #ccc;
}
.splash-fade-enter-active, .splash-fade-leave-active {
  transition: opacity 1s;
}
.splash-fade-enter, .splash-fade-leave-to {
  opacity: 0;
}
</style>