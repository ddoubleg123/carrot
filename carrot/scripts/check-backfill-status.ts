/**
 * Check backfill status for heroes and DeepSeek enrichment
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkBackfillStatus() {
  try {
    const patchHandle = process.argv[2] || 'israel'
    
    console.log(`\n🔍 Checking Backfill Status for Patch: ${patchHandle}\n`)

    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle },
      select: { id: true, title: true, handle: true }
    })

    if (!patch) {
      console.error(`❌ Patch "${patchHandle}" not found`)
      return
    }

    console.log(`✅ Found patch: ${patch.title} (${patch.handle})\n`)

    // Get all content
    const content = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        title: true,
        summary: true,
        facts: true,
        metadata: true,
        hero: true
      }
    })

    console.log(`📊 Total Content Items: ${content.length}\n`)

    // Check hero images
    const withWikimediaHero = content.filter(c => {
      const h = c.hero as any
      return h?.url && (h.url.includes('wikimedia.org') || h.url.includes('upload.wikimedia.org'))
    })

    const withPlaceholderHero = content.filter(c => {
      const h = c.hero as any
      return h?.url && (h.url.includes('placeholder') || h.url.includes('favicon'))
    })

    const withNoHero = content.filter(c => {
      const h = c.hero as any
      return !h || !h.url
    })

    console.log(`🖼️  Hero Images:`)
    console.log(`   ✅ With Wikimedia: ${withWikimediaHero.length}`)
    console.log(`   ⚠️  With Placeholder/Favicon: ${withPlaceholderHero.length}`)
    console.log(`   ❌ No Hero: ${withNoHero.length}\n`)

    // Check DeepSeek enrichment
    const withDeepSeekEnrichment = content.filter(c => {
      const m = c.metadata as any
      return m?.aiEnriched === true || m?.enrichedAt
    })

    const withGoodSummary = content.filter(c => 
      c.summary && c.summary.length >= 120
    )

    const withGoodFacts = content.filter(c => {
      const facts = Array.isArray(c.facts) ? c.facts : []
      return facts.length >= 3
    })

    console.log(`🤖 DeepSeek Enrichment:`)
    console.log(`   ✅ AI Enriched (metadata flag): ${withDeepSeekEnrichment.length}`)
    console.log(`   ✅ Good Summary (>=120 chars): ${withGoodSummary.length}`)
    console.log(`   ✅ Good Facts (>=3 facts): ${withGoodFacts.length}\n`)

    // Check what needs backfill
    const needsHeroBackfill = withPlaceholderHero.length + withNoHero.length
    const needsDeepSeekBackfill = content.length - withDeepSeekEnrichment.length

    console.log(`📋 Backfill Status:`)
    console.log(`   🖼️  Heroes needing backfill: ${needsHeroBackfill}`)
    console.log(`   🤖 Content needing DeepSeek enrichment: ${needsDeepSeekBackfill}\n`)

    if (needsHeroBackfill > 0) {
      console.log(`   💡 Run: npx tsx scripts/backfill-wikimedia-heroes.ts ${patchHandle}`)
    }

    if (needsDeepSeekBackfill > 0) {
      console.log(`   💡 Note: DeepSeek enrichment happens on-demand when content is viewed`)
      console.log(`   💡 Grammar cleanup runs automatically on all content when viewed\n`)
    }

  } catch (error: any) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkBackfillStatus()
  .then(() => {
    console.log('\n✨ Check complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error)
    process.exit(1)
  })

