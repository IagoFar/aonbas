<template>
  <div class="relative px-4 py-6">
    <!-- Main colored line - Only between first and last stations -->
    <div 
      class="absolute top-1/2 h-2" 
      :style="{ 
        backgroundColor: lineColorValue,
        left: getFirstStationPosition,
        right: getLastStationPosition
      }"
    ></div>

    <!-- Gray line up to current station (passed part) -->
    <div
      v-if="currentIndex >= 0"
      class="absolute top-1/2 h-2"
      :style="{
        left: getFirstStationPosition,
        width: `${getGrayLineWidth}`, 
        backgroundColor: '#999'
      }"
    ></div>

    <!-- Station container -->
    <div class="relative z-10" style="height: 5rem;">
      <!-- Stations -->
      <div
        v-for="(station, i) in stations"
        :key="station.name || i"
        class="absolute"
        :style="{
          left: calculateStationPosition(i),
          transform: 'translateX(-50%)',
          width: '30px' // Wider for text overflow
        }"
      >
        <!-- Station name (diagonal and bold) -->
        <div
          class="ml-5 text-xs font-bold station-name-container"
          :class="{
            'passed': i < currentIndex,
            'current': i === currentIndex,
            'future': i > currentIndex
          }"
          :style="i === currentIndex ? { color: lineColorValue } : {}"
        >
          <span class="station-name">{{ station.name }}</span>
        </div>

        <!-- Station markers exactly on the main line -->
        <div class="relative" style="height: 0px;">
          <!-- Interchange station (circle centered on line) -->
          <div
            v-if="station.correspondence"
            class="absolute bottom-15 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            style="z-index: 3;"
          >
            <!-- Main circle -->
            <div
              class="rounded-full"
              :style="{
                width: '16px',
                height: '16px',
                backgroundColor: i < currentIndex ? '#fff' : lineColorValue,
                border: i < currentIndex ? `4px solid #999` : '4px solid #000'
              }"
            ></div>
            
            <!-- Mini-line indicators -->
            <div class="mini-lines-container">
              <!-- Vertical mini-line (positioned above the circle) -->
              <div
                class="absolute bottom-1 left-1/2 transform -translate-x-1/2"
                style="z-index: -1;"
              >
                <div
                  :style="{
                    width: '5px',
                    height: '16px',
                    backgroundColor: i < currentIndex ? '#999' : lineColorValue
                  }"
                ></div>
              </div>
            </div>
          </div>
          
          <!-- Regular station (vertical line touching the main line) -->
          <div
            v-else
            class="absolute bottom-16 left-1/2 transform -translate-x-1/2"
            style="z-index: 3;"
          >
            <div
              :style="{
                width: '5px',
                height: '16px',
                transform: 'translateY(-50%)',
                backgroundColor: i < currentIndex ? '#999' : '#FFFFFF',
                border: i < currentIndex ? 'none' : `1px solid ${lineColorValue}`
              }"
            ></div>
          </div>
          
          <!-- End of line stations have no additional markers now -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  stations: {
    type: Array,
    required: true
  },
  currentStation: {
    type: String,
    required: true
  },
  line: {
    type: [String, Number],
    default: '11'
  }
})

// Map Metro line numbers to their standard colors
const lineColorValue = computed(() => {
  const lineColors = {
    '1': '#E60012', // Red (L1)
    '2': '#722283', // Purple (L2)
    '3': '#00AB4F', // Green (L3)
    '4': '#FFCC00', // Yellow (L4)
    '5': '#0073C7', // Blue (L5)
    '9': '#F38143', // Orange (L9)
    '10': '#0093D0', // Light Blue (L10)
    '11': '#6CC24A' // Light Green (L11)
  }
  
  return lineColors[props.line.toString()] || '#E60012' // Default to L1 red
})

const currentIndex = computed(() => {
  const idx = props.stations.findIndex(s => s.name === props.currentStation)
  return idx >= 0 ? idx : 0
})

// Get positions for line rendering - adjusted to cut at exact station positions
const getFirstStationPosition = computed(() => {
  // Get the exact position of first station
  return calculateStationPosition(0);
})

const getLastStationPosition = computed(() => {
  // Get the exact position of last station
  const lastPos = calculateStationPosition(props.stations.length - 1);
  // Convert percentage to a distance from right edge
  const percentValue = parseFloat(lastPos);
  return `${100 - percentValue}%`;
})

// Calculate width for gray line (passed stations)
const getGrayLineWidth = computed(() => {
  if (currentIndex.value <= 0) return '0%';
  
  const startPos = parseFloat(getFirstStationPosition.value);
  const currentPos = parseFloat(calculateStationPosition(currentIndex.value));
  
  return `${currentPos - startPos}%`;
})

// Calculate position for each station based on current station and proximity to ends
function calculateStationPosition(index) {
  if (props.stations.length === 1) return '50%';
  
  const totalStations = props.stations.length;
  
  // For very short lines (5 or fewer stations), use evenly distributed positions
  if (totalStations <= 5) {
    return `${(index / (totalStations - 1)) * 100}%`;
  }
  
  // Determine ideal center station based on current station's position
  let centerStationIndex;
  
  // If current station is near beginning of line (first 2 stations)
  if (currentIndex.value <= 1) {
    centerStationIndex = 2; // Center on the 3rd station
  } 
  // If current station is near end of line (last 2 stations)
  else if (currentIndex.value >= totalStations - 2) {
    centerStationIndex = totalStations - 3; // Center on 3rd-to-last station
  }
  // For L11 line specifically (based on your example)
  else if (props.line.toString() === '11' && currentIndex.value === 0) {
    // If Trinitat Nova is the current station, center on Torre baró | Vallbona
    centerStationIndex = 2;
  } 
  // Default: center on current station
  else {
    centerStationIndex = currentIndex.value;
  }
  
  // Calculate positions relative to the center station
  const offset = index - centerStationIndex;
  const centerPos = 50;
  const stationSpacing = 12.5; // Space between stations (in percent)
  
  return `${centerPos + (offset * stationSpacing)}%`;
}
</script>

<style scoped>
.relative {
  min-height: 6rem;
}

.station-name-container {
  position: relative;
  width: 100%;
  height: auto;
  margin-bottom: 1rem;
  overflow: visible;
}

.station-name {
  display: inline-block;
  transform: rotate(-45deg);
  transform-origin: bottom left;
  position: relative;
  bottom: -12px;
  font-weight: bold;
  white-space: nowrap;
  max-width: none;
  text-overflow: ellipsis;
}

.passed {
  color: #999;
}

.current {
  color: inherit;
}

.future {
  color: #333;
}
</style>