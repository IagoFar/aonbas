// server/api/tram/line/[id].ts

let tramToken: { token: string; expiresAt: number } | null = null

export default defineEventHandler(async (event) => {
  const { id } = event.context.params!
  const { clientId, clientSecret } = useRuntimeConfig().tram

  const now = Date.now()
  if (!tramToken || tramToken.expiresAt < now) {
    const tokenRes = await $fetch('https://opendata.tram.cat/connect/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      }).toString()
    })

    const accessToken = (tokenRes as any).access_token
    const expiresIn = (tokenRes as any).expires_in || 3600

    tramToken = {
      token: accessToken,
      expiresAt: now + expiresIn * 1000 - 30_000
    }
  }

  // Paradas ordenadas en la línea
  const data = await $fetch(`https://opendata.tram.cat/api/v1/lines/${id}/stops?page=0`, {
    headers: {
      Authorization: `Bearer ${tramToken.token}`
    }
  })

  // Ordenar por campo "order" si no viene ya ordenado
  const sorted = Array.isArray(data)
    ? [...data].sort((a, b) => a.order - b.order)
    : []

  return sorted
})
