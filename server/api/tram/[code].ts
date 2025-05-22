// server/api/tram/[code].ts

let tramToken: { token: string; expiresAt: number } | null = null

export default defineEventHandler(async (event) => {
  const { code } = event.context.params!
  const { clientId, clientSecret } = useRuntimeConfig().tram

  // 1. Verificar si el token aún es válido (caduca 60min después)
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
      expiresAt: now + expiresIn * 1000 - 30_000 // 30s de margen
    }

  }

  // 2. Hacemos la llamada con el token válido
  const data = await $fetch(`https://opendata.tram.cat/api/v1/stopTimes/${code}`, {
    headers: {
      Authorization: `Bearer ${tramToken.token}`
    }
  })

  return data
})
