/**
 * Agent Feed Sync Endpoint
 * 
 * POST /api/patches/[handle]/agent/sync
 * Triggers a controlled backfill for last N items
 * Admin-only (check session)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { enqueueDiscoveredContent, calculateContentHash } from '@/lib/agent/feedWorker'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    // Check authentication (admin only)
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { handle } = await params
    const body = await request.json().catch(() => ({}))
    const limit = body.limit ? parseInt(body.limit) : undefined // No limit by default - feed ALL
    const since = body.since ? new Date(body.since) : null
    const dryRun = body.dryRun === true

    // Get patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })

    if (!patch) {
      return NextResponse.json(
        { error: 'Patch not found' },
        { status: 404 }
      )
    }

    // Find ALL discovered content that hasn't been fed to agents (NO LIMITS)
    const where: any = {
      patchId: patch.id
    }

    if (since) {
      where.createdAt = { gte: since }
    }

    const discoveredContent = await prisma.discoveredContent.findMany({
      where,
      select: {
        id: true,
        title: true,
        summary: true,
        textContent: true,
        contentHash: true,
        relevanceScore: true,
        qualityScore: true
      },
      orderBy: { createdAt: 'desc' },
      ...(limit ? { take: limit } : {}) // Only apply limit if specified
    })

    let enqueued = 0
    let skipped = 0
    let failed = 0

    for (const content of discoveredContent) {
      // Check if already processed
      const existingMemory = await prisma.agentMemory.findUnique({
        where: {
          patchId_discoveredContentId_contentHash: {
            patchId: patch.id,
            discoveredContentId: content.id,
            contentHash: content.contentHash || calculateContentHash(
              content.title,
              content.summary,
              content.textContent
            )
          }
        }
      })

      if (existingMemory) {
        skipped++
        continue
      }

      // Quality gates (very lenient - only filter obvious junk)
      const textBytes = (content.textContent || content.summary || '').length
      const MIN_TEXT_BYTES = 50 // Very low - include almost everything
      const MIN_RELEVANCE = 0 // No minimum - learn everything

      if (textBytes < MIN_TEXT_BYTES) {
        skipped++
        continue
      }
      // Relevance check removed - learn everything

      if (!dryRun) {
        const contentHash = content.contentHash || calculateContentHash(
          content.title,
          content.summary,
          content.textContent
        )

        const result = await enqueueDiscoveredContent(
          content.id,
          patch.id,
          contentHash,
          0
        )

        if (result.enqueued) {
          enqueued++
        } else {
          failed++
        }
      } else {
        enqueued++ // Count as would-be enqueued
      }
    }

    return NextResponse.json({
      success: true,
      enqueued,
      skipped,
      failed,
      total: discoveredContent.length,
      dryRun
    })
  } catch (error) {
    console.error('[AgentSync] Error:', error)
    return NextResponse.json(
      { error: 'Failed to sync' },
      { status: 500 }
    )
  }
}

