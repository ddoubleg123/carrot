/**
 * Smoke test for /api/internal/enrich/:id endpoint
 * Run: tsx scripts/smoke-enrich-prod.ts
 * 
 * Requires env vars:
 * - ENRICH_BASE_URL (or BASE_URL)
 * - INTERNAL_ENRICH_TOKEN
 */

async function main() {
  const base = process.env.ENRICH_BASE_URL || process.env.BASE_URL
  const token = process.env.INTERNAL_ENRICH_TOKEN

  if (!base) {
    console.error('ERROR: ENRICH_BASE_URL or BASE_URL must be set')
    process.exit(1)
  }

  if (!token) {
    console.error('ERROR: INTERNAL_ENRICH_TOKEN must be set')
    process.exit(1)
  }

  const id = 'smoke-' + Date.now()
  const url = `${base.replace(/\/$/, '')}/api/internal/enrich/${id}`

  console.log('Testing enrich endpoint:', url)
  console.log('ID:', id)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': token
      },
      body: JSON.stringify({
        title: 'Smoke Test',
        url: 'https://example.com',
        type: 'article'
      })
    })

    const text = await res.text()
    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {
      // Not JSON
    }

    console.log('\n--- Response ---')
    console.log('STATUS:', res.status)
    console.log('BODY:', json || text)

    if (res.status === 200 || res.status === 202) {
      console.log('\n✅ SUCCESS: Endpoint is working')
      process.exit(0)
    } else if (res.status === 404) {
      console.error('\n❌ FAILED: Endpoint returned 404 (route not found)')
      process.exit(1)
    } else if (res.status === 401) {
      console.error('\n❌ FAILED: Unauthorized (check INTERNAL_ENRICH_TOKEN)')
      process.exit(1)
    } else {
      console.error(`\n❌ FAILED: Unexpected status ${res.status}`)
      process.exit(1)
    }
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message)
    if (error.message.includes('fetch')) {
      console.error('   Check that ENRICH_BASE_URL is correct and reachable')
    }
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})

