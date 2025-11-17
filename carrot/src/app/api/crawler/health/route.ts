/**
 * Health endpoint for crawler
 * GET /api/crawler/health
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const uptime = process.uptime()
  const version = process.env.npm_package_version || '1.0.0'

  return NextResponse.json({
    status: 'ok',
    uptime: Math.floor(uptime),
    version
  })
}

