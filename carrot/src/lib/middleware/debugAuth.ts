/**
 * Debug endpoint authentication middleware
 * Requires org-admin via server-side session check
 * Returns 403 (not 200 with error) to avoid confusing FE
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireOrgAdmin } from '@/lib/auth/orgAdmin'

/**
 * Middleware to protect debug endpoints
 * Call this at the start of any /api/debug/* route handler
 */
export async function requireDebugAuth(request: NextRequest): Promise<NextResponse | null> {
  const authResult = await requireOrgAdmin()
  
  if (!authResult.isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: Org admin access required' },
      { status: 403 }
    )
  }
  
  return null // Auth passed, continue
}

