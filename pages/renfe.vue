<script setup>
const route = useRoute()

const estacion = route.query.s
const linea = route.query.l
const destino = route.query.d

const data = ref(null)

const fetchRenfe = async () => {
  // Lógica para llamar a la API de Renfe si existe o usar datos simulados
  console.log('Cargar datos de Renfe:', estacion, linea, destino)
}

onMounted(fetchRenfe)
</script>

<template>
  <div>
    <h1 class="text-xl font-bold">Rodalies (Renfe)</h1>
    <p>Estación: {{ estacion }}</p>
    <p>Línea: {{ linea }}</p>
    <p>Dirección: {{ destino }}</p>
    
    <!-- Mostrar datos reales aquí -->
  </div>
</template>