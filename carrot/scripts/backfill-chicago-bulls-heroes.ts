/**
 * One-shot backfill script for chicago-bulls patch
 * Creates heroes for all saved DiscoveredContent items
 */

import { prisma } from '../src/lib/prisma'
import { enrichContentId } from '../src/lib/enrichment/worker'

const PATCH_HANDLE = 'chicago-bulls'
const LIMIT = 1000 // Process all items
const CONCURRENCY = 5

async function backfillChicagoBulls() {
  console.log('\n🎯 Chicago Bulls Hero Backfill')
  console.log('================================\n')

  // Find patch
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${PATCH_HANDLE}" not found`)
    process.exit(1)
  }

  console.log(`✅ Found patch: ${patch.title} (ID: ${patch.id})\n`)

  // Find content without heroes
  const contentWithoutHeroes = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      heroRecord: null
    },
    select: {
      id: true,
      title: true,
      canonicalUrl: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: LIMIT
  })

  console.log(`📊 Found ${contentWithoutHeroes.length} content items without heroes\n`)

  if (contentWithoutHeroes.length === 0) {
    console.log('✅ All content already has heroes!')
    return
  }

  // Process with concurrency
  console.log(`🚀 Processing with concurrency=${CONCURRENCY}...\n`)
  
  let processed = 0
  let created = 0
  let failed = 0

  for (let i = 0; i < contentWithoutHeroes.length; i += CONCURRENCY) {
    const batch = contentWithoutHeroes.slice(i, i + CONCURRENCY)
    
    const results = await Promise.all(
      batch.map(async (content) => {
        try {
          const result = await enrichContentId(content.id)
          return { content, result, ok: result.ok }
        } catch (error: any) {
          return { content, result: null, ok: false, error: error.message }
        }
      })
    )

    for (const { content, result, ok, error } of results) {
      processed++
      if (ok && result?.heroId) {
        created++
        console.log(`✅ [${processed}/${contentWithoutHeroes.length}] Created hero for: ${content.title.substring(0, 50)}`)
      } else if (ok) {
        console.log(`⚠️  [${processed}/${contentWithoutHeroes.length}] Hero exists/updated: ${content.title.substring(0, 50)}`)
      } else {
        failed++
        console.log(`❌ [${processed}/${contentWithoutHeroes.length}] Failed: ${content.title.substring(0, 50)} - ${error || result?.errorMessage || 'Unknown error'}`)
      }
    }

    // Small delay between batches
    if (i + CONCURRENCY < contentWithoutHeroes.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  console.log('\n📈 Summary:')
  console.log(`   Processed: ${processed}`)
  console.log(`   Created: ${created}`)
  console.log(`   Failed: ${failed}`)
  console.log(`   Success rate: ${processed > 0 ? ((created / processed) * 100).toFixed(1) : 0}%\n`)

  // Verify final counts
  const [finalHeroCount, finalContentCount] = await Promise.all([
    prisma.hero.count({
      where: { content: { patchId: patch.id }, status: 'READY' }
    }),
    prisma.discoveredContent.count({
      where: { patchId: patch.id }
    })
  ])

  console.log('📊 Final counts:')
  console.log(`   Total content: ${finalContentCount}`)
  console.log(`   Ready heroes: ${finalHeroCount}`)
  console.log(`   Coverage: ${finalContentCount > 0 ? ((finalHeroCount / finalContentCount) * 100).toFixed(1) : 0}%\n`)

  console.log('✅ Backfill complete!\n')
}

// Run if called directly
if (require.main === module) {
  backfillChicagoBulls()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Backfill failed:', error)
      process.exit(1)
    })
}

export { backfillChicagoBulls }

