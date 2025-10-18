import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Track rejected content to prevent discovery loops
 * This prevents the system from repeatedly trying to discover
 * the same low-quality or irrelevant content
 */

// Simple in-memory cache for rejected URLs (in production, use Redis or DB)
const rejectedContentCache = new Map<string, {
  url: string
  reason: string
  patchId: string
  rejectedAt: Date
  attempts: number
}>()

export async function POST(request: NextRequest) {
  try {
    const { url, reason, patchId } = await request.json()
    
    if (!url || !patchId) {
      return NextResponse.json(
        { error: 'URL and patchId required' },
        { status: 400 }
      )
    }
    
    const key = `${patchId}:${url}`
    const existing = rejectedContentCache.get(key)
    
    rejectedContentCache.set(key, {
      url,
      reason: reason || 'quality/relevance',
      patchId,
      rejectedAt: new Date(),
      attempts: (existing?.attempts || 0) + 1
    })
    
    console.log(`[Rejected Content] Logged rejection: ${url} (${reason})`)
    
    return NextResponse.json({
      success: true,
      message: 'Rejection logged'
    })
    
  } catch (error) {
    console.error('[Rejected Content] Error:', error)
    return NextResponse.json(
      { error: 'Failed to log rejection' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    const patchId = searchParams.get('patchId')
    
    if (!url || !patchId) {
      return NextResponse.json(
        { error: 'URL and patchId required' },
        { status: 400 }
      )
    }
    
    const key = `${patchId}:${url}`
    const rejected = rejectedContentCache.get(key)
    
    return NextResponse.json({
      isRejected: !!rejected,
      rejection: rejected || null
    })
    
  } catch (error) {
    console.error('[Rejected Content] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check rejection' },
      { status: 500 }
    )
  }
}

