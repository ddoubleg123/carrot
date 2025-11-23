/**
 * Client for calling the internal enrich API
 * Used by discovery workers to trigger hero image enrichment
 */

// Resolve base URL with fallback chain
function getEnrichBaseUrl(): string {
  const url = process.env.ENRICH_BASE_URL || 
              process.env.BASE_URL || 
              process.env.NEXTAUTH_URL || 
              process.env.NEXT_PUBLIC_BASE_URL || 
              ''
  
  if (!url) {
    console.error('[enrichClient] No base URL configured. Set ENRICH_BASE_URL, BASE_URL, or NEXTAUTH_URL')
  }
  
  return url.replace(/\/$/, '') // Remove trailing slash
}

const INTERNAL_ENRICH_TOKEN = process.env.INTERNAL_ENRICH_TOKEN

export interface EnrichPayload {
  url?: string
  title?: string
  snippet?: string
  image?: string
  metadata?: Record<string, unknown>
  sourceUrl?: string
  assetUrl?: string
  type?: string
}

/**
 * POST to /api/internal/enrich/:id
 * Returns 200/202 on success (async processing)
 */
export async function postEnrich(id: string, payload: EnrichPayload): Promise<Response> {
  const baseUrl = getEnrichBaseUrl()
  
  if (!baseUrl) {
    throw new Error('ENRICH_BASE_URL, BASE_URL, or NEXTAUTH_URL must be set')
  }
  
  if (!INTERNAL_ENRICH_TOKEN) {
    console.warn('[enrichClient] INTERNAL_ENRICH_TOKEN not set, enrich calls will fail')
  }

  const url = `${baseUrl}/api/internal/enrich/${id}`
  
  console.log('[enrichClient] POST to enrich endpoint', {
    id,
    url: url.replace(/\/api\/internal\/enrich\/[^/]+$/, '/api/internal/enrich/[id]'), // Redact ID from logs
    hasToken: !!INTERNAL_ENRICH_TOKEN,
    baseUrl: baseUrl.replace(/\/$/, '')
  })
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': INTERNAL_ENRICH_TOKEN ?? ''
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok && res.status !== 202 && res.status !== 200) {
      const text = await res.text().catch(() => '')
      console.error('[enrichClient] Enrich POST failed', {
        id,
        status: res.status,
        statusText: res.statusText,
        error: text.substring(0, 200)
      })
      throw new Error(`Enrich POST failed: ${res.status} ${text.substring(0, 200)}`)
    }

    console.log('[enrichClient] Enrich POST succeeded', {
      id,
      status: res.status
    })

    return res
  } catch (error) {
    console.error('[enrichClient] Enrich POST error', {
      id,
      url: url.replace(/\/api\/internal\/enrich\/[^/]+$/, '/api/internal/enrich/[id]'),
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

