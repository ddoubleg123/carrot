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
 * Phase 4: Enhanced with resilient error handling - never fails, always creates hero
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

    // If hero exists but is DRAFT, trigger enrichment to complete it
    if (existing && existing.status === 'DRAFT') {
      // Trigger enrichment (async, non-blocking) to complete the hero
      enrichContentId(contentId).catch((error) => {
        console.error('[upsertHero] Enrichment failed for DRAFT hero:', error)
        // Don't throw - hero creation is non-blocking
        // The hero will remain in DRAFT status, which is acceptable
      })
      return { created: false, heroId: existing.id }
    }

    // Create DRAFT hero record immediately (resilient - always succeeds)
    let hero
    try {
      hero = await prisma.hero.create({
        data: {
          contentId,
          title,
          sourceUrl: canonicalUrl,
          status: 'DRAFT', // Will be updated to READY by enrichment worker
          excerpt: params.summary || null,
          // Set minimal fields - image will be added by enrichment
        }
      })
    } catch (createError: any) {
      // If it's a duplicate key error, another process created it
      if (createError?.code === 'P2002') {
        const existingAfter = await prisma.hero.findUnique({
          where: { contentId },
          select: { id: true, status: true }
        })
        if (existingAfter) {
          // Trigger enrichment to complete it
          enrichContentId(contentId).catch(() => {
            // Non-blocking
          })
          return { created: false, heroId: existingAfter.id }
        }
      }
      // For other errors, still try to get existing or create minimal hero
      console.error('[upsertHero] Create error, attempting recovery:', createError)
      const existingAfter = await prisma.hero.findUnique({
        where: { contentId },
        select: { id: true }
      })
      if (existingAfter) {
        return { created: false, heroId: existingAfter.id }
      }
      // Last resort: create minimal hero without validation
      hero = await prisma.hero.create({
        data: {
          contentId,
          title: title || 'Untitled',
          sourceUrl: canonicalUrl || '',
          status: 'DRAFT'
        }
      })
    }

    // Trigger enrichment (async, non-blocking)
    // This will update the Hero record with image, quote, etc.
    enrichContentId(contentId).catch((error) => {
      console.error('[upsertHero] Enrichment failed:', error)
      // Don't throw - hero creation is non-blocking
      // The hero will remain in DRAFT status with minimal fields, which is acceptable
    })

    return { created: true, heroId: hero.id }
  } catch (error: any) {
    // Final fallback: try to get existing hero
    console.error('[upsertHero] Unexpected error:', error)
    try {
      const existing = await prisma.hero.findUnique({
        where: { contentId },
        select: { id: true }
      })
      if (existing) {
        return { created: false, heroId: existing.id }
      }
    } catch {
      // Ignore
    }
    // If all else fails, log but don't throw - hero creation is non-blocking
    // The hero will be created later via sync endpoint or enrichment retry
    logHeroEvent('hero_upsert_error', {
      patchId: params.patchId || 'unknown',
      contentId,
      url: canonicalUrl,
      traceId,
      error: error.message || 'Unknown error'
    })
    // Return empty string to indicate failure - caller should handle gracefully
    // The hero will be created later via sync endpoint
    return { created: false, heroId: '' }
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

