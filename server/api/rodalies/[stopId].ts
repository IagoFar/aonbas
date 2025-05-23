import { defineEventHandler } from 'h3'
import fs from 'fs/promises'
import path from 'path'
import Papa from 'papaparse'

let stopTimes: Array<any> = []
let stopsMap = new Map<string, string>()
let initialized = false

async function initGtfs() {
  if (initialized) return
  initialized = true

  const base = path.resolve('public/data/rodalies/gtfs')


  // 1) Leer y parsear stops.txt
  const stopsCsv = await fs.readFile(path.join(base, 'stops.txt'), 'utf-8')
  const stopsData = Papa.parse(stopsCsv, { header: true }).data as any[]
  stopsData.forEach(r => {
    if (r.stop_id && r.stop_name) {
      stopsMap.set(r.stop_id, r.stop_name)
    }
  })

  // 2) Leer y parsear stop_times.txt
  const timesCsv = await fs.readFile(path.join(base, 'stop_times.txt'), 'utf-8')
  stopTimes = Papa.parse(timesCsv, { header: true }).data as any[]
}

export default defineEventHandler(async (event) => {
  const { stopId } = event.context.params!
  await initGtfs()

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
    const linea = r.trip_id.match(/R\\d+/)?.[0] || r.trip_id.slice(-2)
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
    stopName:   stopsMap.get(stopId) || null,
    nextTrains: next
  }
})
