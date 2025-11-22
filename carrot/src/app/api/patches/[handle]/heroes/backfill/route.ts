import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enrichContentId } from '@/lib/enrichment/worker'

/**
 * POST /api/patches/[handle]/heroes/backfill
 * Backfills heroes for all saved content in the patch
 */
export const runtime = 'nodejs'

// Simple concurrency control
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    const body = await request.json().catch(() => ({}))
    const { limit = 100, concurrency = 5 } = body as { limit?: number; concurrency?: number }

    // Find patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    console.log('[Heroes Backfill] Starting for patch:', handle, { limit, concurrency })

    // Find content without heroes
    const contentWithoutHeroes = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id,
        heroRecord: null // No Hero record exists
      },
      select: { id: true, title: true, canonicalUrl: true },
      take: limit,
      orderBy: { createdAt: 'desc' }
    })

    console.log('[Heroes Backfill] Found', contentWithoutHeroes.length, 'content items without heroes')

    if (contentWithoutHeroes.length === 0) {
      return NextResponse.json({
        scanned: 0,
        created: 0,
        updated: 0,
        failed: 0,
        message: 'No content found without heroes'
      })
    }

    // Process with concurrency limit
    const results = await pMap(
      contentWithoutHeroes,
      async (content) => {
        try {
          const result = await enrichContentId(content.id)
          return {
            contentId: content.id,
            title: content.title,
            ...result
          }
        } catch (error: any) {
          return {
            contentId: content.id,
            title: content.title,
            ok: false,
            errorCode: 'ENRICHMENT_ERROR',
            errorMessage: error.message
          }
        }
      },
      { concurrency }
    )

    const created = results.filter(r => r.ok && 'heroId' in r && r.heroId).length
    const updated = results.filter(r => r.ok && (!('heroId' in r) || !r.heroId)).length
    const failed = results.filter(r => !r.ok).length

    console.log('[Heroes Backfill] Completed:', {
      scanned: contentWithoutHeroes.length,
      created,
      updated,
      failed
    })

    return NextResponse.json({
      scanned: contentWithoutHeroes.length,
      created,
      updated,
      failed,
      results: results.slice(0, 10) // Return first 10 for debugging
    })

  } catch (error) {
    console.error('[Heroes Backfill] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

