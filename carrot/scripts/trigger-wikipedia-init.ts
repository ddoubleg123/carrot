/**
 * Manually trigger Wikipedia monitoring initialization for an existing patch
 * Run with: npx tsx scripts/trigger-wikipedia-init.ts [patch-handle]
 */

import { initializeWikipediaMonitoring } from '../src/lib/discovery/wikipediaMonitoring'
import { prisma } from '../src/lib/prisma'

async function triggerInit(patchHandle?: string) {
  console.log('Triggering Wikipedia monitoring initialization...\n')

  try {
    // Find the patch
    let patch
    if (patchHandle) {
      patch = await prisma.patch.findUnique({
        where: { handle: patchHandle },
        select: { id: true, handle: true, title: true, entity: true, tags: true }
      })
    } else {
      patch = await prisma.patch.findFirst({
        select: { id: true, handle: true, title: true, entity: true, tags: true }
      })
    }

    if (!patch) {
      console.error('❌ No patch found')
      console.error('   Specify a handle: npx tsx scripts/trigger-wikipedia-init.ts chicago-bulls')
      process.exit(1)
    }

    console.log(`Initializing for patch: ${patch.handle} (${patch.title})\n`)

    // Extract entity and tags
    const entity = patch.entity as any
    const pageName = entity?.name || patch.title
    const searchTerms = entity?.aliases || patch.tags || []

    console.log(`Search terms: ${pageName} + ${searchTerms.join(', ')}\n`)

    // Initialize
    console.log('Starting Wikipedia search...')
    const result = await initializeWikipediaMonitoring(
      patch.id,
      pageName,
      Array.isArray(searchTerms) ? searchTerms : []
    )

    console.log('\n✅ Initialization complete!')
    console.log(`   - Pages found: ${result.pagesFound}`)
    console.log(`   - Pages stored: ${result.pagesStored}`)

    if (result.pagesFound === 0) {
      console.log('\n⚠️  No Wikipedia pages found. This could mean:')
      console.log('   - Search terms didn\'t match any Wikipedia pages')
      console.log('   - Wikipedia API is unavailable')
      console.log('   - Rate limiting is blocking requests')
    } else if (result.pagesStored === 0) {
      console.log('\n⚠️  Pages found but none stored. This could mean:')
      console.log('   - All pages already exist in database')
      console.log('   - Database write failed')
    } else {
      console.log('\n✅ Success! Wikipedia pages are now being monitored.')
      console.log('   Run discovery to start processing citations.')
    }

    process.exit(0)

  } catch (error: any) {
    console.error('❌ Error initializing:', error.message)
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      console.error('\n⚠️  Database tables may not exist!')
      console.error('   Run: npx tsx scripts/verify-wikipedia-tables.ts')
    }
    console.error(error)
    process.exit(1)
  }
}

const patchHandle = process.argv[2]
triggerInit(patchHandle).catch(console.error)

