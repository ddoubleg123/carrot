import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const total = await prisma.patch.count()
    return NextResponse.json({ success: true, total })
  } catch (e: any) {
    console.error('[PATCHES COUNT] error', e)
    return NextResponse.json({ success: false, error: e?.message || 'server error' }, { status: 500 })
  }
}
