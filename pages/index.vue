<script setup>
const router = useRouter()

const operador = ref('tmb')
const estacion = ref('')
const linea = ref('')
const destino = ref('')

const buscar = () => {
  router.push({
    path: `/${operador.value}`,
    query: {
      s: estacion.value,
      l: linea.value,
      d: destino.value,
    }
  })
}
</script>

<template>
  <div class="space-y-4">
    <select v-model="operador">
      <option value="tmb">TMB</option>
      <option value="renfe">Renfe</option>
      <option value="fgc">FGC</option>
    </select>

    <input v-model="linea" placeholder="Línea" />
    <input v-model="estacion" placeholder="Estación" />
    <input v-model="destino" placeholder="Destino" />

    <button @click="buscar">Buscar</button>
  </div>
</template>
