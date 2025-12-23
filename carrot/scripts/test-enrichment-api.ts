/**
 * Test script to verify the enrichment API endpoint works
 */

async function testEnrichmentAPI() {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://carrot-app.onrender.com'
  const apiKey = process.env.INTERNAL_API_KEY || ''
  
  console.log('Testing enrichment API endpoint...')
  console.log(`URL: ${baseUrl}/api/dev/enrich-israel-content`)
  console.log(`API Key: ${apiKey ? 'Set' : 'Not set'}\n`)
  
  try {
    const response = await fetch(`${baseUrl}/api/dev/enrich-israel-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': apiKey
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ API Response:')
      console.log(JSON.stringify(data, null, 2))
    } else {
      const errorText = await response.text()
      console.error(`❌ API Error (${response.status}):`)
      console.error(errorText)
    }
  } catch (error: any) {
    console.error('❌ Request failed:')
    console.error(error.message)
  }
}

testEnrichmentAPI().catch(console.error)

