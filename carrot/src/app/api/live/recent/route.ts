import { NextResponse } from 'next/server'
import { railStatus } from '@/lib/live/now'
import { recentVideos } from '@/lib/live/recent'

export const runtime = 'nodejs'

export async function GET() {
  const rail = await railStatus(false)
  const videos = await recentVideos(rail)
  return NextResponse.json({ videos })
}
