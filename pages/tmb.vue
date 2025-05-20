<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Papa from 'papaparse'
import MetroLine from '@/components/MetroLine.vue'

const route = useRoute()
const router = useRouter()

const lines = ['1','2','3','4','5','11']
const stations = ref([])

// Station-specific parameters
const estacion = route.query.s
const linea = route.query.l
const destino = '2'

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
const lineMetadata = ref({})

// Train data
const directionMap = ref({})
const timeMap = ref({})
const occupancyMap = ref({})
const serviceMap = ref({})

const remainingTimes = ref({})


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
              station.PICTO.length > 3
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

const loadLineMetadata = () => {
  fetch('/data/metro/linies_metro.csv')
    .then(r => r.text())
    .then(csv => {
      Papa.parse(csv, {
        header: true,
        complete(res) {
          // Create a map of line code to its origin/destination
          res.data.forEach(line => {
            if (line.CODI_LINIA && line.ORIGEN_LINIA && line.DESTI_LINIA) {
              lineMetadata.value[line.CODI_LINIA] = {
                name: line.NOM_LINIA,
                first: line.ORIGEN_LINIA,
                last: line.DESTI_LINIA,
                color: line.COLOR_LINIA
              }
            }
          })
          console.log('Loaded line metadata:', lineMetadata.value)
        }
      })
    })
    .catch(error => {
      console.error('Error loading line metadata:', error)
    })
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
      // Clear previous data
      directionMap.value = {}
      timeMap.value = {}
      occupancyMap.value = {}
      serviceMap.value = {}

      // Process each direction
      data.value.forEach(direction => {
        const directionId = direction.codi_via.toString()
        
        // Store direction information
        directionMap.value[directionId] = {
          id: directionId,
          stationOccupancy: direction.ocupacio_estacio_sortida?.percentatge_ocupacio || 0,
          trains: []
        }

        // Process trains for this direction
        if (direction.propers_trens && direction.propers_trens.length > 0) {
          direction.propers_trens.forEach(train => {
            const serviceId = train.codi_servei
            
            // Add train to direction map
            directionMap.value[directionId].trains.push(serviceId)
            
            // Store train times
            timeMap.value[serviceId] = {
              arrivalTime: train.temps_arribada,
              remainingTime: train.temps_restant,
              formattedTime: formatTime(train.temps_restant)
            }
            
            // Store occupancy data
            occupancyMap.value[serviceId] = {
              overall: train.info_tren?.percentatge_ocupacio || 0,
              byCar: train.info_tren?.percentatge_ocupacio_cotxes || []
            }
            
            // Store service details
            serviceMap.value[serviceId] = {
              id: serviceId,
              line: train.nom_linia,
              routeCode: train.codi_trajecte,
              destination: train.desti_trajecte,
              direction: directionId
            }
          })
        }
      })

      // Set countdown timers based on selected direction
      const directionData = directionMap.value[destino]
      if (directionData && directionData.trains.length > 0) {
        const firstTrainId = directionData.trains[0]
        nextTrainTime.value = timeMap.value[firstTrainId].remainingTime
        countdown.value = nextTrainTime.value

        if (directionData.trains.length > 1) {
          const secondTrainId = directionData.trains[1]
          secondTrainTime.value = timeMap.value[secondTrainId].remainingTime
          secondCountdown.value = secondTrainTime.value
        }
      }
    }
  } catch (e) {
    console.error('API error:', e)
    error.value = 'Error al cargar datos'
  } finally {
    isLoading.value = false
  }
}

const currentDirectionTrains = computed(() => {
  return directionMap.value[destino]?.trains || []
})

const nextTrainOccupancy = computed(() => {
  if (currentDirectionTrains.value.length > 0) {
    const serviceId = currentDirectionTrains.value[0]
    return occupancyMap.value[serviceId]?.overall || 0
  }
  return 0
})

const currentDestination = computed(() => {
  if (currentDirectionTrains.value.length > 0) {
    const serviceId = currentDirectionTrains.value[0]
    return serviceMap.value[serviceId]?.destination || ''
  }
  return ''
})

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

