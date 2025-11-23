import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enrichContentId } from '@/lib/enrichment/worker'
import { logEnrichment } from '@/lib/enrichment/logger'
import { z } from 'zod'

/**
 * POST /api/maintenance/sync-heroes
 * Backfill: Promote all saved DiscoveredContent to Heroes
 * Supports cursor-based pagination for resumable processing
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SyncHeroesSchema = z.object({
  patchSlug: z.string().optional(),
  patchId: z.string().optional(),
  limit: z.number().int().positive().max(200).default(50),
  cursor: z.string().optional(),
  concurrency: z.number().int().positive().max(10).default(3)
})

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

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    const body = await request.json()
    const params = SyncHeroesSchema.parse(body)
    
    // Find patch by slug or ID
    let patch
    if (params.patchSlug) {
      patch = await prisma.patch.findUnique({
        where: { handle: params.patchSlug },
        select: { id: true, handle: true }
      })
    } else if (params.patchId) {
      patch = await prisma.patch.findUnique({
        where: { id: params.patchId },
        select: { id: true, handle: true }
      })
    } else {
      return NextResponse.json(
        { error: 'Either patchSlug or patchId is required' },
        { status: 400 }
      )
    }
    
    if (!patch) {
      return NextResponse.json(
        { error: 'Patch not found' },
        { status: 404 }
      )
    }
    
    logEnrichment({
      stage: 'hero',
      patchId: patch.id,
      patchSlug: patch.handle,
      status: 'ok',
      ms: 0
    })
    
    console.log('[Sync Heroes] Starting sync', {
      patchId: patch.id,
      patchHandle: patch.handle,
      limit: params.limit,
      cursor: params.cursor
    })
    
    // Build query with cursor pagination
    const whereClause: any = {
      patchId: patch.id,
      heroRecord: null // No Hero record exists
    }
    
    // Cursor-based pagination: if cursor is an ID, use it; if it's a timestamp, use createdAt
    let orderBy: any[] = [{ createdAt: 'desc' }]
    if (params.cursor) {
      // Try to parse as date first
      const cursorDate = new Date(params.cursor)
      if (!isNaN(cursorDate.getTime())) {
        whereClause.createdAt = { lt: cursorDate }
      } else {
        // Assume it's an ID - use id-based cursor
        whereClause.id = { lt: params.cursor }
        orderBy = [{ id: 'desc' }]
      }
    }
    
    // Find content without heroes
    const contentWithoutHeroes = await prisma.discoveredContent.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        canonicalUrl: true,
        sourceUrl: true,
        textContent: true,
        createdAt: true
      },
      orderBy,
      take: params.limit
    })
    
    console.log('[Sync Heroes] Found', contentWithoutHeroes.length, 'content items without heroes')
    
    if (contentWithoutHeroes.length === 0) {
      return NextResponse.json({
        processed: 0,
        createdHeroes: 0,
        nextCursor: null,
        message: 'No content found without heroes'
      })
    }
    
    // Process with concurrency limit
    const results = await pMap(
      contentWithoutHeroes,
      async (content) => {
        try {
          // Check again if hero was created mid-run (idempotency)
          const existingHero = await prisma.hero.findUnique({
            where: { contentId: content.id },
            select: { id: true }
          })
          
          if (existingHero) {
            return {
              contentId: content.id,
              title: content.title,
              ok: true,
              skipped: true,
              heroId: existingHero.id
            }
          }
          
          // Call enrichment directly (not via HTTP)
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
      { concurrency: params.concurrency }
    )
    
    const createdHeroes = results.filter(r => r.ok && !r.skipped && 'heroId' in r && r.heroId).length
    const skipped = results.filter(r => r.skipped).length
    const failed = results.filter(r => !r.ok).length
    
    // Determine next cursor
    const lastItem = contentWithoutHeroes[contentWithoutHeroes.length - 1]
    const nextCursor = lastItem ? `${lastItem.createdAt.toISOString()}` : null
    
    console.log('[Sync Heroes] Completed', {
      processed: contentWithoutHeroes.length,
      createdHeroes,
      skipped,
      failed,
      durationMs: Date.now() - startTime
    })
    
    return NextResponse.json({
      processed: contentWithoutHeroes.length,
      createdHeroes,
      skipped,
      failed,
      nextCursor,
      results: results.slice(0, 10) // Return first 10 for debugging
    })
    
  } catch (error) {
    console.error('[Sync Heroes] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

