/**
 * Process All Unprocessed Citations
 * 
 * Processes all citations that haven't been scanned yet
 * Runs in batches to avoid overwhelming the system
 * 
 * Usage:
 *   ts-node scripts/process-all-citations.ts --patch=israel --batch-size=10 --limit=100
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { processNextCitation } from '../src/lib/discovery/wikipediaProcessor'
import { getNextCitationToProcess } from '../src/lib/discovery/wikipediaCitation'

interface Args {
  patch?: string
  batchSize?: number
  limit?: number
  dryRun?: boolean
}

async function parseArgs(): Promise<Args> {
  const args: Args = {}
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg.startsWith('--patch=')) {
      args.patch = arg.split('=')[1]
    } else if (arg.startsWith('--batch-size=')) {
      args.batchSize = parseInt(arg.split('=')[1])
    } else if (arg.startsWith('--limit=')) {
      args.limit = parseInt(arg.split('=')[1])
    } else if (arg === '--dry-run') {
      args.dryRun = true
    }
  }
  
  return args
}

async function processAllCitations(patchHandle: string, batchSize: number = 10, limit?: number, dryRun: boolean = false) {
  console.log(`\n🚀 Processing all unprocessed citations for patch: ${patchHandle}\n`)
  console.log(`   Batch size: ${batchSize}`)
  console.log(`   Limit: ${limit || 'unlimited'}`)
  console.log(`   Dry run: ${dryRun}\n`)

  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch not found: ${patchHandle}`)
    process.exit(1)
  }

  console.log(`📋 Patch: ${patch.title} (${patch.id})\n`)

  // Get stats
  const totalCitations = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id }
    }
  })

  const unprocessedCount = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: { in: ['not_scanned', 'scanning'] },
      relevanceDecision: null
    }
  })

  console.log(`📊 Citation Stats:`)
  console.log(`   Total citations: ${totalCitations}`)
  console.log(`   Unprocessed: ${unprocessedCount}`)
  console.log()

  if (dryRun) {
    console.log('💡 DRY RUN - would process citations\n')
    return
  }

  let processed = 0
  let saved = 0
  let denied = 0
  let failed = 0
  const startTime = Date.now()

  console.log('🔄 Processing citations...\n')

  while (true) {
    // Check limit
    if (limit && processed >= limit) {
      console.log(`\n⏸️  Reached limit of ${limit} citations`)
      break
    }

    // Get next citation to process
    const nextCitation = await getNextCitationToProcess(patch.id)
    
    if (!nextCitation) {
      console.log('\n✅ No more citations to process')
      break
    }

    try {
      console.log(`[${processed + 1}] Processing: ${nextCitation.citationTitle || nextCitation.citationUrl.substring(0, 60)}...`)
      
      const result = await processNextCitation(patch.id, patchHandle, {
        saveAsContent: async (url, title, content, metadata) => {
          // Use the same save logic as the discovery orchestrator
          const { canonicalize } = await import('../src/lib/discovery/canonicalization')
          const canonicalResult = await canonicalize(url)
          
          // Check for duplicates
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
            console.log(`   ⏭️  Duplicate, using existing: ${existing.id}`)
            return existing.id
          }

          // Save to DiscoveredContent
          const saved = await prisma.discoveredContent.create({
            data: {
              patchId: patch.id,
              title: title || 'Untitled',
              summary: content.substring(0, 240),
              sourceUrl: url,
              canonicalUrl: canonicalResult.canonicalUrl,
              domain: canonicalResult.finalDomain,
              category: 'article',
              relevanceScore: metadata?.aiScore || 0.5,
              qualityScore: 0,
              textContent: content,
              facts: [],
              provenance: [url],
              metadata: {
                source: 'wikipedia-citation',
                aiScore: metadata?.aiScore,
                isRelevant: metadata?.isRelevant
              }
            }
          })

          console.log(`   ✅ Saved: ${saved.id}`)
          return saved.id
        },
        saveAsMemory: async (url, title, content, patchHandle, wikipediaTitle) => {
          // Feed to agent memory
          const { AgentRegistry } = await import('../src/lib/ai-agents/agentRegistry')
          const { FeedService, FeedItem } = await import('../src/lib/ai-agents/feedService')
          
          const agents = await AgentRegistry.getAgentsByPatches([patchHandle])
          if (agents.length === 0) {
            return null
          }

          const agent = agents[0]
          const feedItem: FeedItem = {
            content: `${title}\n\n${content}`,
            sourceType: 'wikipedia_citation',
            sourceUrl: url,
            sourceTitle: title,
            tags: ['wikipedia', 'citation', patchHandle],
            topicId: patch.id
          }

          try {
            const result = await FeedService.feedAgent(agent.id, feedItem, 'wikipedia-citation-processor')
            return result.memoryIds[0] || null
          } catch (error) {
            console.warn(`   ⚠️  Failed to save to agent memory:`, error)
            return null
          }
        }
      })

      processed++
      if (result.saved) {
        saved++
      } else {
        denied++
      }

      // Log progress every batch
      if (processed % batchSize === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        const rate = (processed / (elapsed as any)).toFixed(1)
        console.log(`\n📊 Progress: ${processed} processed (${saved} saved, ${denied} denied, ${failed} failed) in ${elapsed}s (${rate}/s)`)
        console.log(`   Remaining: ~${unprocessedCount - processed}\n`)
      }

      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error) {
      failed++
      console.error(`   ❌ Error processing citation:`, error)
      // Continue with next citation
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n📊 Final Summary:')
  console.log(`   ✅ Processed: ${processed}`)
  console.log(`   💾 Saved: ${saved}`)
  console.log(`   ❌ Denied: ${denied}`)
  console.log(`   ⚠️  Failed: ${failed}`)
  console.log(`   ⏱️  Time: ${elapsed}s`)
  console.log(`   📈 Rate: ${(processed / (elapsed as any)).toFixed(1)}/s`)
  console.log()
}

async function main() {
  try {
    const args = await parseArgs()
    const patchHandle = args.patch || 'israel'
    const batchSize = args.batchSize || 10
    const limit = args.limit
    
    await processAllCitations(patchHandle, batchSize, limit, args.dryRun || false)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

