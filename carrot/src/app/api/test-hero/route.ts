import { NextRequest, NextResponse } from 'next/server'
import { resolveHero } from '@/lib/media/resolveHero'

export async function POST(request: NextRequest) {
  try {
    const { url, type, title, summary, patchTheme } = await request.json()

    if (!url || !type) {
      return NextResponse.json({ error: 'Missing url or type parameter' }, { status: 400 })
    }

    console.log('[TestHero] Testing hero resolution for:', { url, type, title: title?.substring(0, 50) })
    
    const heroResult = await resolveHero({
      url: url,
      type: type as any,
      assetUrl: url,
      title: title,
      summary: summary,
      patchTheme: patchTheme
    })

    console.log('[TestHero] Hero resolution result:', heroResult)
    
    return NextResponse.json(heroResult)
  } catch (error) {
    console.error('[TestHero] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
