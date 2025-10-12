import { NextResponse } from 'next/server'
import { PrismaClient, Prisma } from '@prisma/client'
import { resolveHero } from '@/lib/media/resolveHero'
import { MediaAssets } from '@/lib/media/hero-types'

const prisma = new PrismaClient()

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    console.log('🚀 Starting hero image backfill for DISCOVERED CONTENT...')
    
    // Get discovered content that doesn't have mediaAssets
    const discoveredContent = await prisma.discoveredContent.findMany({
      where: {
        OR: [
          { mediaAssets: { equals: Prisma.JsonNull } },
          { mediaAssets: { path: ['hero'], equals: Prisma.JsonNull } },
          { mediaAssets: { path: ['source'], equals: Prisma.JsonNull } }
        ]
      },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        type: true,
        patchId: true,
        mediaAssets: true
      },
      take: 10 // Process in batches
    })

    console.log(`Found ${discoveredContent.length} discovered content items to backfill.`)

    const results = []
    const errors = []

    for (const item of discoveredContent) {
      try {
        console.log(`🎯 Processing discovered content: ${item.title} (${item.sourceUrl})`)
        
        // Determine content type
        const type = item.type || 'article'
        
        // Resolve hero image using the 4-tier pipeline
        const heroResult = await resolveHero({
          url: item.sourceUrl,
          type: type as any,
        })

        // Update the discovered content with media assets
        const updatedMediaAssets: MediaAssets = {
          hero: heroResult.hero,
          blurDataURL: heroResult.blurDataURL,
          dominant: heroResult.dominant,
          source: heroResult.source,
          license: heroResult.license
        }
        
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { 
            mediaAssets: updatedMediaAssets as any, // Cast to satisfy Prisma JSON type
            status: 'ready'
          }
        })

        results.push({ id: item.id, status: 'success', hero: heroResult.hero })
        console.log(`✅ Successfully backfilled hero for discovered content: ${item.id}`)

      } catch (error: any) {
        console.error(`❌ Failed to backfill hero for discovered content ${item.id}:`, error)
        errors.push({ id: item.id, status: 'failed', error: error.message })
      }
    }

    return NextResponse.json({
      success: true,
      processed: discoveredContent.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors
    })

  } catch (error: any) {
    console.error('🚨 Error during discovered content backfill:', error)
    return NextResponse.json(
      { error: 'Failed to trigger backfill', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Get count of discovered content that need hero images
    const totalDiscoveredContent = await prisma.discoveredContent.count()
    const discoveredContentNeedingHero = await prisma.discoveredContent.count({
      where: {
        OR: [
          { mediaAssets: { equals: Prisma.JsonNull } },
          { mediaAssets: { path: ['hero'], equals: Prisma.JsonNull } },
          { mediaAssets: { path: ['source'], equals: Prisma.JsonNull } }
        ]
      }
    })
    
    const discoveredContentWithHero = await prisma.discoveredContent.count({
      where: {
        AND: [
          { mediaAssets: { not: Prisma.JsonNull } },
          { mediaAssets: { path: ['hero'], not: Prisma.JsonNull } }
        ]
      }
    })
    
    return NextResponse.json({
      success: true,
      stats: {
        totalDiscoveredContent,
        discoveredContentNeedingHero,
        discoveredContentWithHero,
        completionRate: `${((discoveredContentWithHero / totalDiscoveredContent) * 100).toFixed(1)}%`
      }
    })
  } catch (error: any) {
    console.error('🚨 Error getting discovered content backfill stats:', error)
    return NextResponse.json(
      { error: 'Failed to get backfill stats', details: error.message },
      { status: 500 }
    )
  }
}
