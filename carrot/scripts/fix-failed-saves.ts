/**
 * Fix Failed Saves
 * 
 * Finds citations marked as "saved" but missing savedContentId
 * Attempts to save them again to DiscoveredContent
 * 
 * Usage:
 *   ts-node scripts/fix-failed-saves.ts --patch=israel
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { canonicalize } from '../src/lib/discovery/canonicalization'

interface Args {
  patch?: string
  limit?: number
  dryRun?: boolean
}

async function parseArgs(): Promise<Args> {
  const args: Args = {}
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg.startsWith('--patch=')) {
      args.patch = arg.split('=')[1]
    } else if (arg.startsWith('--limit=')) {
      args.limit = parseInt(arg.split('=')[1])
    } else if (arg === '--dry-run') {
      args.dryRun = true
    }
  }
  
  return args
}

async function fixFailedSaves(patchHandle: string, limit?: number, dryRun: boolean = false) {
  console.log(`\n🔧 Fixing failed saves for patch: ${patchHandle}\n`)

  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch not found: ${patchHandle}`)
    process.exit(1)
  }

  // Find citations marked saved but missing savedContentId
  const failedSaves = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved',
      savedContentId: null,
      contentText: { not: null }
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      contentText: true,
      aiPriorityScore: true
    },
    take: limit || 1000
  })

  console.log(`📊 Found ${failedSaves.length} citations with failed saves\n`)

  if (failedSaves.length === 0) {
    console.log('✅ No failed saves to fix\n')
    return
  }

  if (dryRun) {
    console.log('💡 DRY RUN - would fix these citations:\n')
    for (const citation of failedSaves.slice(0, 10)) {
      console.log(`   ${citation.citationTitle || citation.citationUrl.substring(0, 60)}...`)
    }
    if (failedSaves.length > 10) {
      console.log(`   ... and ${failedSaves.length - 10} more`)
    }
    console.log()
    return
  }

  let fixed = 0
  let failed = 0
  let skipped = 0

  console.log('🔄 Fixing failed saves...\n')

  for (const citation of failedSaves) {
    try {
      // Canonicalize URL
      const canonicalResult = await canonicalize(citation.citationUrl)
      
      // Check for existing DiscoveredContent
      const existing = await prisma.discoveredContent.findFirst({
        where: {
          patchId: patch.id,
          OR: [
            { canonicalUrl: canonicalResult.canonicalUrl },
            { sourceUrl: canonicalResult.canonicalUrl }
          ]
        },
        select: { id: true }
      })

      if (existing) {
        // Update citation with existing savedContentId
        await prisma.wikipediaCitation.update({
          where: { id: citation.id },
          data: { savedContentId: existing.id }
        })
        fixed++
        console.log(`   ✅ Fixed: ${citation.citationTitle || citation.citationUrl.substring(0, 50)}... (existing: ${existing.id})`)
        continue
      }

      // Try to save again
      if (!citation.contentText || citation.contentText.length < 100) {
        skipped++
        console.log(`   ⏭️  Skipped: ${citation.citationTitle || citation.citationUrl.substring(0, 50)}... (insufficient content)`)
        continue
      }

      const saved = await prisma.discoveredContent.create({
        data: {
          patchId: patch.id,
          title: citation.citationTitle || 'Untitled',
          summary: citation.contentText.substring(0, 240),
          sourceUrl: citation.citationUrl,
          canonicalUrl: canonicalResult.canonicalUrl,
          domain: canonicalResult.finalDomain,
          category: 'article',
          relevanceScore: citation.aiPriorityScore || 0.5,
          qualityScore: 0,
          textContent: citation.contentText,
          facts: [],
          provenance: [citation.citationUrl],
          metadata: {
            source: 'wikipedia-citation',
            aiScore: citation.aiPriorityScore,
            fixed: true
          }
        }
      })

      // Update citation with savedContentId
      await prisma.wikipediaCitation.update({
        where: { id: citation.id },
        data: { savedContentId: saved.id }
      })

      fixed++
      console.log(`   ✅ Fixed: ${citation.citationTitle || citation.citationUrl.substring(0, 50)}... (saved: ${saved.id})`)

    } catch (error) {
      failed++
      console.error(`   ❌ Failed: ${citation.citationTitle || citation.citationUrl.substring(0, 50)}... - ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log('\n📊 Summary:')
  console.log(`   ✅ Fixed: ${fixed}`)
  console.log(`   ⏭️  Skipped: ${skipped}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   📦 Total: ${failedSaves.length}\n`)
}

async function main() {
  try {
    const args = await parseArgs()
    const patchHandle = args.patch || 'israel'
    const limit = args.limit
    
    await fixFailedSaves(patchHandle, limit, args.dryRun || false)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

