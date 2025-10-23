import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

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

    console.log(`[Analytics] Tracking event: ${action}`, {
      action,
      data,
      timestamp: timestamp || new Date().toISOString()
    })

    // For now, just log the events to console
    // In the future, we can add a proper audit table to the database
    console.log(`[Analytics] ✅ Event tracked: ${action}`)

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('[Analytics] Error:', error)
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    )
  }
}
