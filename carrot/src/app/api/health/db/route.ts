import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const started = Date.now()
  const res: any = {
    ok: false,
    connected: false,
    latencyMs: 0,
    checks: {},
  }
  try {
    // Basic connectivity
    await prisma.$queryRawUnsafe('SELECT 1')
    res.connected = true

    // Check for required tables (PostgreSQL)
    const required = ['patches', 'patch_members', 'patch_posts', 'facts', 'events', 'sources']
    for (const name of required) {
      try {
        const rows = await prisma.$queryRawUnsafe<{ relname: string }[]>(
          'SELECT relname FROM pg_catalog.pg_class WHERE relname = $1 LIMIT 1',
          name,
        )
        res.checks[name] = Array.isArray(rows) && rows.length > 0
      } catch {
        res.checks[name] = false
      }
    }

    // Non-fatal sanity: count patches if table exists
    if (res.checks.patches) {
      try {
        const [{ count }] = await prisma.$queryRawUnsafe<{ count: string }[]>(
          'SELECT COUNT(1) AS count FROM patches',
        )
        res.checks.patches_count = Number(count || '0')
      } catch {}
    }

    res.ok = res.connected
  } catch (e: any) {
    res.error = e?.message || String(e)
  } finally {
    res.latencyMs = Date.now() - started
  }

  return NextResponse.json(res, { status: res.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
