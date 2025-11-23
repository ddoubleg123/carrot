#!/usr/bin/env tsx
/**
 * Smoke test for enrich API endpoint in production
 * Usage: ENRICH_BASE_URL=https://your-prod-domain.com INTERNAL_ENRICH_TOKEN=your-token tsx scripts/smoke-enrich-prod.ts
 */

async function smokeTest() {
  const base = process.env.ENRICH_BASE_URL || process.env.BASE_URL || process.env.NEXTAUTH_URL
  const token = process.env.INTERNAL_ENRICH_TOKEN

  if (!base) {
    console.error('❌ ENRICH_BASE_URL, BASE_URL, or NEXTAUTH_URL must be set')
    process.exit(1)
  }

  if (!token) {
    console.error('❌ INTERNAL_ENRICH_TOKEN must be set')
    process.exit(1)
  }

  const id = `smoke-${Date.now()}`
  const url = `${base.replace(/\/$/, '')}/api/internal/enrich/${id}`
  
  console.log('🧪 Running smoke test for enrich endpoint...')
  console.log('   URL:', url.replace(/\/api\/internal\/enrich\/[^/]+$/, '/api/internal/enrich/[id]'))
  console.log('   ID:', id)
  console.log('   Has token:', !!token)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': token,
      },
      body: JSON.stringify({ 
        title: 'Smoke Test', 
        url: 'https://example.com',
        snippet: 'This is a smoke test payload'
      }),
    })

    const text = await res.text()
    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {
      // Not JSON
    }

    console.log('📊 Response:')
    console.log('   Status:', res.status, res.statusText)
    console.log('   Body:', json ? JSON.stringify(json, null, 2) : text.substring(0, 200))

    if (res.status === 200 || res.status === 202) {
      console.log('✅ SUCCESS: Enrich endpoint is working')
      process.exit(0)
    } else if (res.status === 401) {
      console.error('❌ FAILED: Unauthorized (check INTERNAL_ENRICH_TOKEN)')
      process.exit(1)
    } else if (res.status === 404) {
      console.error('❌ FAILED: Route not found (404) - check route path and deployment')
      process.exit(1)
    } else {
      console.error(`❌ FAILED: Unexpected status ${res.status}`)
      process.exit(1)
    }
  } catch (error) {
    console.error('❌ FAILED: Request error:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

smokeTest().catch((error) => {
  console.error('❌ FAILED:', error)
  process.exit(1)
})
