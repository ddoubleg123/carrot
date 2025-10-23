import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

// Validation schema
const TrackEventSchema = z.object({
  action: z.string(),
  data: z.record(z.any()),
  timestamp: z.string().optional()
})

/**
 * Track analytics events
 * POST /api/analytics/track
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = TrackEventSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      )
    }
    
    const { action, data, timestamp } = validation.data

    console.log(`[Analytics] Tracking event: ${action}`)

    // Store in audit_events table
    try {
      await prisma.auditEvent.create({
        data: {
          action,
          data: JSON.stringify(data),
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          userId: data.userId || null,
          postId: data.postId || null,
          groupId: data.groupId || null
        }
      })

      console.log(`[Analytics] ✅ Event tracked: ${action}`)
    } catch (dbError) {
      console.warn('[Analytics] Database tracking failed (non-critical):', dbError)
      // Don't fail the request if database tracking fails
    }

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[Analytics] Error:', error)
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    )
  }
}
