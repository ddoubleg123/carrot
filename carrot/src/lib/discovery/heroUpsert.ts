/**
 * Idempotent hero upsert utility for discovery pipeline
 * Creates Hero records after successful content extraction
 */

import { prisma } from '@/lib/prisma'
import { enrichContentId } from '@/lib/enrichment/worker'

export interface UpsertHeroParams {
  patchId: string
  contentId: string
  url: string
  canonicalUrl: string
  title: string
  summary?: string
  sourceDomain?: string
  extractedText?: string
  traceId?: string
}

/**
 * Idempotent hero upsert - creates Hero record if it doesn't exist
 * Uses contentId as unique key to prevent duplicates
 */
export async function upsertHero(params: UpsertHeroParams): Promise<{ created: boolean; heroId: string }> {
  const { contentId, title, canonicalUrl, traceId } = params

  try {
    // Check if hero already exists
    const existing = await prisma.hero.findUnique({
      where: { contentId },
      select: { id: true, status: true }
    })

    if (existing && existing.status === 'READY') {
      // Already exists and ready - skip
      return { created: false, heroId: existing.id }
    }

    // Trigger enrichment (async, non-blocking)
    // This will create/update the Hero record via the enrichment worker
    enrichContentId(contentId).catch((error) => {
      console.error('[upsertHero] Enrichment failed:', error)
      // Don't throw - hero creation is non-blocking
    })

    // Return immediately - enrichment happens async
    // If hero doesn't exist yet, create a DRAFT record
    if (!existing) {
      const hero = await prisma.hero.create({
        data: {
          contentId,
          title,
          sourceUrl: canonicalUrl,
          status: 'DRAFT' // Will be updated to READY by enrichment worker
        }
      })
      return { created: true, heroId: hero.id }
    }

    return { created: false, heroId: existing.id }
  } catch (error: any) {
    // If it's a duplicate key error, that's fine - another process created it
    if (error?.code === 'P2002') {
      const existing = await prisma.hero.findUnique({
        where: { contentId },
        select: { id: true }
      })
      if (existing) {
        return { created: false, heroId: existing.id }
      }
    }
    console.error('[upsertHero] Error:', error)
    throw error
  }
}

/**
 * Log hero creation event
 */
export function logHeroEvent(
  event: 'hero_created' | 'hero_skipped_duplicate' | 'hero_upsert_error',
  params: {
    patchId: string
    contentId: string
    url: string
    traceId?: string
    error?: string
  }
) {
  const logEntry = {
    ts: Date.now(),
    event,
    patchId: params.patchId,
    contentId: params.contentId,
    url: params.url.substring(0, 100),
    traceId: params.traceId,
    ...(params.error && { error: params.error.substring(0, 200) })
  }
  console.log(JSON.stringify(logEntry))
}

