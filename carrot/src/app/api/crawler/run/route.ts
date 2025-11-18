/**
 * API endpoint to start a crawler run
 * POST /api/crawler/run
 */

import { NextRequest, NextResponse } from 'next/server'
import { CrawlerOrchestrator } from '@/lib/crawler/orchestrator'
import { CRAWLER_PRIORITY_V2 } from '@/lib/discovery/flags'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    if (!CRAWLER_PRIORITY_V2) {
      return NextResponse.json(
        { error: 'Crawler feature disabled (CRAWLER_PRIORITY_V2=false)' },
        { status: 503 }
      )
    }
    
    const body = await request.json().catch(() => ({}))
    const { topic, durationMinutes = 5, maxPages = 100, highSignalDomains } = body
    
    if (!topic || typeof topic !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid topic parameter' },
        { status: 400 }
      )
    }
    
    // Start crawler in background (fire and forget)
    const orchestrator = new CrawlerOrchestrator()
    orchestrator.run({
      topic,
      durationMinutes: Number(durationMinutes) || 5,
      maxPages: Number(maxPages) || 100,
      highSignalDomains: Array.isArray(highSignalDomains) ? highSignalDomains : undefined,
    }).catch((error) => {
      console.error('[Crawler API] Run failed:', error)
    })
    
    return NextResponse.json({
      ok: true,
      message: 'Crawler run started',
      topic,
      durationMinutes: Number(durationMinutes) || 5,
      maxPages: Number(maxPages) || 100,
    }, { status: 202 })
  } catch (error: any) {
    console.error('[Crawler API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

