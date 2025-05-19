<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Papa from 'papaparse'
import MetroLine from '@/components/MetroLine.vue'

const route = useRoute()
const router = useRouter()

const lines = ['1','2','3','4','5','94', '91','104','101','11']
const stations = ref([])

// Station-specific parameters
const estacion = route.query.s
const linea = route.query.l
const destino = '1'

// State management
const data = ref(null)
const isLoading = ref(false)
const error = ref(null)

// Train time tracking
const nextTrainTime = ref(null)
const secondTrainTime = ref(null)
const countdown = ref(null)
const secondCountdown = ref(null)

// Data mapping
const stationNameMap = ref({})
const stationDataMap = ref({})
const lineStationMap = ref({})
const interchangeData = ref({}) // New ref for interchange data

// Timers
let apiRefreshTimer = null
let countdownTimer = null

const claveTMB = '5c68a6b4727d9860c62abe6354495735'

const loadInterchangeData = async () => {
  try {
    const response = await fetch('/data/info_stations.csv')
    const csvData = await response.text()
    
    Papa.parse(csvData, {
      header: true,
      complete: (results) => {
        results.data.forEach(station => {
          if (station.NOM_METRO) {
            // Parse metro lines correctly
            const metroLines = station.LINIES_METRO ? 
              station.LINIES_METRO.match(/L[0-9]+[NS]*/g) : [];
            
            // Parse Renfe lines correctly  
            const renfeLines = station.LINIES_RENFE ? 
              station.LINIES_RENFE.match(/R[0-9]+|RG[0-9]+/g) : [];
            
            // Parse FGC lines correctly
            const fgcLines = station.LINIES_FGC ? 
              station.LINIES_FGC.match(/[SLR][0-9]+|RL[0-9]+/g) : [];
            
            // Parse Tram lines correctly
            const tramLines = station.LINIES_TRAM ? 
              station.LINIES_TRAM.match(/T[0-9]+/g) : [];
            
            interchangeData.value[station.NOM_METRO] = {
              metro: metroLines || [],
              renfe: renfeLines || [], 
              fgc: fgcLines || [],
              tram: tramLines || []
            }
          }
        })
        console.log('Loaded interchange data:', interchangeData.value)
      }
    })
  } catch (error) {
    console.error('Error loading interchange data:', error)
  }
}

const loadLineStations = (line) => {
  fetch('/data/metro/estacions_linia.csv')
    .then(r => r.text())
    .then(csv => {
      Papa.parse(csv, {
        header: true,
        complete(res) {
          stations.value = res.data
            .filter(s => s.CODI_LINIA === line)
            .map(s => ({
              code: s.CODI_ESTACIO,
              name: s.NOM_ESTACIO
            }))
        }
      })
    })
}

const loadStationData = async () => {
  try {
    // Load both CSVs
    const [stationResponse, lineStationResponse] = await Promise.all([
      fetch('/data/metro/estacions.csv'),
      fetch('/data/metro/estacions_linia.csv')
    ])
    
    const stationCsvData = await stationResponse.text()
    const lineStationCsvData = await lineStationResponse.text()
    
    Papa.parse(stationCsvData, {
      header: true,
      complete: (results) => {
        results.data.forEach(station => {
          if (station.NOM_ESTACIO && station.PICTO) {
            const isInterchange = station.PICTO && (
              station.PICTO.length > 2
            );
            
            stationDataMap.value[station.NOM_ESTACIO] = {
              name: station.NOM_ESTACIO,
              code: station.CODI_GRUP_ESTACIO,
              picto: station.PICTO,
              isInterchange: isInterchange
            }
          }
        })
        
        console.log('Loaded station data with interchanges:', stationDataMap.value)
      }
    })
    
    // Update the parsing of line-station data to track line associations
    Papa.parse(lineStationCsvData, {
      header: true,
      complete: (results) => {
        // Initialize line-station map
        lineStationMap.value = {}
        
        results.data.forEach(station => {
          if (station.CODI_ESTACIO && station.CODI_LINIA) {
            // Map station code to name
            stationNameMap.value[station.CODI_ESTACIO] = station.NOM_ESTACIO
            
            // Group stations by line
            if (!lineStationMap.value[station.CODI_LINIA]) {
              lineStationMap.value[station.CODI_LINIA] = []
            }
            
            // Only add if not already in array
            if (!lineStationMap.value[station.CODI_LINIA].includes(station.NOM_ESTACIO)) {
              lineStationMap.value[station.CODI_LINIA].push(station.NOM_ESTACIO)
            }
          }
        })
        
        console.log('Loaded line-station mappings:', lineStationMap.value)
      }
    })
  } catch (error) {
    console.error('Error loading station data:', error)
  }
}

