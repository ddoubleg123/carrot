#!/usr/bin/env tsx

/**
 * Script to backfill existing discovered content with hero images
 * Usage: npx tsx scripts/backfill-hero-images.ts [patchId]
 */

import { PrismaClient } from '@prisma/client'
import { resolveHero } from '../src/lib/media/resolveHero'
import { MediaAssets } from '../src/lib/media/hero-types'

const prisma = new PrismaClient()

async function backfillHeroImages(patchId?: string) {
  console.log('🚀 Starting hero image backfill...')
  
  try {
    // Find content items that need hero images
    const whereClause = {
      ...(patchId && { patchId }),
      OR: [
        { mediaAssets: null },
        { mediaAssets: { path: ['hero'], equals: null } },
        { mediaAssets: { path: ['source'], equals: null } }
      ]
    }

    const items = await prisma.discoveredContent.findMany({
      where: whereClause,
      select: {
        id: true,
        type: true,
        sourceUrl: true,
        mediaAssets: true,
        title: true
      },
      orderBy: { createdAt: 'desc' }
    })

    console.log(`📊 Found ${items.length} items to process`)

    let processed = 0
    let successful = 0
    let failed = 0

    for (const item of items) {
      try {
        processed++
        console.log(`\n[${processed}/${items.length}] Processing: ${item.title}`)
        console.log(`   Type: ${item.type}, URL: ${item.sourceUrl?.substring(0, 50)}...`)

        // Update status to enriching
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { status: 'enriching' }
        })

        // Resolve hero image
        const heroResult = await resolveHero({
          url: item.sourceUrl || undefined,
          type: item.type as any
        })

        console.log(`   ✅ Hero resolved: ${heroResult.source} (${heroResult.hero.substring(0, 50)}...)`)

        // Update mediaAssets
        const existingMedia = item.mediaAssets as MediaAssets | null
        const updatedMediaAssets: MediaAssets = {
          ...existingMedia,
          hero: heroResult.hero,
          blurDataURL: heroResult.blurDataURL,
          dominant: heroResult.dominant,
          source: heroResult.source,
          license: heroResult.license
        }

        // Update database
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { 
            mediaAssets: updatedMediaAssets,
            status: 'ready'
          }
        })

        successful++
        console.log(`   ✅ Successfully enriched with ${heroResult.source} source`)

      } catch (error) {
        failed++
        console.error(`   ❌ Failed to enrich:`, error instanceof Error ? error.message : error)

        // Update status to failed
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { status: 'failed' }
        })
      }

      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(`\n🎉 Backfill complete!`)
    console.log(`   Total processed: ${processed}`)
    console.log(`   Successful: ${successful}`)
    console.log(`   Failed: ${failed}`)

  } catch (error) {
    console.error('💥 Backfill failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Get patchId from command line args
const patchId = process.argv[2]

backfillHeroImages(patchId).catch(console.error)
