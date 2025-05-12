<script setup>
const route = useRoute()

const estacion = route.query.s
const linea = route.query.l
const destino = route.query.d

const data = ref(null)

const fetchFGC = async () => {
  // Lógica para llamar a la API de FGC o usar mock
  console.log('Cargar datos de FGC:', estacion, linea, destino)
}

onMounted(fetchFGC)
</script>

<template>
  <div>
    <h1 class="text-xl font-bold">FGC</h1>
    <p>Estación: {{ estacion }}</p>
    <p>Línea: {{ linea }}</p>
    <p>Dirección: {{ destino }}</p>
    
    <!-- Mostrar datos reales aquí -->
  </div>
</template>