import { NextResponse } from 'next/server'
import { selfAuditAndFix } from '@/../../scripts/self-audit-and-fix'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/self-audit
 * Cron endpoint for self-audit and auto-fix
 * Call this from a cron job (e.g., every hour)
 * 
 * Security: Add authentication header check in production
 */
export async function GET(req: Request) {
  try {
    // Optional: Add authentication check
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Cron] Starting self-audit and auto-fix...')
    const startTime = Date.now()

    const results = await selfAuditAndFix()

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      results: {
        untitledFixed: results.untitledFixed,
        agentMemoryFixed: results.agentMemoryFixed,
        stuckQueueItemsReset: results.stuckQueueItemsReset,
        errors: results.errors,
        errorCount: results.errors.length
      },
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Cron] Self-audit error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

