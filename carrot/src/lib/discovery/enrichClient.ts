/**
 * Client for calling the internal enrich API
 * Used by discovery workers to trigger hero image enrichment
 */

const ENRICH_BASE_URL = process.env.ENRICH_BASE_URL || process.env.BASE_URL || process.env.NEXTAUTH_URL || ''
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
 * Returns 202 on success (async processing)
 */
export async function postEnrich(id: string, payload: EnrichPayload): Promise<Response> {
  if (!ENRICH_BASE_URL) {
    throw new Error('ENRICH_BASE_URL or BASE_URL must be set')
  }
  
  if (!INTERNAL_ENRICH_TOKEN) {
    console.warn('[enrichClient] INTERNAL_ENRICH_TOKEN not set, enrich calls will fail')
  }

  const url = `${ENRICH_BASE_URL.replace(/\/$/, '')}/api/internal/enrich/${id}`
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-token': INTERNAL_ENRICH_TOKEN ?? ''
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok && res.status !== 202) {
    const text = await res.text().catch(() => '')
    throw new Error(`Enrich POST failed: ${res.status} ${text}`)
  }

  return res
}

