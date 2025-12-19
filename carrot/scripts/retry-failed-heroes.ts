/**
 * Retry failed hero enrichment
 * 
 * Fixes heroes in ERROR status by retrying enrichment
 */

import { prisma } from '@/lib/prisma'
import { enrichContentId } from '@/lib/enrichment/worker'

async function retryFailedHeroes() {
  console.log('🔄 Starting retry of failed heroes...\n')

  // Get all heroes in ERROR status
  const failedHeroes = await prisma.hero.findMany({
    where: {
      status: 'ERROR'
    },
    select: {
      id: true,
      contentId: true,
      errorMessage: true,
      sourceUrl: true
    },
    take: 100 // Process in batches
  })

  console.log(`Found ${failedHeroes.length} failed heroes to retry\n`)

  let successCount = 0
  let errorCount = 0

  for (const hero of failedHeroes) {
    try {
      console.log(`Retrying hero ${hero.id} for content ${hero.contentId}...`)
      console.log(`  Error: ${hero.errorMessage?.substring(0, 100)}`)
      
      const result = await enrichContentId(hero.contentId)
      
      if (result.ok) {
        successCount++
        console.log(`  ✅ Success!`)
      } else {
        errorCount++
        console.log(`  ❌ Failed: ${result.errorCode} - ${result.errorMessage}`)
      }
    } catch (error: any) {
      errorCount++
      console.error(`  ❌ Exception: ${error.message}`)
    }
  }

  console.log('\n📊 Summary:')
  console.log(`  Success: ${successCount}`)
  console.log(`  Failed: ${errorCount}`)
  console.log(`  Total: ${failedHeroes.length}`)
  console.log('\n✅ Retry complete!')
}

// Run if called directly
if (require.main === module) {
  retryFailedHeroes()
    .then(() => {
      console.log('\n✅ Script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error)
      process.exit(1)
    })
}

export { retryFailedHeroes }

