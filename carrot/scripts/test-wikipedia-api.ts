/**
 * Test Wikipedia monitoring API endpoint
 * Run with: npx tsx scripts/test-wikipedia-api.ts [patch-handle]
 */

import { getWikipediaMonitoringStatus, getWikipediaProcessingProgress, getTopPriorityCitations } from '../src/lib/discovery/wikipediaMetrics'
import { prisma } from '../src/lib/prisma'

async function testAPI(patchHandle?: string) {
  console.log('Testing Wikipedia Monitoring API...\n')

  try {
    // Find a patch to test with
    let patch
    if (patchHandle) {
      patch = await prisma.patch.findUnique({
        where: { handle: patchHandle },
        select: { id: true, handle: true, title: true }
      })
    } else {
      patch = await prisma.patch.findFirst({
        select: { id: true, handle: true, title: true }
      })
    }

    if (!patch) {
      console.error('❌ No patch found')
      console.error('   Create a patch first or specify a handle:')
      console.error('   npx tsx scripts/test-wikipedia-api.ts chicago-bulls')
      process.exit(1)
    }

    console.log(`Testing with patch: ${patch.handle} (${patch.title})\n`)

    // Test status endpoint
    console.log('1. Testing getWikipediaMonitoringStatus()...')
    const status = await getWikipediaMonitoringStatus(patch.id)
    console.log('   ✅ Status retrieved:')
    console.log(`      - Total pages: ${status.totalPages}`)
    console.log(`      - Scanned pages: ${status.scannedPages}`)
    console.log(`      - Total citations: ${status.totalCitations}`)
    console.log(`      - Processed citations: ${status.processedCitations}`)
    console.log(`      - Saved citations: ${status.savedCitations}`)
    console.log(`      - Average priority score: ${status.averagePriorityScore?.toFixed(1) || 'N/A'}\n`)

    // Test progress endpoint
    console.log('2. Testing getWikipediaProcessingProgress()...')
    const progress = await getWikipediaProcessingProgress(patch.id)
    console.log('   ✅ Progress retrieved:')
    console.log(`      - Pages progress: ${progress.pagesProgress}%`)
    console.log(`      - Citations progress: ${progress.citationsProgress}%`)
    console.log(`      - Overall progress: ${progress.overallProgress}%\n`)

    // Test top citations endpoint
    console.log('3. Testing getTopPriorityCitations()...')
    const topCitations = await getTopPriorityCitations(patch.id, 5)
    console.log(`   ✅ Top ${topCitations.length} citations retrieved:`)
    topCitations.forEach((citation, i) => {
      console.log(`      ${i + 1}. ${citation.title || citation.url.substring(0, 50)}`)
      console.log(`         Priority: ${citation.priorityScore?.toFixed(1) || 'N/A'}, Status: ${citation.status}`)
    })

    console.log('\n✅ All API functions working correctly!')
    console.log(`\n📊 Summary for ${patch.handle}:`)
    console.log(`   - ${status.totalPages} Wikipedia pages monitored`)
    console.log(`   - ${status.totalCitations} citations found`)
    console.log(`   - ${status.processedCitations}/${status.totalCitations} processed (${progress.citationsProgress}%)`)
    console.log(`   - ${status.savedCitations} citations saved to content/memory`)

    if (status.totalPages === 0) {
      console.log('\n⚠️  No Wikipedia pages found. This could mean:')
      console.log('   1. Patch was created before Wikipedia monitoring was added')
      console.log('   2. Wikipedia initialization failed')
      console.log('   3. No Wikipedia pages matched the search terms')
      console.log('\n   Try creating a new patch to trigger initialization.')
    }

    process.exit(0)

  } catch (error: any) {
    console.error('❌ Error testing API:', error.message)
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      console.error('\n⚠️  Database tables may not exist!')
      console.error('   Run: npx tsx scripts/verify-wikipedia-tables.ts')
    }
    console.error(error)
    process.exit(1)
  }
}

const patchHandle = process.argv[2]
testAPI(patchHandle).catch(console.error)

