import { defineEventHandler } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import Papa from 'papaparse'
import { updateRodaliesGTFS } from '@/utils/updateRodaliesGTFS'
import { fileURLToPath } from 'url'

let stopTimes: Array<any> = []
let stopsMap = new Map<string, string>()
let initialized = false
let lastGtfsUpdateCheck = 0

async function initGtfs() {
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const base = path.resolve(__dirname, '../../public/data/rodalies/gtfs')
    const stopsPath = path.join(base, 'stops.txt')
    const stopTimesPath = path.join(base, 'stop_times.txt')

    let needsUpdate = false

    try {
      await Promise.all([
        fs.access(stopsPath),
        fs.access(stopTimesPath)
      ])
    } catch (err) {
      console.log('GTFS data missing or inaccessible, downloading...')
      needsUpdate = true
    }

    if (needsUpdate) {
      await updateRodaliesGTFS()
      console.log('GTFS data updated successfully')
    }

    // Parse GTFS data
    const stopsCsv = await fs.readFile(stopsPath, 'utf-8')
    const stopsData = Papa.parse(stopsCsv, { header: true }).data as any[]
    stopsMap.clear()
    stopsData.forEach(r => {
      if (r.stop_id && r.stop_name) {
        stopsMap.set(r.stop_id, r.stop_name)
      }
    })

    const timesCsv = await fs.readFile(stopTimesPath, 'utf-8')
    stopTimes = Papa.parse(timesCsv, { header: true }).data as any[]

    initialized = true
    lastGtfsUpdateCheck = Date.now()
    // Output the data absolute location
    console.log('GTFS data initialized successfully' + new Date(lastGtfsUpdateCheck).toLocaleString())
    console.log('GTFS data location:', stopsPath, stopTimesPath)
  } catch (error) {
    console.error('Error initializing GTFS data:', error)
    throw error
  }
}

export default defineEventHandler(async (event) => {
  const { stopId } = event.context.params!
  await initGtfs()

  // Rest of the handler remains the same...

  // Hora actual en HH:MM:SS
  const now = new Date()
  const timeStr = now.toTimeString().slice(0, 8)

  console.log('Ejemplo de horarios:', stopTimes.filter(s => s.stop_id === stopId).slice(0, 5))
  console.log('Hora actual:', timeStr)
  const matches = stopTimes.filter(s => s.stop_id === stopId)
  console.log(`Coincidencias para stopId ${stopId}:`, matches.length)

  const seenKeys = new Set()
  const next = stopTimes
    .filter(s => s.stop_id === stopId && s.arrival_time > timeStr)
    .sort((a, b) => a.arrival_time.localeCompare(b.arrival_time))
    .filter(r => {
      // Obtener línea desde tripId (últimos 2-3 caracteres suelen ser la línea)
      const linea = r.trip_id.match(/R\d+/)?.[0] || r.trip_id.slice(-2)
      const key = `${linea}-${r.arrival_time}`
      if (seenKeys.has(key)) return false
      seenKeys.add(key)
      return true
    })
    .slice(0, 5)
    .map(r => ({
      tripId: r.trip_id,
      arrival: r.arrival_time,
      departure: r.departure_time,
      stopName: stopsMap.get(r.stop_id) || stopId
    }))

  return {
    stopId,
    stopName: stopsMap.get(stopId) || null,
    nextTrains: next
  }
})