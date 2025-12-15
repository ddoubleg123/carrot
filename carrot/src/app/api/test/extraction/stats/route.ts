/**
 * Real-time processing stats API
 * GET /api/test/extraction/stats
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const patch = await prisma.patch.findUnique({
      where: { handle: 'israel' },
      select: { id: true, title: true }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Israel patch not found' }, { status: 404 })
    }

    // Citation processing stats
    const [
      totalCitations,
      scannedCitations,
      savedCitations,
      deniedCitations,
      pendingCitations,
      citationsWithContent,
      recentSavedCitations,
      recentDeniedCitations
    ] = await Promise.all([
      prisma.wikipediaCitation.count({
        where: { monitoring: { patchId: patch.id } }
      }),
      prisma.wikipediaCitation.count({
        where: {
          monitoring: { patchId: patch.id },
          scanStatus: 'scanned'
        }
      }),
      prisma.wikipediaCitation.count({
        where: {
          monitoring: { patchId: patch.id },
          relevanceDecision: 'saved'
        }
      }),
      prisma.wikipediaCitation.count({
        where: {
          monitoring: { patchId: patch.id },
          relevanceDecision: 'denied'
        }
      }),
      prisma.wikipediaCitation.count({
        where: {
          monitoring: { patchId: patch.id },
          OR: [
            { scanStatus: 'not_scanned' },
            { scanStatus: 'scanning' },
            { scanStatus: 'scanned', relevanceDecision: null }
          ]
        }
      }),
      prisma.wikipediaCitation.count({
        where: {
          monitoring: { patchId: patch.id },
          AND: [
            { contentText: { not: null } },
            { contentText: { not: '' } }
          ]
        }
      }),
      prisma.wikipediaCitation.findMany({
        where: {
          monitoring: { patchId: patch.id },
          relevanceDecision: 'saved'
        },
        orderBy: { lastScannedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          citationTitle: true,
          citationUrl: true,
          contentText: true,
          aiPriorityScore: true,
          savedContentId: true,
          lastScannedAt: true
        }
      }),
      prisma.wikipediaCitation.findMany({
        where: {
          monitoring: { patchId: patch.id },
          relevanceDecision: 'denied',
          AND: [
            { contentText: { not: null } },
            { contentText: { not: '' } }
          ]
        },
        orderBy: { lastScannedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          citationTitle: true,
          citationUrl: true,
          contentText: true,
          aiPriorityScore: true,
          lastScannedAt: true
        }
      })
    ])

    // DiscoveredContent stats
    const [
      totalDiscoveredContent,
      discoveredContentWithHero,
      recentDiscoveredContent
    ] = await Promise.all([
      prisma.discoveredContent.count({
        where: {
          patchId: patch.id,
          metadata: {
            path: ['source'],
            equals: 'wikipedia-citation'
          }
        }
      }),
      prisma.discoveredContent.count({
        where: {
          patchId: patch.id,
          metadata: {
            path: ['source'],
            equals: 'wikipedia-citation'
          },
          hero: { not: Prisma.JsonNull }
        }
      }),
      prisma.discoveredContent.findMany({
        where: {
          patchId: patch.id,
          metadata: {
            path: ['source'],
            equals: 'wikipedia-citation'
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          sourceUrl: true,
          textContent: true,
          summary: true,
          createdAt: true,
          hero: true
        }
      })
    ])

    // Get agent for this patch (agents are associated via associatedPatches array)
    const agent = await prisma.agent.findFirst({
      where: {
        associatedPatches: {
          has: 'israel' // Patch handle for Israel patch
        },
        isActive: true
      },
      select: { id: true }
    })

    // Agent memory stats
    const [
      totalAgentMemories,
      discoveryMemories,
      feedQueueStats
    ] = await Promise.all([
      agent ? prisma.agentMemory.count({
        where: {
          agentId: agent.id,
          sourceType: 'discovery'
        }
      }) : Promise.resolve(0),
      prisma.agentMemory.count({
        where: {
          sourceType: 'discovery'
        }
      }),
      (async () => {
        try {
          const [queued, processing, done, failed] = await Promise.all([
            (prisma as any).agentMemoryFeedQueue.count({
              where: {
                patchId: patch.id,
                status: 'PENDING'
              }
            }),
            (prisma as any).agentMemoryFeedQueue.count({
              where: {
                patchId: patch.id,
                status: 'PROCESSING'
              }
            }),
            (prisma as any).agentMemoryFeedQueue.count({
              where: {
                patchId: patch.id,
                status: 'DONE'
              }
            }),
            (prisma as any).agentMemoryFeedQueue.count({
              where: {
                patchId: patch.id,
                status: 'FAILED'
              }
            })
          ])
          return { queued, processing, done, failed }
        } catch (error) {
          return { queued: 0, processing: 0, done: 0, failed: 0 }
        }
      })()
    ])

    // Recent agent memories
    const recentMemories = agent ? await prisma.agentMemory.findMany({
      where: {
        agentId: agent.id,
        sourceType: 'discovery'
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        sourceTitle: true,
        sourceUrl: true,
        content: true,
        createdAt: true
      }
    }) : []

    const processingRate = scannedCitations > 0 
      ? ((savedCitations / scannedCitations) * 100).toFixed(1)
      : '0.0'

    const progressPercent = totalCitations > 0
      ? ((scannedCitations / totalCitations) * 100).toFixed(1)
      : '0.0'

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      patch: {
        id: patch.id,
        title: patch.title
      },
      citations: {
        total: totalCitations,
        scanned: scannedCitations,
        saved: savedCitations,
        denied: deniedCitations,
        pending: pendingCitations,
        withContent: citationsWithContent,
        processingRate: `${processingRate}%`,
        progressPercent: `${progressPercent}%`,
        recentSaved: recentSavedCitations.map(c => ({
          id: c.id,
          title: c.citationTitle,
          url: c.citationUrl,
          contentLength: c.contentText?.length || 0,
          score: c.aiPriorityScore,
          savedContentId: c.savedContentId,
          scannedAt: c.lastScannedAt?.toISOString()
        })),
        recentDenied: recentDeniedCitations.map(c => ({
          id: c.id,
          title: c.citationTitle,
          url: c.citationUrl,
          contentLength: c.contentText?.length || 0,
          score: c.aiPriorityScore,
          scannedAt: c.lastScannedAt?.toISOString()
        }))
      },
      discoveredContent: {
        total: totalDiscoveredContent,
        withHero: discoveredContentWithHero,
        recent: recentDiscoveredContent.map(c => ({
          id: c.id,
          title: c.title,
          url: c.sourceUrl,
          contentLength: c.textContent?.length || 0,
          summary: c.summary,
          hasHero: c.hero !== null,
          createdAt: c.createdAt.toISOString()
        }))
      },
      agent: {
        totalMemories: totalAgentMemories,
        discoveryMemories: discoveryMemories,
        feedQueue: feedQueueStats,
        recentMemories: recentMemories.map(m => ({
          id: m.id,
          title: m.sourceTitle,
          url: m.sourceUrl,
          contentLength: m.content?.length || 0,
          preview: m.content?.substring(0, 200) || '',
          createdAt: m.createdAt.toISOString()
        }))
      }
    })
  } catch (error: any) {
    console.error('[Extraction Stats] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}

