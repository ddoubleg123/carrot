/**
 * Admin backfill trigger
 * Minimal admin page/action to trigger backfill-heros with patch/limit params
 * Shows live counter from /debug/health
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/auth/orgAdmin'
import { getCounterStats } from '@/lib/counters/dbTruth'
import { enrichContentId } from '@/lib/enrichment/worker'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

/**
 * POST: Trigger backfill for heroes
 * Body: { patchId?: string, patchHandle?: string, limit?: number }
 */
export async function POST(request: NextRequest) {
  // Require org-admin auth
  const authResult = await requireOrgAdmin()
  if (!authResult.isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Org admin access required' },
      { status: 403 }
    )
  }
  
  try {
    const body = await request.json()
    const { patchId, patchHandle, limit = 50 } = body
    
    // Resolve patch
    let patch
    if (patchHandle) {
      patch = await prisma.patch.findUnique({
        where: { handle: patchHandle },
        select: { id: true }
      })
      if (!patch) {
        return NextResponse.json(
          { error: `Patch not found: ${patchHandle}` },
          { status: 404 }
        )
      }
    } else if (patchId) {
      patch = await prisma.patch.findUnique({
        where: { id: patchId },
        select: { id: true }
      })
      if (!patch) {
        return NextResponse.json(
          { error: `Patch not found: ${patchId}` },
          { status: 404 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'patchId or patchHandle required' },
        { status: 400 }
      )
    }
    
    // Find content without heroes
    const contentWithoutHeroes = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id,
        heroRecord: null,
        textContent: { not: null }
      },
      take: limit,
      select: { id: true, title: true }
    })
    
    // Trigger enrichment for each
    const results = []
    for (const item of contentWithoutHeroes) {
      try {
        const result = await enrichContentId(item.id)
        results.push({
          id: item.id,
          title: item.title,
          success: result.ok,
          heroId: result.heroId,
          error: result.errorMessage
        })
      } catch (error) {
        results.push({
          id: item.id,
          title: item.title,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    // Get live counter stats
    const stats = await getCounterStats(patch.id)
    
    return NextResponse.json({
      success: true,
      patchId: patch.id,
      processed: results.length,
      results,
      stats
    })
    
  } catch (error) {
    console.error('[Admin Backfill] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET: Get backfill status and stats
 */
export async function GET(request: NextRequest) {
  // Require org-admin auth
  const authResult = await requireOrgAdmin()
  if (!authResult.isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Org admin access required' },
      { status: 403 }
    )
  }
  
  try {
    const { searchParams } = new URL(request.url)
    const patchId = searchParams.get('patchId')
    
    const stats = await getCounterStats(patchId || undefined)
    
    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    console.error('[Admin Backfill] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

