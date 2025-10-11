#!/usr/bin/env tsx

/**
 * Backfill Hero Images for All Existing Discovered Content
 * 
 * This script processes all existing discovered content items and enriches them
 * with hero images using the 4-tier hero pipeline.
 */

import { PrismaClient } from '@prisma/client'
import { resolveHero } from '../src/lib/media/resolveHero'

const prisma = new PrismaClient()

interface SourceItem {
  id: string
  title: string
  url: string
  patchId: string
  citeMeta: any
}

async function backfillHeroImages() {
  console.log('🚀 Starting hero image backfill for all discovered content...')
  
  try {
    // Get all sources that don't have mediaAssets
    const sources = await prisma.source.findMany({
      where: {
        OR: [
          { citeMeta: { path: ['mediaAssets'], equals: null } },
          { citeMeta: { path: ['mediaAssets', 'hero'], equals: null } },
          { citeMeta: { path: ['mediaAssets', 'source'], equals: null } }
        ]
      },
      select: {
        id: true,
        title: true,
        url: true,
        patchId: true,
        citeMeta: true
      }
    })

    console.log(`📊 Found ${sources.length} sources to process`)

    if (sources.length === 0) {
      console.log('✅ No sources need hero image enrichment')
      return
    }

    let processed = 0
    let successful = 0
    let failed = 0

    // Process sources in batches to avoid overwhelming the system
    const batchSize = 5
    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize)
      
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(sources.length / batchSize)} (${batch.length} items)`)
      
      const batchPromises = batch.map(async (source) => {
        try {
          console.log(`🎯 Processing: ${source.title} (${source.url})`)
          
          // Determine content type
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
          
          // Update the source with media assets
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
          
          console.log(`💾 Updated ${source.id} with hero data`)
          return { success: true, id: source.id }
          
        } catch (error) {
          console.error(`❌ Failed to process ${source.id}:`, error)
          return { success: false, id: source.id, error }
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      
      // Count results
      batchResults.forEach(result => {
        if (result.success) {
          successful++
        } else {
          failed++
        }
        processed++
      })
      
      // Progress update
      console.log(`📈 Progress: ${processed}/${sources.length} (${successful} successful, ${failed} failed)`)
      
      // Small delay between batches to be gentle on external APIs
      if (i + batchSize < sources.length) {
        console.log('⏳ Waiting 2 seconds before next batch...')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    console.log('\n🎉 Backfill completed!')
    console.log(`📊 Summary:`)
    console.log(`   Total processed: ${processed}`)
    console.log(`   Successful: ${successful}`)
    console.log(`   Failed: ${failed}`)
    console.log(`   Success rate: ${((successful / processed) * 100).toFixed(1)}%`)
    
  } catch (error) {
    console.error('💥 Backfill failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the backfill
if (require.main === module) {
  backfillHeroImages()
    .then(() => {
      console.log('✅ Backfill script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Backfill script failed:', error)
      process.exit(1)
    })
}

export { backfillHeroImages }
