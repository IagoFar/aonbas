// server/api/tram/test.ts - Utility endpoint for testing TRAM API calls

let tramToken: { token: string; expiresAt: number } | null = null

// Token acquisition function (reused from [code].ts)
async function getValidToken() {
  const { clientId, clientSecret } = useRuntimeConfig().tram
  const now = Date.now()
  
  if (!tramToken || tramToken.expiresAt < now) {
    console.log('Obtaining new TRAM API token')
    
    try {
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
        expiresAt: now + expiresIn * 1000 - 30_000 // 30s margin
      }
      
      return tramToken.token
    } catch (error) {
      console.error('Error obtaining TRAM API token:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to authenticate with TRAM API'
      })
    }
  }
  
  return tramToken.token
}

// Generic function to call any TRAM API endpoint
async function callTramApi(endpoint: string) {
  const token = await getValidToken()
  
  try {
    const data = await $fetch(`https://opendata.tram.cat/api/v1/${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    
    return data
  } catch (error: any) {
    console.error(`Error calling TRAM API endpoint ${endpoint}:`, error)
    throw createError({
      statusCode: error.status || 500,
      statusMessage: error.message || 'Error calling TRAM API'
    })
  }
}

// Main handler for the test endpoint
export default defineEventHandler(async (event) => {
  // Get the requested endpoint from query parameters
  const query = getQuery(event)
  const endpoint = query.endpoint as string
  
  if (!endpoint) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing endpoint parameter'
    })
  }
  
  try {
    // Call the TRAM API with the specified endpoint
    const result = await callTramApi(endpoint)
    return result
  } catch (error) {
    // Error handling is done in callTramApi
    throw error
  }
})