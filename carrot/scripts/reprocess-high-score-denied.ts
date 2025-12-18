#!/usr/bin/env tsx
/**
 * Reprocess High-Score Denied Citations
 * 
 * Resets and reprocesses citations that have high AI scores (>=70) but were denied.
 * These should be saved according to the relevance logic.
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { processNextCitation } from '../src/lib/discovery/wikipediaProcessor'

const prisma = new PrismaClient()

async function reprocessHighScoreDenied(patchHandle: string, options: {
  minScore?: number
  limit?: number
  dryRun?: boolean
} = {}) {
  const { minScore = 70, limit = 100, dryRun = false } = options

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true, handle: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`🔄 Reprocessing High-Score Denied Citations for: ${patch.title}\n`)
  console.log(`   Min Score: ${minScore}`)
  console.log(`   Limit: ${limit}`)
  console.log(`   Dry Run: ${dryRun}\n`)

  // Find denied citations with high scores
  const highScoreDenied = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'denied',
      aiPriorityScore: { gte: minScore },
      citationUrl: {
        startsWith: 'http'
      },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ]
    },
    select: {
      id: true,
      citationUrl: true,
      aiPriorityScore: true,
      contentText: true
    },
    orderBy: {
      aiPriorityScore: 'desc'
    },
    take: limit
  })

  console.log(`Found ${highScoreDenied.length} high-score denied citations\n`)

  if (highScoreDenied.length === 0) {
    console.log('✅ No high-score denied citations to reprocess')
    await prisma.$disconnect()
    return
  }

  if (dryRun) {
    console.log('🔍 DRY RUN - Would reprocess:\n')
    highScoreDenied.forEach((c, i) => {
      console.log(`${i + 1}. Score: ${c.aiPriorityScore}, Content: ${c.contentText?.length || 0} chars`)
      console.log(`   ${c.citationUrl.substring(0, 80)}...\n`)
    })
    await prisma.$disconnect()
    return
  }

  // Reset them for reprocessing
  console.log('Resetting citations for reprocessing...\n')
  
  const resetResult = await prisma.wikipediaCitation.updateMany({
    where: {
      id: { in: highScoreDenied.map(c => c.id) }
    },
    data: {
      relevanceDecision: null,
      scanStatus: 'not_scanned',
      savedContentId: null,
      savedMemoryId: null,
      errorMessage: null
    }
  })

  console.log(`✅ Reset ${resetResult.count} citations\n`)

  // Now process them
  console.log('Processing citations...\n')

  let savedCount = 0
  let deniedCount = 0
  let errorCount = 0

  const saveAsContent = async (
    url: string,
    title: string,
    content: string,
    relevanceData?: { aiScore?: number; relevanceScore?: number; isRelevant?: boolean }
  ): Promise<string | null> => {
    savedCount++
    const saved = await prisma.discoveredContent.create({
      data: {
        patchId: patch.id,
        title,
        summary: content.substring(0, 500),
        sourceUrl: url,
        domain: new URL(url).hostname,
        metadata: {
          source: 'wikipedia-citation',
          aiScore: relevanceData?.aiScore,
          relevanceScore: relevanceData?.relevanceScore,
          isRelevant: relevanceData?.isRelevant
        }
      }
    })
    return saved.id
  }

  const saveAsMemory = async (
    url: string,
    title: string,
    content: string,
    patchHandle: string,
    wikipediaPageTitle?: string
  ): Promise<string | null> => {
    return null // Don't save to agent memory in this script
  }

  for (let i = 0; i < highScoreDenied.length; i++) {
    const citation = highScoreDenied[i]
    try {
      process.stdout.write(`\rProcessing ${i + 1}/${highScoreDenied.length}...`)
      
      const result = await processNextCitation(patch.id, {
        patchName: patch.title,
        patchHandle: patch.handle,
        saveAsContent,
        saveAsMemory
      })

      if (result.saved) {
        savedCount++
      } else {
        deniedCount++
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error: any) {
      errorCount++
      console.error(`\n❌ Error processing ${citation.citationUrl}: ${error.message}`)
    }
  }

  console.log(`\n\n📊 Results:`)
  console.log(`   Processed: ${highScoreDenied.length}`)
  console.log(`   Saved: ${savedCount}`)
  console.log(`   Denied: ${deniedCount}`)
  console.log(`   Errors: ${errorCount}`)
  console.log(`   New Save Rate: ${(savedCount / highScoreDenied.length * 100).toFixed(1)}%`)

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'
const minScore = parseInt(args.find(arg => arg.startsWith('--min-score='))?.split('=')[1] || '70')
const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '100')
const dryRun = args.includes('--dry-run')

reprocessHighScoreDenied(patchHandle, { minScore, limit, dryRun })
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

