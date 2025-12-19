import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { selfAuditAndFix } from '@/../../scripts/self-audit-and-fix'

const execAsync = promisify(exec)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/system/self-audit
 * Runs self-audit and auto-fix for all patches or a specific patch
 * 
 * Query params:
 * - patch: optional patch handle to audit specific patch
 */
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const patchHandle = searchParams.get('patch') || undefined

    console.log(`[Self-Audit] Starting audit${patchHandle ? ` for patch: ${patchHandle}` : ' (all patches)'}`)

    const results = await selfAuditAndFix(patchHandle)

    return NextResponse.json({
      success: true,
      results: {
        untitledFixed: results.untitledFixed,
        agentMemoryFixed: results.agentMemoryFixed,
        stuckQueueItemsReset: results.stuckQueueItemsReset,
        errors: results.errors,
        errorCount: results.errors.length
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Self-Audit] Error:', error)
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

/**
 * GET /api/system/self-audit
 * Returns status of last audit (for monitoring)
 */
export async function GET() {
  return NextResponse.json({
    message: 'Use POST to run self-audit',
    endpoint: '/api/system/self-audit',
    method: 'POST',
    queryParams: {
      patch: 'optional - patch handle to audit specific patch'
    }
  })
}

