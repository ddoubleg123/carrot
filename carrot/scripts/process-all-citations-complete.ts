/**
 * Process ALL Citations - Complete Run
 * 
 * This script processes ALL citations from scratch, including:
 * - Resetting failed citations
 * - Processing all unprocessed citations
 * - Enhanced content extraction
 * - Agent feeding
 * - Hero generation
 * 
 * Usage:
 *   npx tsx scripts/process-all-citations-complete.ts --patch=israel --batch-size=20 --pause=2000
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { getNextCitationToProcess } from '../src/lib/discovery/wikipediaCitation'
import { processNextCitation } from '../src/lib/discovery/wikipediaProcessor'

interface Args {
  patch?: string
  batchSize?: number
  pauseBetweenBatches?: number
  resetFailed?: boolean
}

async function parseArgs(): Promise<Args> {
  const args: Args = {}
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg.startsWith('--patch=')) {
      args.patch = arg.split('=')[1]
    } else if (arg.startsWith('--batch-size=')) {
      args.batchSize = parseInt(arg.split('=')[1])
    } else if (arg.startsWith('--pause=')) {
      args.pauseBetweenBatches = parseInt(arg.split('=')[1])
    } else if (arg === '--reset-failed') {
      args.resetFailed = true
    }
  }
  
  return args
}

async function resetFailedCitations(patchId: string) {
  console.log('🔄 Resetting failed citations...')
  
  const result = await prisma.wikipediaCitation.updateMany({
    where: {
      monitoring: { patchId },
      verificationStatus: 'failed'
    },
    data: {
      verificationStatus: 'pending',
      scanStatus: 'not_scanned',
      relevanceDecision: null,
      savedContentId: null,
      errorMessage: null,
      lastScannedAt: null
    }
  })
  
  console.log(`   ✅ Reset ${result.count} failed citations`)
}

async function processAllCitations(
  patchHandle: string,
  batchSize: number = 20,
  pauseBetweenBatches: number = 2000,
  resetFailed: boolean = false
) {
  console.log(`\n🚀 Processing ALL citations for: ${patchHandle}\n`)
  console.log(`   Batch size: ${batchSize}`)
  console.log(`   Pause between batches: ${pauseBetweenBatches}ms`)
  console.log(`   Reset failed: ${resetFailed}`)
  console.log()

  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch not found: ${patchHandle}`)
    process.exit(1)
  }

  // Reset failed citations if requested
  if (resetFailed) {
    await resetFailedCitations(patch.id)
    console.log()
  }

  // Get initial stats
  const total = await prisma.wikipediaCitation.count({
    where: { monitoring: { patchId: patch.id } }
  })

  const unprocessed = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      OR: [
        { scanStatus: 'not_scanned' },
        { scanStatus: 'scanning' },
        { 
          scanStatus: 'scanned',
          relevanceDecision: null
        }
      ]
    }
  })

  const saved = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved'
    }
  })

  const denied = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'denied'
    }
  })

  console.log(`📊 Initial Stats:`)
  console.log(`   Total citations: ${total.toLocaleString()}`)
  console.log(`   Already saved: ${saved.toLocaleString()}`)
  console.log(`   Already denied: ${denied.toLocaleString()}`)
  console.log(`   Ready to process: ${unprocessed.toLocaleString()}`)
  console.log()

  let processed = 0
  let savedCount = 0
  let deniedCount = 0
  let failed = 0
  const startTime = Date.now()
  let lastProgressTime = Date.now()

  console.log('🔄 Processing citations...\n')
  console.log('Press Ctrl+C to stop gracefully\n')

  while (true) {
    // Get next citation to process
    const nextCitation = await getNextCitationToProcess(patch.id)
    
    if (!nextCitation) {
      console.log('\n✅ No more citations to process')
      break
    }

    try {
      const citationTitle = nextCitation.citationTitle || nextCitation.citationUrl.substring(0, 60)
      console.log(`[${processed + 1}] Processing: ${citationTitle}...`)
      
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

          // Save to DiscoveredContent with full content
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
              textContent: content, // Store full extracted content
              facts: [],
              provenance: [url],
              metadata: {
                source: 'wikipedia-citation',
                aiScore: metadata?.aiScore,
                isRelevant: metadata?.isRelevant,
                extractionMethod: metadata?.extractionMethod || 'unknown',
                contentLength: content.length
              }
            }
          })

          console.log(`   ✅ Saved: ${saved.id} (${content.length} chars)`)

          // Enqueue for agent feeding (auto-feed pipeline)
          try {
            const { enqueueDiscoveredContent, calculateContentHash } = await import('../src/lib/agent/feedWorker')
            const contentHash = calculateContentHash(title || '', content.substring(0, 240), content)
            await enqueueDiscoveredContent(saved.id, patch.id, contentHash, 0)
            console.log(`   🤖 Enqueued for agent feeding`)
          } catch (error) {
            console.warn(`   ⚠️  Failed to enqueue for agent:`, error)
            // Non-fatal - continue
          }

          // Trigger hero image generation (non-blocking)
          try {
            const { enrichContentId } = await import('../src/lib/enrichment/worker')
            enrichContentId(saved.id).then(() => {
              console.log(`   🎨 Hero image generation triggered`)
            }).catch(err => {
              console.warn(`   ⚠️  Hero generation failed:`, err)
              // Non-fatal - hero can be generated later
            })
          } catch (error) {
            console.warn(`   ⚠️  Failed to trigger hero generation:`, error)
            // Non-fatal - hero can be generated later
          }

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
        savedCount++
      } else {
        deniedCount++
      }

      // Log progress every batch
      if (processed % batchSize === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        const batchTime = ((Date.now() - lastProgressTime) / 1000).toFixed(1)
        const rate = (batchSize / parseFloat(batchTime)).toFixed(1)
        const remaining = await prisma.wikipediaCitation.count({
          where: {
            monitoring: { patchId: patch.id },
            OR: [
              { scanStatus: 'not_scanned' },
              { scanStatus: 'scanning' },
              { 
                scanStatus: 'scanned',
                relevanceDecision: null
              }
            ]
          }
        })
        
        const saveRate = processed > 0 ? ((savedCount / processed) * 100).toFixed(1) : '0.0'
        const estimatedMinutes = remaining > 0 && parseFloat(rate) > 0 
          ? ((remaining / parseFloat(rate)) / 60).toFixed(1) 
          : 'N/A'
        
        console.log(`\n📊 Progress: ${processed} processed (${savedCount} saved, ${deniedCount} denied, ${failed} failed)`)
        console.log(`   Batch time: ${batchTime}s (${rate} citations/s)`)
        console.log(`   Total time: ${elapsed}s`)
        console.log(`   Remaining: ~${remaining.toLocaleString()}`)
        console.log(`   Save rate: ${saveRate}%`)
        console.log(`   Estimated time remaining: ${estimatedMinutes} minutes`)
        console.log()
        
        lastProgressTime = Date.now()
        
        // Pause between batches to avoid overwhelming the system
        if (pauseBetweenBatches > 0) {
          await new Promise(resolve => setTimeout(resolve, pauseBetweenBatches))
        }
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
  const rate = processed > 0 ? (processed / parseFloat(elapsed)).toFixed(1) : '0'
  const saveRate = processed > 0 ? ((savedCount / processed) * 100).toFixed(1) : '0.0'
  
  console.log('\n📊 Final Summary:')
  console.log(`   ✅ Processed: ${processed.toLocaleString()}`)
  console.log(`   💾 Saved: ${savedCount.toLocaleString()}`)
  console.log(`   ❌ Denied: ${deniedCount.toLocaleString()}`)
  console.log(`   ⚠️  Failed: ${failed.toLocaleString()}`)
  console.log(`   ⏱️  Time: ${elapsed}s`)
  console.log(`   📈 Rate: ${rate}/s`)
  console.log(`   💾 Save rate: ${saveRate}%`)
  console.log()
}

async function main() {
  try {
    const args = await parseArgs()
    const patchHandle = args.patch || 'israel'
    const batchSize = args.batchSize || 20
    const pauseBetweenBatches = args.pauseBetweenBatches || 2000
    const resetFailed = args.resetFailed || false
    
    await processAllCitations(patchHandle, batchSize, pauseBetweenBatches, resetFailed)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
