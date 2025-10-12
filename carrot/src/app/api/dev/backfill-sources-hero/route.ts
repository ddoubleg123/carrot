import { NextResponse } from 'next/server'
import { PrismaClient, Prisma } from '@prisma/client'
import { resolveHero } from '@/lib/media/resolveHero'

const prisma = new PrismaClient()

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    console.log('🚀 Starting hero image backfill for SOURCES...')
    
    // Parse request body to check for patch handle
    let patchHandle = null;
    try {
      const body = await req.json();
      patchHandle = body.patchHandle;
    } catch {
      // No body or invalid JSON, continue with default behavior
    }
    
    // Build where clause based on whether patchHandle is provided
    let whereClause: any = {};
    
    if (patchHandle) {
      // Find the patch by handle
      const patch = await prisma.patch.findUnique({
        where: { handle: patchHandle },
        select: { id: true }
      });
      
      if (!patch) {
        return NextResponse.json({
          success: false,
          error: `Patch with handle '${patchHandle}' not found`
        }, { status: 404 });
      }
      
      // Get sources for this specific patch (we'll filter for missing mediaAssets manually)
      whereClause = {
        patchId: patch.id
      };
      
      console.log(`🎯 Targeting patch: ${patchHandle} (ID: ${patch.id})`);
    } else {
      // Default behavior: Get recent sources that likely need hero enrichment
      whereClause = {
        // Get sources created in the last 30 days
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      };
    }
    
    // Get sources that need hero enrichment
    const sources = await prisma.source.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        url: true,
        patchId: true,
        citeMeta: true
      },
      take: patchHandle ? 20 : 10 // Allow more for targeted backfill
    })

    console.log(`📊 Found ${sources.length} sources to process`)
    
    // Filter for sources that actually need hero images
    const sourcesNeedingHero = sources.filter(source => {
      const citeMeta = source.citeMeta as any;
      return !citeMeta?.mediaAssets?.hero;
    });
    
    console.log(`📸 Sources needing hero images: ${sourcesNeedingHero.length}`)

    if (sourcesNeedingHero.length === 0) {
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
    for (const source of sourcesNeedingHero) {
      try {
        console.log(`🎯 Processing source: ${source.title} (${source.url})`)
        
        // Determine content type from citeMeta
        const type = (source.citeMeta as any)?.type || 'article'
        
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
          ...(source.citeMeta as any),
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
        total: sourcesNeedingHero.length,
        processed,
        successful,
        failed,
        successRate: processed > 0 ? ((successful / processed) * 100).toFixed(1) + '%' : '0%'
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
    const totalSources = await prisma.source.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    })
    const sourcesNeedingHero = await prisma.source.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    })
    
    const sourcesWithHero = await prisma.source.count({
      where: {
        AND: [
          {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          },
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
