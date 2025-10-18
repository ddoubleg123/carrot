import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Backfill AI-generated images for discovered content
 * POST /api/dev/backfill-ai-images
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patchHandle, limit = 5, forceRegenerate = false } = body

    console.log(`[Backfill AI Images] Starting backfill for patch: ${patchHandle}`)

    // Find discovered content for the patch
    const patch = await prisma.patch.findFirst({
      where: { handle: patchHandle },
      select: { id: true, name: true }
    })

    if (!patch) {
      return NextResponse.json(
        { error: 'Patch not found' },
        { status: 404 }
      )
    }

    // Get discovered content that needs AI images
    const discoveredContent = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id
      },
      take: limit,
      orderBy: { createdAt: 'desc' }
    })
    
    // Filter items that need images (if not forcing regeneration)
    const itemsToProcess = forceRegenerate 
      ? discoveredContent
      : discoveredContent.filter(item => {
          if (!item.mediaAssets) return true
          const assets = item.mediaAssets as any
          return !assets.heroImage || !assets.heroImage.url
        })

    console.log(`[Backfill AI Images] Found ${itemsToProcess.length} items to process`)

    const results = []
    const errors = []

    for (const item of itemsToProcess) {
      try {
        console.log(`[Backfill AI Images] Processing: ${item.title}`)
        
        // Generate AI image using our API
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005'}/api/ai/generate-hero-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: item.title,
            summary: item.content || 'No summary available',
            sourceDomain: item.sourceUrl ? new URL(item.sourceUrl).hostname : 'unknown',
            contentType: item.type || 'article',
            patchTheme: patch.name,
            artisticStyle: 'photorealistic',
            enableHiresFix: true
          })
        })

        if (!response.ok) {
          throw new Error(`AI generation failed: ${response.status}`)
        }

        const aiResult = await response.json()
        
        if (!aiResult.success || !aiResult.imageUrl) {
          throw new Error('No image generated')
        }

        // Update the discovered content with the AI-generated image
        const currentMediaAssets = (item.mediaAssets as any) || {}
        
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: {
            mediaAssets: {
              ...currentMediaAssets,
              hero: aiResult.imageUrl,
              source: 'ai-generated',
              license: 'generated',
              updatedAt: new Date().toISOString()
            }
          }
        })

        results.push({
          id: item.id,
          title: item.title,
          imageUrl: aiResult.imageUrl,
          status: 'success'
        })

        console.log(`[Backfill AI Images] ✅ Successfully generated AI image for: ${item.title}`)

      } catch (error: any) {
        console.error(`[Backfill AI Images] ❌ Failed to process ${item.title}:`, error)
        errors.push({
          id: item.id,
          title: item.title,
          error: error.message,
          status: 'failed'
        })
      }
    }

    return NextResponse.json({
      success: true,
      patch: patch.name,
      processed: discoveredContent.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    })

  } catch (error: any) {
    console.error('[Backfill AI Images] Error:', error)
    return NextResponse.json(
      { error: 'Backfill failed', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Get status of discovered content for a patch
 * GET /api/dev/backfill-ai-images?patchHandle=chicago-bulls
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const patchHandle = searchParams.get('patchHandle')

    if (!patchHandle) {
      return NextResponse.json(
        { error: 'patchHandle parameter required' },
        { status: 400 }
      )
    }

    const patch = await prisma.patch.findFirst({
      where: { handle: patchHandle },
      select: { id: true, name: true }
    })

    if (!patch) {
      return NextResponse.json(
        { error: 'Patch not found' },
        { status: 404 }
      )
    }

    const discoveredContent = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        title: true,
        mediaAssets: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    const stats = {
      total: discoveredContent.length,
      withHero: discoveredContent.filter(item => {
        const mediaAssets = item.mediaAssets as any
        return mediaAssets?.hero
      }).length,
      withoutHero: discoveredContent.filter(item => {
        const mediaAssets = item.mediaAssets as any
        return !mediaAssets?.hero
      }).length,
      aiGenerated: discoveredContent.filter(item => {
        const mediaAssets = item.mediaAssets as any
        return mediaAssets?.source === 'ai-generated'
      }).length
    }

    return NextResponse.json({
      patch: patch.name,
      stats,
      items: discoveredContent.map(item => ({
        id: item.id,
        title: item.title,
        hasHero: !!(item.mediaAssets as any)?.hero,
        source: (item.mediaAssets as any)?.source,
        createdAt: item.createdAt
      }))
    })

  } catch (error: any) {
    console.error('[Backfill AI Images] GET Error:', error)
    return NextResponse.json(
      { error: 'Failed to get status', details: error.message },
      { status: 500 }
    )
  }
}
