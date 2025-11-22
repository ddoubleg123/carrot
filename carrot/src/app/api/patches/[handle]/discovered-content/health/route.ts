import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Health check endpoint for discovered content
 * GET /api/patches/[handle]/discovered-content/health
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Find the patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    // Count all items
    const totalCount = await prisma.discoveredContent.count({
      where: { patchId: patch.id }
    })

    // Get sample items
    const sampleItems = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        canonicalUrl: true,
        createdAt: true,
        relevanceScore: true
      },
      orderBy: [
        { relevanceScore: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json({
      success: true,
      patchId: patch.id,
      handle,
      count: totalCount,
      sampleCount: sampleItems.length,
      limit,
      offset,
      sampleItems: sampleItems.map(item => ({
        id: item.id,
        title: item.title,
        url: item.canonicalUrl,
        createdAt: item.createdAt.toISOString(),
        relevanceScore: item.relevanceScore
      }))
    })
  } catch (error) {
    console.error('[Health Check] Error:', error)
    return NextResponse.json(
      {
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

