// server/api/metro/[line]/[station].ts
export default defineEventHandler(async (event) => {
  const { line, station } = event.context.params!
  const { url, appId, appKey } = useRuntimeConfig().metro

  if (!appKey) {
    throw createError({ statusCode: 500, statusMessage: 'Missing METRO_API_KEY' })
  }

  // Montamos la URL exactamente igual que en TMB
  const target = `${url}/linia/${line}/estacio/${station}/?app_id=${appId}&app_key=${appKey}`

  // Llamada externa directa
  return await $fetch(target, {
    method: 'GET'
  })
})
