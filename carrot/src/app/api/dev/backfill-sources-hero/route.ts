import { NextResponse } from 'next/server'
import { PrismaClient, Prisma } from '@prisma/client'
import { resolveHero } from '@/lib/media/resolveHero'

const prisma = new PrismaClient()

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    console.log('🚀 Starting hero image backfill for SOURCES...')
    
    // Get all sources that don't have mediaAssets in citeMeta
    const sources = await prisma.source.findMany({
      where: {
        OR: [
          { citeMeta: { path: ['mediaAssets'], equals: Prisma.JsonNull } },
          { citeMeta: { path: ['mediaAssets', 'hero'], equals: Prisma.JsonNull } },
          { citeMeta: { path: ['mediaAssets', 'source'], equals: Prisma.JsonNull } }
        ]
      },
      select: {
        id: true,
        title: true,
        url: true,
        patchId: true,
        citeMeta: true
      },
      take: 10 // Limit for testing
    })

    console.log(`📊 Found ${sources.length} sources to process`)

    if (sources.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No sources need hero image enrichment',
        processed: 0,
        successful: 0,
        failed: 0
      })
    }

    let processed = 0
    let successful = 0
    let failed = 0
    const results = []

    // Process sources
    for (const source of sources) {
      try {
        console.log(`🎯 Processing source: ${source.title} (${source.url})`)
        
        // Determine content type from citeMeta
        const type = source.citeMeta?.type || 'article'
        
        // Resolve hero image using the 4-tier pipeline
        const heroResult = await resolveHero({
          url: source.url,
          type: type as any,
          assetUrl: source.url
        })
        
        console.log(`✅ Hero resolved for ${source.id}:`, {
          source: heroResult.source,
          license: heroResult.license,
          hasHero: !!heroResult.hero,
          hasBlur: !!heroResult.blurDataURL,
          hasDominant: !!heroResult.dominant
        })
        
        // Update the source's citeMeta with media assets
        const updatedCiteMeta = {
          ...source.citeMeta,
          mediaAssets: {
            hero: heroResult.hero,
            blurDataURL: heroResult.blurDataURL,
            dominant: heroResult.dominant,
            source: heroResult.source,
            license: heroResult.license
          }
        }
        
        await prisma.source.update({
          where: { id: source.id },
          data: { citeMeta: updatedCiteMeta }
        })
        
        console.log(`💾 Updated source ${source.id} with hero data`)
        
        successful++
        results.push({
          id: source.id,
          title: source.title,
          url: source.url,
          success: true,
          heroSource: heroResult.source,
          hasHero: !!heroResult.hero
        })
        
      } catch (error) {
        console.error(`❌ Failed to process source ${source.id}:`, error)
        failed++
        results.push({
          id: source.id,
          title: source.title,
          url: source.url,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
      
      processed++
      
      // Small delay between items
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
    
    console.log('🎉 Source backfill completed!')
    console.log(`📊 Summary: ${processed} processed, ${successful} successful, ${failed} failed`)
    
    return NextResponse.json({
      success: true,
      message: 'Source hero image backfill completed',
      summary: {
        total: sources.length,
        processed,
        successful,
        failed,
        successRate: ((successful / processed) * 100).toFixed(1) + '%'
      },
      results
    })
    
  } catch (error) {
    console.error('💥 Source backfill failed:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Source backfill failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    // Get count of sources that need hero images
    const totalSources = await prisma.source.count()
    const sourcesNeedingHero = await prisma.source.count({
      where: {
        OR: [
          { citeMeta: { path: ['mediaAssets'], equals: Prisma.JsonNull } },
          { citeMeta: { path: ['mediaAssets', 'hero'], equals: Prisma.JsonNull } },
          { citeMeta: { path: ['mediaAssets', 'source'], equals: Prisma.JsonNull } }
        ]
      }
    })
    
    const sourcesWithHero = await prisma.source.count({
      where: {
        AND: [
          { citeMeta: { path: ['mediaAssets'], not: Prisma.JsonNull } },
          { citeMeta: { path: ['mediaAssets', 'hero'], not: Prisma.JsonNull } }
        ]
      }
    })
    
    return NextResponse.json({
      success: true,
      stats: {
        totalSources,
        sourcesNeedingHero,
        sourcesWithHero,
        completionRate: totalSources > 0 ? ((sourcesWithHero / totalSources) * 100).toFixed(1) + '%' : '0%'
      }
    })
    
  } catch (error) {
    console.error('Error getting source backfill stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get stats' },
      { status: 500 }
    )
  }
}
