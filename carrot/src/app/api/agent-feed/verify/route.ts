/**
 * Agent Feed Verification Endpoint
 * 
 * GET /api/agent-feed/verify
 * Verifies that all DiscoveredContent is properly fed to agents
 * Checks for discrepancies and reports issues
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AgentRegistry } from '@/lib/ai-agents/agentRegistry'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patchHandle = searchParams.get('patch')

    const verification: any = {
      timestamp: new Date().toISOString(),
      overall: {
        healthy: true,
        issues: []
      },
      patches: []
    }

    // Get patches to verify
    const patches = patchHandle
      ? await prisma.patch.findMany({
          where: { handle: patchHandle },
          select: { id: true, handle: true, title: true }
        })
      : await prisma.patch.findMany({
          select: { id: true, handle: true, title: true }
        })

    for (const patch of patches) {
      const patchVerification: any = {
        patch: patch.handle,
        title: patch.title,
        healthy: true,
        issues: [],
        stats: {
          discoveredContent: 0,
          queued: 0,
          fed: 0,
          missing: 0
        }
      }

      // Get DiscoveredContent count
      const discoveredContent = await prisma.discoveredContent.findMany({
        where: { patchId: patch.id },
        select: { id: true }
      })
      patchVerification.stats.discoveredContent = discoveredContent.length

      // Get queue stats
      const queueStats = await (prisma as any).agentMemoryFeedQueue.groupBy({
        by: ['status'],
        where: { patchId: patch.id },
        _count: true
      })

      const queueCounts = {
        PENDING: 0,
        PROCESSING: 0,
        DONE: 0,
        FAILED: 0
      }

      for (const stat of queueStats) {
        queueCounts[stat.status as keyof typeof queueCounts] = stat._count
      }

      patchVerification.stats.queued = Object.values(queueCounts).reduce((a, b) => a + b, 0)

      // Get agent
      const agents = await AgentRegistry.getAgentsByPatches([patch.handle])
      if (agents.length === 0) {
        patchVerification.healthy = false
        patchVerification.issues.push('No agent found for patch')
        verification.patches.push(patchVerification)
        continue
      }

      const agent = agents[0]

      // Get AgentMemory entries from DiscoveredContent
      const agentMemories = await prisma.agentMemory.findMany({
        where: {
          agentId: agent.id,
          patchId: patch.id,
          sourceType: 'discovery'
        },
        select: {
          discoveredContentId: true
        }
      })

      patchVerification.stats.fed = agentMemories.filter(m => m.discoveredContentId).length

      // Find missing items
      const fedContentIds = new Set(
        agentMemories
          .filter(m => m.discoveredContentId)
          .map(m => m.discoveredContentId!)
      )

      const queuedContentIds = new Set(
        await (prisma as any).agentMemoryFeedQueue.findMany({
          where: { patchId: patch.id },
          select: { discoveredContentId: true }
        }).then((items: any[]) => items.map(i => i.discoveredContentId))
      )

      const allContentIds = new Set(discoveredContent.map(c => c.id))
      const missingContentIds = Array.from(allContentIds).filter(
        id => !fedContentIds.has(id) && !queuedContentIds.has(id)
      )

      patchVerification.stats.missing = missingContentIds.length

      // Check for issues
      if (missingContentIds.length > 0) {
        patchVerification.healthy = false
        patchVerification.issues.push(
          `${missingContentIds.length} DiscoveredContent items not queued or fed`
        )
      }

      if (queueCounts.PENDING > 50) {
        patchVerification.healthy = false
        patchVerification.issues.push(
          `${queueCounts.PENDING} items pending (may need processing)`
        )
      }

      if (queueCounts.FAILED > 0) {
        patchVerification.healthy = false
        patchVerification.issues.push(
          `${queueCounts.FAILED} items failed (may need investigation)`
        )
      }

      if (queueCounts.PROCESSING > 10) {
        patchVerification.healthy = false
        patchVerification.issues.push(
          `${queueCounts.PROCESSING} items stuck in PROCESSING state`
        )
      }

      if (!patchVerification.healthy) {
        verification.overall.healthy = false
      }

      verification.patches.push(patchVerification)
    }

    // Overall summary
    const totalDiscovered = verification.patches.reduce(
      (sum: number, p: any) => sum + p.stats.discoveredContent,
      0
    )
    const totalFed = verification.patches.reduce(
      (sum: number, p: any) => sum + p.stats.fed,
      0
    )
    const totalMissing = verification.patches.reduce(
      (sum: number, p: any) => sum + p.stats.missing,
      0
    )

    verification.summary = {
      totalPatches: patches.length,
      healthyPatches: verification.patches.filter(p => p.healthy).length,
      totalDiscoveredContent: totalDiscovered,
      totalFed: totalFed,
      totalMissing: totalMissing,
      coveragePercent: totalDiscovered > 0
        ? ((totalFed / totalDiscovered) * 100).toFixed(1)
        : '0'
    }

    return NextResponse.json(verification)
  } catch (error) {
    console.error('[AgentFeedVerify] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to verify',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