const fetchTMB = async () => {
  if (!estacion || !linea) return

  isLoading.value = true

  try {
    const url = `https://api.tmb.cat/v1/imetro/linia/${linea}/estacio/${estacion}?app_id=135507ad&app_key=${claveTMB}`
    const res = await $fetch(url)
    data.value = res

    console.log('API response:', data.value)

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


const testApiResponse = () => {
  // Mock API response data
  const mockData = [
    {
      "codi_linia": 3,
      "codi_via": 1,
      "codi_estacio": 329,
      "ocupacio_estacio_sortida": {
        "percentatge_ocupacio": 39
      },
      "propers_trens": [
        {
          "codi_servei": "306",
          "temps_arribada": 1747405891000,
          "temps_restant": 177,
          "codi_linia": 3,
          "nom_linia": "L3",
          "codi_trajecte": "0031",
          "desti_trajecte": "Trinitat Nova",
          "info_tren": {}
        },
        {
          "codi_servei": "307",
          "temps_arribada": 1747406212000,
          "temps_restant": 498,
          "codi_linia": 3,
          "nom_linia": "L3",
          "codi_trajecte": "0031",
          "desti_trajecte": "Trinitat Nova",
          "info_tren": {
            "percentatge_ocupacio": 38,
            "percentatge_ocupacio_cotxes": [
              40, 44, 20, 40, 47
            ]
          }
        }
      ]
    },
    {
      "codi_linia": 3,
      "codi_via": 2,
      "codi_estacio": 329,
      "ocupacio_estacio_sortida": {
        "percentatge_ocupacio": 40
      },
      "propers_trens": [
        {
          "codi_servei": "321",
          "temps_arribada": 1747405776000,
          "temps_restant": 62,
          "codi_linia": 3,
          "nom_linia": "L3",
          "codi_trajecte": "0032",
          "desti_trajecte": "Zona Universitària",
          "info_tren": {
            "percentatge_ocupacio": 13,
            "percentatge_ocupacio_cotxes": [
              0, 9, 3, 23, 29
            ]
          }
        },
        {
          "codi_servei": "322",
          "temps_arribada": 1747405969000,
          "temps_restant": 255,
          "codi_linia": 3,
          "nom_linia": "L3",
          "codi_trajecte": "0032",
          "desti_trajecte": "Zona Universitària",
          "info_tren": {
            "percentatge_ocupacio": 10,
            "percentatge_ocupacio_cotxes": [
              4, 5, 0, 15, 23
            ]
          }
        }
      ]
    }
  ];

  // Set the data
  data.value = mockData;
  
  console.log('Mock API response:', data.value);

  // Process the mock data the same way fetchTMB does
  if (Array.isArray(data.value) && data.value.length > 0) {
    // Set current line if not set
    if (!linea) {
      linea = data.value[0].codi_linia.toString();
    }
    
    // Find direction data based on destino param
    const currentDestino = destino || '1'; // Default to direction 1 if not specified
    const directionData = data.value.find(d => d.codi_via.toString() === currentDestino);

    if (directionData && directionData.propers_trens && directionData.propers_trens.length > 0) {
      // Set data for first train
      nextTrainTime.value = directionData.propers_trens[0].temps_restant;
      countdown.value = nextTrainTime.value;

      // Set data for second train if available
      if (directionData.propers_trens.length > 1) {
        secondTrainTime.value = directionData.propers_trens[1].temps_restant;
        secondCountdown.value = secondTrainTime.value;
      }
    }
  }
}

const updateCountdown = () => {
  if (countdown.value > 0) {
    countdown.value--
  } else if (countdown.value <= 0) {
    countdown.value = "0"
  }
  if (secondCountdown.value > 0) {
    secondCountdown.value--
  }
}

const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return '--:--'
  if (seconds === 0) return 'Surt'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const formattedCountdown = computed(() =>  formatTime(countdown.value))
const formattedSecondTrainTime = computed(() => formatTime(secondCountdown.value))



const getLogoPath = (interchange) => {
  if (!interchange) return '';
  
  const { type, line } = interchange;
  
  switch (type) {
    case 'metro':
      return `/Logos/${line}.svg`;
    case 'renfe':
      return `/Logos/${line}.svg`;
    case 'fgc':
      return `/Logos/${line}.svg`;
    case 'tram':
      return `/Logos/${line}.svg`;
    default:
      return '';
  }
};



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

const contextualStations = computed(() => {
  if (!getStationName.value || !stationDataMap.value) {
    return getDefaultStations();
  }
  
  // Get 5 stations centered on the current one (or suitable range if near end)
  const currentStationName = getStationName.value;
  const allStations = data.value && Array.isArray(data.value) && data.value.length > 0
    ? getLineStations(data.value[0].codi_linia)
    : getDefaultStations().map(s => s.name);
  
  const currentIndex = allStations.indexOf(currentStationName);
  
  // If station not found, return default
  if (currentIndex === -1) {
    return getDefaultStations();
  }
  
  // Calculate range of stations to show (2 before, current, 2 after - or adjusted if near end)
  const start = Math.max(0, currentIndex - 2);
  const end = Math.min(allStations.length, start + 5);
  
  // Adjust start if we're near the end to ensure we always show 5 stations if possible
  const adjustedStart = end - 5 >= 0 ? Math.max(start, end - 5) : start;
  
  return allStations.slice(adjustedStart, end).map(name => ({
    name,
    correspondence: stationDataMap.value[name]?.isInterchange || false
  }));
})

const switchToLine = (targetLine) => {
  // Extract the line number from the format (e.g., "L3" -> "3")
  const newLine = targetLine.replace('L', '');
  
  // Get the current station name
  const currentStation = getStationName.value;
  
  if (!currentStation) return;
  
  // Find the station code for this station name on the target line
  const stationOnTargetLine = findStationCodeByNameAndLine(currentStation, newLine);
  
  if (stationOnTargetLine) {
    // Navigate to the same station but on the new line
    router.replace({ 
      query: { 
        l: newLine,
        s: stationOnTargetLine 
      }
    });
  } else {
    console.warn(`Station ${currentStation} does not exist on line ${newLine}`);
    // Optionally show a notification to the user
  }
};

const findStationCodeByNameAndLine = (stationName, targetLine) => {
  const allStations = stations.value;

  // Buscar primero entre las estaciones ya cargadas
  if (allStations?.length > 0) {
    const match = allStations.find(s => s.name === stationName && s.code.startsWith(getLinePrefix(targetLine)));
    if (match) return match.code;
  }

  // Mapeo de líneas a prefijos
  const getLinePrefix = (line) => {
    const prefixes = {
      '1': '1',
      '2': '2',
      '3': '3',
      '4': '4',
      '5': '5',
      '9N': '94',
      '94': '94',
      '9S': '91',
      '91': '91',
      '10N': '104',
      '104': '104',
      '10S': '101',
      '101': '101',
      '11': '11'
    };
    return prefixes[line] || line;
  };

  const linePrefix = getLinePrefix(targetLine);
  let matchingCode = null;

  Object.entries(stationNameMap.value).forEach(([code, name]) => {
    if (name === stationName && code.startsWith(linePrefix)) {
      matchingCode = code;
    }
  });

  if (matchingCode) {
    console.log(`Found station code ${matchingCode} for station ${stationName} on line L${targetLine}`);
    return matchingCode;
  }

  console.warn(`Could not find station code for ${stationName} on line L${targetLine}`);
  return null;
};

// Default stations if we can't get real data
function getDefaultStations() {
  return [
    { name: 'Clot', correspondence: true },
    { name: 'Navas', correspondence: false },
    { name: 'La Sagrera', correspondence: true },
    { name: 'Fabra i Puig', correspondence: false },
    { name: 'Sant Andreu', correspondence: false }
  ];
}

function getLineStations(lineCode) {
  // Return only stations for the specified line
  if (lineCode && lineStationMap.value[lineCode]) {
    return lineStationMap.value[lineCode]
  }
  // Fallback to default stations if line not found
  return getDefaultStations().map(s => s.name)
}

const getInterchanges = computed(() => {
  const station = getStationName.value;
  if (!station || !interchangeData.value[station]) return [];
  
  const interchange = interchangeData.value[station];
  const currentMetroLine = `L${linea}`;
  
  const result = [];
  
  // Add Metro interchanges
  if (interchange.metro) {
    interchange.metro.forEach(line => {
      if (line && line !== currentMetroLine) {
        result.push({
          type: 'metro',
          line: line
        });
      }
    });
  }
  
  // Add Renfe interchanges
  if (interchange.renfe && interchange.renfe.length > 0) {
    interchange.renfe.forEach(line => {
      result.push({
        type: 'renfe',
        line: line
      });
    });
  }
  
  // Add FGC interchanges
  if (interchange.fgc && interchange.fgc.length > 0) {
    interchange.fgc.forEach(line => {
      result.push({
        type: 'fgc',
        line: line
      });
    });
  }
  
  // Add Tram interchanges
  if (interchange.tram && interchange.tram.length > 0) {
    interchange.tram.forEach(line => {
      result.push({
        type: 'tram',
        line: line
      });
    });
  }
  
  return result;
});

const getLineLogoPath = computed(() => {
  if (linea) {
    return `/Logos/L${linea}.svg`
  }
  return '/Logos/L1.svg' // Default fallback
});

onMounted(() => {
  const l = route.query.l
  if (l) {
    loadLineStations(l)
  }
  
  loadStationData()
  loadInterchangeData() 

  // Only run API calls if we're viewing a station
  if (estacion && linea) {
    fetchTMB()
    // Fake data for testing
    //testApiResponse()
    
    apiRefreshTimer = setInterval(() => {
      fetchTMB()
    }, 20000) // 10 seconds
    
    countdownTimer = setInterval(() => {
      updateCountdown()
    }, 1000) // 1 second
  }
})

onUnmounted(() => {
  if (apiRefreshTimer) clearInterval(apiRefreshTimer)
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>
<template>
  <div>
    <!-- Sin query → elige línea -->
    <div v-if="!route.query.l">
      <h2 class="mb-4 font-bold">Selecciona línea</h2>
      <div class="flex gap-4">
        <button
          v-for="l in lines"
          :key="l"
          class="px-4 py-2 rounded"
          @click="() => router.replace({ query: { l } })"
        ><img :src="`/Logos/L${l}.svg`" :alt="`L${l}`" class="w-20 h-20"></button>
      </div>
    </div>
    <!-- Con query.l → lista de estaciones -->
    <div v-if="route.query.l && !route.query.s">
      <h2 class="mb-4 font-bold">Estacions Línia {{ route.query.l }}</h2>
      <ul class="list-disc pl-6">
        <li
          v-for="station in stations"
          :key="station.code"
          class="cursor-pointer hover:underline"
          @click="() => router.replace({ query: { l: route.query.l, s: station.code } })"
        >
          {{ station.name }}
        </li>
      </ul>
    </div>

    <div v-if="route.query.s" class="p-10 dark:bg-[#1C6962] bg-[#37cbbf] text-black dark:text-white min-h-screen">
    <!-- Info estació -->
    <div>
      <div class="flex flex-row items-center">
        <img src="/Logos/FMB.svg" alt="Logo TMB" class="h-15 mr-2" /> 
        <img :src="getLineLogoPath" :alt="`Línia ${linea}`" class="w-15 mr-5">
        <div>
        <h1 class="text-black dark:text-white "><span class="font-bold">Estació: </span>{{ getStationName }}</h1>
        <h1 class="text-black dark:text-white "><span class="font-bold">Direcció: </span>{{ getDestinationName }}</h1>
        </div>
      </div>
    </div>
    <div class="flex-row text-center my-15">
      <h1 class="text-black dark:text-white"><span class="font-bold">Següent tren: </span>{{ formattedCountdown }}</h1>
      <div class=" dark:bg-black bg-white rounded-md">
        <MetroLine
          :stations="contextualStations"
          :currentStation="getStationName"
          :line="linea"
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
      <!-- Enllaços section with operator grouping -->
      <div class="bg-[#1C6962] dark:bg-[#37cbbf] rounded-md w-full p-2">
        <h1 class="ml-2 font-bold text-black dark:text-white mb-2">Enllaços:</h1>
        
        <!-- If no interchanges available -->
        <div v-if="getInterchanges.length === 0" class="text-black dark:text-white ml-2">
          No hi ha enllaços disponibles
        </div>
        
        <div class="space-y-3">
          <!-- Metro interchanges with click functionality -->
          <div v-if="getInterchanges.filter(i => i.type === 'metro').length > 0" class="ml-2">
            <div class="flex items-center mb-1">
              <img src="/Logos/FMB.svg" alt="Metro" class="h-6 w-auto mr-2" />
              <span class="text-sm font-semibold">Metro</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <img
                v-for="interchange in getInterchanges.filter(i => i.type === 'metro')"
                :key="`metro-${interchange.line}`"
                :src="getLogoPath(interchange)"
                :alt="interchange.line"
                :title="`Canviar a ${interchange.line}`"
                class="h-8 w-auto cursor-pointer hover:scale-110 transition-transform"
                @click="switchToLine(interchange.line)"
              />
            </div>
          </div>
          
          <!-- Renfe interchanges -->
          <div v-if="getInterchanges.filter(i => i.type === 'renfe').length > 0" class="ml-2">
            <div class="flex items-center mb-1">
              <img src="/Logos/ROD.svg" alt="Rodalies" class="h-6 w-auto mr-2" />
              <span class="text-sm font-semibold">Rodalies</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <img
                v-for="interchange in getInterchanges.filter(i => i.type === 'renfe')"
                :key="`renfe-${interchange.line}`"
                :src="getLogoPath(interchange)"
                :alt="interchange.line"
                class="h-8 w-auto"
              />
            </div>
          </div>
          
          <!-- FGC interchanges -->
          <div v-if="getInterchanges.filter(i => i.type === 'fgc').length > 0" class="ml-2">
            <div class="flex items-center mb-1">
              <img src="/Logos/FGC.svg" alt="FGC" class="h-6 w-auto mr-2" />
              <span class="text-sm font-semibold">FGC</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <img
                v-for="interchange in getInterchanges.filter(i => i.type === 'fgc')"
                :key="`fgc-${interchange.line}`"
                :src="getLogoPath(interchange)"
                :alt="interchange.line"
                class="h-8 w-auto"
              />
            </div>
          </div>
          
          <!-- Tram interchanges -->
          <div v-if="getInterchanges.filter(i => i.type === 'tram').length > 0" class="ml-2">
            <div class="flex items-center mb-1">
              <img src="/Logos/TRAM.svg" alt="TRAM" class="h-6 w-auto mr-2" />
              <span class="text-sm font-semibold">TRAM</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <img
                v-for="interchange in getInterchanges.filter(i => i.type === 'tram')"
                :key="`tram-${interchange.line}`"
                :src="getLogoPath(interchange)"
                :alt="interchange.line"
                class="h-8 w-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
