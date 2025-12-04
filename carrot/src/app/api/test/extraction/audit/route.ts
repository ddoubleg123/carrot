import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditWikipediaPageReferences } from '@/lib/discovery/wikipediaAudit'

export async function POST(req: Request) {
  try {
    const { patchHandle, wikipediaTitle } = await req.json()
    
    if (!patchHandle || !wikipediaTitle) {
      return NextResponse.json(
        { error: 'patchHandle and wikipediaTitle are required' },
        { status: 400 }
      )
    }
    
    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle }
    })
    
    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }
    
    const auditResult = await auditWikipediaPageReferences(patch.id, wikipediaTitle)
    
    return NextResponse.json(auditResult)
  } catch (error: any) {
    console.error('[Audit API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to audit Wikipedia page references' },
      { status: 500 }
    )
  }
}

