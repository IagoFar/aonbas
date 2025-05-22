<script setup>
import { ref, computed } from 'vue'

// Available APIs to test
const apis = [
  { id: 'tmb', name: 'TMB (Metro/Bus)', baseUrl: '/api/tmb/' },
  { id: 'tram', name: 'TRAM (Stops)', baseUrl: '/api/tram/' },
  { id: 'tramTest', name: 'TRAM (Advanced Test)', baseUrl: '/api/tram/test?endpoint=' },
]

// State
const selectedApi = ref(apis[0].id)
const paramValue = ref('')
const isLoading = ref(false)
const response = ref(null)
const error = ref(null)
const startTime = ref(null)
const endTime = ref(null)

// Example placeholder based on selected API
const placeholder = computed(() => {
  switch(selectedApi.value) {
    case 'tmb':
      return 'Enter stop code (e.g., 1234)'
    case 'tram':
      return 'Enter stop code (e.g., 1001)'
    case 'tramTest':
      return 'Enter TRAM API endpoint (e.g., stopTimes/1001)'
    default:
      return 'Enter parameter'
  }
})

// Example text based on selected API
const exampleText = computed(() => {
  switch(selectedApi.value) {
    case 'tmb':
      return 'Examples: stop code like "1234"'
    case 'tram':
      return 'Examples: stop code like "1001"'
    case 'tramTest':
      return 'Examples: "stopTimes/1001", "lines", "stations", etc.'
    default:
      return ''
  }
})

// Computed base URL based on selected API
const baseUrl = computed(() => {
  const api = apis.find(a => a.id === selectedApi.value)
  return api ? api.baseUrl : ''
})

// Execution time
const executionTime = computed(() => {
  if (!startTime.value || !endTime.value) return null
  return (endTime.value - startTime.value) / 1000 // in seconds
})

// Test the API
async function testApi() {
  if (!paramValue.value.trim()) {
    error.value = 'Please enter a parameter value'
    return
  }
  
  isLoading.value = true
  error.value = null
  response.value = null
  startTime.value = performance.now()
  
  try {
    const url = `${baseUrl.value}${paramValue.value}`
    console.log(`Fetching from: ${url}`)
    
    const res = await fetch(url)
    endTime.value = performance.now()
    
    if (!res.ok) {
      throw new Error(`API responded with status ${res.status}`)
    }
    
    const data = await res.json()
    response.value = data
  } catch (err) {
    endTime.value = performance.now()
    error.value = err.message
    console.error('API test error:', err)
  } finally {
    isLoading.value = false
  }
}

// Format JSON for display
function formatJSON(data) {
  return JSON.stringify(data, null, 2)
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-6">API Response Tester</h1>
    
    <div class="bg-white rounded-lg shadow p-4 mb-6">
      <div class="mb-4">
        <label class="block text-sm font-medium mb-1">Select API</label>
        <select 
          v-model="selectedApi"
          class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option v-for="api in apis" :key="api.id" :value="api.id">
            {{ api.name }}
          </option>
        </select>
      </div>
      
      <div class="mb-4">
        <label class="block text-sm font-medium mb-1">Parameter</label>
        <div class="flex">
          <div class="bg-gray-100 px-3 py-2 rounded-l-md border border-gray-300 flex items-center">
            {{ baseUrl }}
          </div>
          <input
            v-model="paramValue"
            type="text"
            :placeholder="placeholder"
            class="flex-1 px-3 py-2 border border-gray-300 rounded-r-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            @keyup.enter="testApi"
          />
        </div>
        <p class="text-xs text-gray-500 mt-1">
          {{ exampleText }}
        </p>
      </div>
      
      <button
        @click="testApi"
        class="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        :disabled="isLoading"
      >
        {{ isLoading ? 'Loading...' : 'Test API' }}
      </button>
    </div>
    
    <div v-if="error || response" class="bg-white  rounded-lg shadow p-4">
      <div v-if="executionTime !== null" class="mb-2 text-sm">
        Execution time: <span class="font-mono">{{ executionTime.toFixed(3) }}s</span>
      </div>
      
      <div v-if="error" class="p-4 bg-red-50  text-red-700 rounded-md">
        {{ error }}
      </div>
      
      <div v-if="response" class="mt-4">
        <h2 class="text-lg font-semibold mb-2">Response:</h2>
        <pre class="bg-gray-50 p-4 rounded-md overflow-x-auto font-mono text-sm">{{ formatJSON(response) }}</pre>
      </div>
    </div>
  </div>
</template>