const handleStationSelected = (stationName) => {
  // Find the station code for this name and line
  const stationCode = findStationCodeByNameAndLine(stationName, linea)
  if (stationCode) {
    // Navigate to the selected station
    router.replace({ query: { l: linea, s: stationCode } })
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
  if (currentDirectionTrains.value.length > 0) {
    const serviceId = currentDirectionTrains.value[0]
    return serviceMap.value[serviceId]?.destination || 'Direcció no trobada'
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

const lineEndpoints = computed(() => {
  // Return the endpoints for the current line, or empty strings if not found
  return lineMetadata.value[linea] || { first: '', last: '' }
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

  // Define getLinePrefix first before using it
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

  // Now use getLinePrefix after it's defined
  // Buscar primero entre las estaciones ya cargadas
  if (allStations?.length > 0) {
    const match = allStations.find(s => s.name === stationName && s.code.startsWith(getLinePrefix(targetLine)));
    if (match) return match.code;
  }

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

let countdownInterval = null
onMounted(() => {
  countdownInterval = setInterval(() => {
    Object.keys(remainingTimes.value).forEach(id => {
      const v = remainingTimes.value[id]
      if (typeof v === 'number' && v > 0) {
        remainingTimes.value[id]--
      }
    })
  }, 1000)
})


// Default stations if we can't get real data
function getDefaultStations() {
  return [
    { name: 'Clot', corrprefixesespondence: true },
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

const goToTmb = () => {
  router.push({ path: '/tmb' })
}

const goToLine = (line) => {
  router.replace({ query: { l: line} })
}

onMounted(() => {
  const l = route.query.l
  if (l) {
    loadLineStations(l)
  }
  
  loadStationData()
  loadInterchangeData() 
  loadLineMetadata()

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
  clearInterval(countdownInterval)
})


watch(timeMap, (newMap) => {
  Object.entries(newMap).forEach(([serviceId, info]) => {
    remainingTimes.value[serviceId] = info.remainingTime
  })
})

</script>
<template>
  <div class="p-4 dark:bg-[#1C6962] bg-[#37cbbf] text-black dark:text-white min-h-screen">
    <!-- Sin query → elige línea -->
    <div v-if="!route.query.l">
      <h2 class="mb-4 font-bold">Selecciona línea</h2>
      <div class="grid grid-cols-2 px-[20%] gap-x-[30%] gap-y-4">
        <img
          v-for="l in lines"
          :key="l"
          :src="`/Logos/L${l}.svg`"
          :alt="`L${l}`"
          class="w-20 h-20 cursor-pointer hover:scale-110 transition-transform"
          @click="() => router.replace({ query: { l } })"
      </div>
    </div>
    <!-- Con query.l → lista de estaciones -->
    <div v-if="route.query.l && !route.query.s">
      <div class="flex flex-row items-center">
        <img src="/Logos/FMB.svg" alt="Logo TMB" class="h-15 mr-2" @click="goToTmb"/> 
        <img :src="getLineLogoPath" :alt="`Línia ${linea}`" class="w-15 mr-5" @click="goToLine(linea)">
        <h1 class="text-black dark:text-white "><span class="font-bold">De {{ lineEndpoints.first }} a {{ lineEndpoints.last }}</span></h1>
      </div>
      <div class="dark:bg-[#0000003d] bg-[#ffffff3d] rounded-md max-w-[75%] pl-5 mt-5">
        <FullLine
          :current-station="getStationName"
          :line="linea"
          :interchange-data="interchangeData.value"
          @station-selected="handleStationSelected"
        />
      </div>
    </div>
    <div v-if="['L9N', 'L9S', 'L10S', 'L10N'].includes(route.query.l)">
      <div class="text-center justify-center">
        <img :src="getLineLogoPath" :alt="`Línia ${linea}`" class="w-15 mr-5" @click="goToLine(linea)">
        <h1 class="text-3xl font-bold">Informació temporalment no disponible</h1>
      </div>
    </div>

    <div v-if="route.query.s" >
    <!-- Info estació -->
    <div>
      <div class="flex flex-row items-center">
        <img src="/Logos/FMB.svg" alt="Logo TMB" class="h-15 mr-2" @click="goToTmb"/> 
        <img :src="getLineLogoPath" :alt="`Línia ${linea}`" class="w-15 mr-5" @click="goToLine(linea)">
        <div>
          <h1 class="text-black dark:text-white text-2xl font-bold">{{ getStationName }}</h1>
        </div>
      </div>
    </div>
    <div class="grid grid-cols-[65%_35%] gap-4 my-15">
      <div class="space-y-6 p-4 dark:bg-[#0000003d] bg-[#ffffff3d] rounded-md">
        <div
          v-for="(dirData, dirId) in directionMap"
          :key="dirId"
          class="space-y-2"
        >
          <h3 class="font-bold text-center">
            <span class="font-normal ">Direcció:</span><br>
            {{ serviceMap[dirData.trains[0]]?.destination || dirId }}
          </h3>
          <ul class="space-y-1 text-center">
            <li
              v-for="(serviceId, idx) in dirData.trains.slice(0,2)"
              :key="serviceId"
              class="inline-block mx-2 p-2 border rounded"
            >
              <p>Temps<br><strong class="text-xl">
                {{ remainingTimes[serviceId] != null 
                    ? `${Math.floor(remainingTimes[serviceId]/60)}:${String(remainingTimes[serviceId]%60).padStart(2,'0')}` 
                    : '--:--' }}
                    </strong>
              </p>
              <p>Codi: <br><strong>{{ serviceId }}</strong></p>
            </li>
            <li
              v-if="dirData.trains.length === 0"
              class="text-gray-500"
            >
              Esperant informació...
            </li>
          </ul>
        </div>
      </div>

      <div class=" dark:bg-[#0000003d] bg-[#ffffff3d] rounded-md items-end">
        <MetroLine
          :stations="contextualStations"
          :currentStation="getStationName"
          :line="linea"
          @station-selected="handleStationSelected"
        />
      </div>
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
