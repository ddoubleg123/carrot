import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enrichContentId } from '@/lib/enrichment/worker'

// Simple p-map replacement for concurrency control
async function pMap<T, R>(
  items: T[],
  mapper: (item: T) => Promise<R>,
  options: { concurrency: number }
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += options.concurrency) {
    const batch = items.slice(i, i + options.concurrency)
    const batchResults = await Promise.all(batch.map(mapper))
    results.push(...batchResults)
  }
  return results
}

/**
 * Backfill endpoint to create heroes for all saved content without heroes
 * POST /api/internal/backfill-heroes
 * Body: { patchId?, limit?, concurrency? }
 * Auth: X-Internal-Token header must match INTERNAL_ENRICH_TOKEN env var
 */
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const token = request.headers.get('x-internal-token')
    const expectedToken = process.env.INTERNAL_ENRICH_TOKEN
    
    if (!expectedToken) {
      return NextResponse.json({ error: 'Service not configured' }, { status: 503 })
    }
    
    if (!token || token !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { patchId, limit = 100, concurrency = 5 } = body as { patchId?: string; limit?: number; concurrency?: number }

    console.log('[Backfill Heroes] Starting:', { patchId, limit, concurrency })

    // Find content without heroes
    const whereClause: any = {
      hero: null // No Hero record exists
    }

    if (patchId) {
      whereClause.patchId = patchId
    }

    const sources = await prisma.discoveredContent.findMany({
      where: whereClause,
      select: { id: true },
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    console.log('[Backfill Heroes] Found', sources.length, 'sources without heroes')

    if (sources.length === 0) {
      return NextResponse.json({
        scanned: 0,
        created: 0,
        updated: 0,
        failed: 0,
        message: 'No sources found without heroes'
      })
    }

    // Process with concurrency limit
    const results = await pMap(
      sources,
      async (source) => {
        try {
          const result = await enrichContentId(source.id)
          return { sourceId: source.id, ...result }
        } catch (error: any) {
          return {
            sourceId: source.id,
            ok: false,
            heroId: undefined,
            traceId: '',
            phase: 'upsert' as const,
            errorCode: 'ENRICHMENT_ERROR',
            errorMessage: error.message,
            durationMs: 0
          }
        }
      },
      { concurrency }
    )

    const created = results.filter(r => r.ok && r.heroId).length
    const updated = results.filter(r => r.ok && !r.heroId).length
    const failed = results.filter(r => !r.ok).length

    console.log('[Backfill Heroes] Completed:', { scanned: sources.length, created, updated, failed })

    return NextResponse.json({
      scanned: sources.length,
      created,
      updated,
      failed,
      results: results.slice(0, 10) // Return first 10 for debugging
    })

  } catch (error) {
    console.error('[Backfill Heroes] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

