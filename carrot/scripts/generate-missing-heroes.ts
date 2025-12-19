/**
 * Generate missing heroes for DiscoveredContent items
 * 
 * Triggers enrichment for all items without Hero records
 */

import { prisma } from '@/lib/prisma'
import { enrichContentId } from '@/lib/enrichment/worker'

async function generateMissingHeroes() {
  console.log('🎨 Starting generation of missing heroes...\n')

  // Get all DiscoveredContent items without Hero records
  const contentWithoutHeroes = await prisma.discoveredContent.findMany({
    where: {
      heroRecord: null
    },
    select: {
      id: true,
      title: true,
      sourceUrl: true
    },
    take: 50 // Process in batches to avoid overwhelming the system
  })

  console.log(`Found ${contentWithoutHeroes.length} items without heroes (processing first 50)\n`)

  let successCount = 0
  let errorCount = 0

  for (const item of contentWithoutHeroes) {
    try {
      console.log(`Generating hero for: "${item.title.substring(0, 50)}" (${item.id})...`)
      
      const result = await enrichContentId(item.id)
      
      if (result.ok) {
        successCount++
        console.log(`  ✅ Success!`)
      } else {
        errorCount++
        console.log(`  ❌ Failed: ${result.errorCode} - ${result.errorMessage}`)
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error: any) {
      errorCount++
      console.error(`  ❌ Exception: ${error.message}`)
    }
  }

  console.log('\n📊 Summary:')
  console.log(`  Success: ${successCount}`)
  console.log(`  Failed: ${errorCount}`)
  console.log(`  Total: ${contentWithoutHeroes.length}`)
  console.log('\n✅ Generation complete!')
  console.log('   Note: Run this script multiple times to process all items in batches')
}

// Run if called directly
if (require.main === module) {
  generateMissingHeroes()
    .then(() => {
      console.log('\n✅ Script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error)
      process.exit(1)
    })
}

export { generateMissingHeroes }

