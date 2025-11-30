/**
 * Wikipedia Monitoring Status API
 * Provides visibility into Wikipedia search and processing status
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getWikipediaMonitoringStatus,
  getWikipediaProcessingProgress,
  getTopPriorityCitations
} from '@/lib/discovery/wikipediaMetrics'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params
    const { searchParams } = new URL(req.url)
    const includeTopCitations = searchParams.get('includeTopCitations') === 'true'

    // Find the patch by handle
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true, title: true, handle: true }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    // Get comprehensive status
    const status = await getWikipediaMonitoringStatus(patch.id)
    const progress = await getWikipediaProcessingProgress(patch.id)

    // Get top priority citations if requested
    let topCitations: any[] = []
    if (includeTopCitations) {
      topCitations = await getTopPriorityCitations(patch.id, 10)
    }

    return NextResponse.json({
      success: true,
      patch: {
        id: patch.id,
        handle: patch.handle,
        title: patch.title
      },
      status: {
        ...status,
        progress
      },
      topCitations: includeTopCitations ? topCitations : undefined,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Wikipedia Status API] Error:', error)
    
    // Check if it's a database table missing error
    if (error instanceof Error && error.message.includes('does not exist')) {
      return NextResponse.json({
        success: false,
        error: 'Database tables not initialized',
        message: 'Wikipedia monitoring tables have not been created. Please run database migrations.',
        requiresMigration: true
      }, { status: 503 })
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch Wikipedia monitoring status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

