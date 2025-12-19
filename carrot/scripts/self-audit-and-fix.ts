#!/usr/bin/env tsx
/**
 * Self-Audit and Auto-Fix Script
 * Automatically detects and fixes common issues:
 * - Untitled DiscoveredContent items
 * - AgentMemory entries missing discovery fields
 * - Stuck feed queue items
 * - Missing citation heroes
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface AuditResults {
  untitledFixed: number
  agentMemoryFixed: number
  stuckQueueItemsReset: number
  errors: string[]
}

async function selfAuditAndFix(patchHandle?: string): Promise<AuditResults> {
  const results: AuditResults = {
    untitledFixed: 0,
    agentMemoryFixed: 0,
    stuckQueueItemsReset: 0,
    errors: []
  }

  console.log('🔍 Starting self-audit and auto-fix...\n')

  try {
    // Get patches to audit
    const patches = patchHandle
      ? [await prisma.patch.findUnique({ where: { handle: patchHandle }, select: { id: true, handle: true } })]
      : await prisma.patch.findMany({ select: { id: true, handle: true } })

    const validPatches = patches.filter(Boolean) as Array<{ id: string; handle: string }>

    for (const patch of validPatches) {
      console.log(`\n📋 Auditing patch: ${patch.handle} (${patch.id})\n`)

      // 1. Fix Untitled DiscoveredContent items
      try {
        const untitledItems = await prisma.discoveredContent.findMany({
          where: {
            patchId: patch.id,
            OR: [
              { title: 'Untitled' },
              { title: 'Untitled Content' }
            ]
          },
          take: 50 // Limit to prevent long runs
        })

        for (const item of untitledItems) {
          // Try to find citation
          const citation = await prisma.wikipediaCitation.findFirst({
            where: {
              monitoring: { patchId: patch.id },
              OR: [
                { citationUrl: item.sourceUrl },
                { citationUrl: item.canonicalUrl }
              ],
              relevanceDecision: 'saved'
            },
            select: { citationTitle: true }
          })

          if (citation?.citationTitle && citation.citationTitle !== 'Untitled') {
            await prisma.discoveredContent.update({
              where: { id: item.id },
              data: { title: citation.citationTitle }
            })
            results.untitledFixed++
            console.log(`  ✅ Fixed title: "${citation.citationTitle}"`)
          } else {
            // Try URL extraction
            try {
              const url = new URL(item.sourceUrl || item.canonicalUrl || '')
              const pathParts = url.pathname.split('/').filter(p => p.length > 0)
              const lastPart = pathParts[pathParts.length - 1] || url.hostname.replace('www.', '')
              const decodedTitle = decodeURIComponent(lastPart)
                .replace(/[-_]/g, ' ')
                .replace(/\.[^.]+$/, '')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
                .substring(0, 100)

              if (decodedTitle && decodedTitle.length > 5) {
                await prisma.discoveredContent.update({
                  where: { id: item.id },
                  data: { title: decodedTitle }
                })
                results.untitledFixed++
                console.log(`  ✅ Fixed title from URL: "${decodedTitle}"`)
              }
            } catch (e) {
              // Skip if URL parsing fails
            }
          }
        }
      } catch (error) {
        results.errors.push(`Untitled fix error for ${patch.handle}: ${error}`)
      }

      // 2. Fix AgentMemory entries missing discovery fields
      try {
        const memories = await prisma.agentMemory.findMany({
          where: {
            OR: [
              { patchId: null },
              { discoveredContentId: null }
            ],
            sourceType: 'discovery',
            sourceUrl: { not: null }
          },
          take: 100 // Limit to prevent long runs
        })

        for (const memory of memories) {
          if (!memory.sourceUrl) continue

          // Try to find matching DiscoveredContent
          const discoveredContent = await prisma.discoveredContent.findFirst({
            where: {
              OR: [
                { sourceUrl: memory.sourceUrl },
                { canonicalUrl: memory.sourceUrl }
              ],
              patchId: patch.id
            },
            select: { id: true }
          })

          if (discoveredContent) {
            await prisma.agentMemory.update({
              where: { id: memory.id },
              data: {
                patchId: patch.id,
                discoveredContentId: discoveredContent.id
              }
            })
            results.agentMemoryFixed++
            console.log(`  ✅ Linked AgentMemory to DiscoveredContent`)
          }
        }
      } catch (error) {
        results.errors.push(`AgentMemory fix error for ${patch.handle}: ${error}`)
      }

      // 3. Reset stuck feed queue items (stuck in PROCESSING for > 1 hour)
      try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        const stuckItems = await (prisma as any).agentMemoryFeedQueue.findMany({
          where: {
            status: 'PROCESSING',
            pickedAt: { lt: oneHourAgo }
          },
          take: 50
        })

        for (const item of stuckItems) {
          await (prisma as any).agentMemoryFeedQueue.update({
            where: { id: item.id },
            data: {
              status: 'PENDING',
              pickedAt: null,
              attempts: { increment: 1 }
            }
          })
          results.stuckQueueItemsReset++
          console.log(`  ✅ Reset stuck queue item: ${item.id}`)
        }
      } catch (error) {
        results.errors.push(`Queue reset error for ${patch.handle}: ${error}`)
      }
    }

    console.log('\n✅ Self-audit complete!\n')
    console.log('📊 Results:')
    console.log(`   Untitled items fixed: ${results.untitledFixed}`)
    console.log(`   AgentMemory entries fixed: ${results.agentMemoryFixed}`)
    console.log(`   Stuck queue items reset: ${results.stuckQueueItemsReset}`)
    if (results.errors.length > 0) {
      console.log(`   Errors: ${results.errors.length}`)
      results.errors.forEach(err => console.log(`     - ${err}`))
    }

    return results
  } catch (error) {
    console.error('❌ Self-audit failed:', error)
    results.errors.push(`Fatal error: ${error}`)
    return results
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2)
  const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1]

  selfAuditAndFix(patchHandle)
    .then((results) => {
      process.exit(results.errors.length > 0 ? 1 : 0)
    })
    .catch((error) => {
      console.error('Error:', error)
      process.exit(1)
    })
}

export { selfAuditAndFix }

