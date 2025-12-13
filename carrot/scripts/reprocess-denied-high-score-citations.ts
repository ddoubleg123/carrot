/**
 * Reprocess Denied Citations with High AI Scores
 * 
 * Finds citations that were denied but have high AI scores (>= 70)
 * and reprocesses them to save to DiscoveredContent
 * 
 * Usage:
 *   ts-node scripts/reprocess-denied-high-score-citations.ts --patch=israel --min-score=70
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { processNextCitation } from '../src/lib/discovery/wikipediaProcessor'

interface Args {
  patch?: string
  minScore?: number
  limit?: number
  dryRun?: boolean
}

async function parseArgs(): Promise<Args> {
  const args: Args = {}
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg.startsWith('--patch=')) {
      args.patch = arg.split('=')[1]
    } else if (arg.startsWith('--min-score=')) {
      args.minScore = parseInt(arg.split('=')[1])
    } else if (arg.startsWith('--limit=')) {
      args.limit = parseInt(arg.split('=')[1])
    } else if (arg === '--dry-run') {
      args.dryRun = true
    }
  }
  
  return args
}

async function reprocessDeniedHighScoreCitations(
  patchHandle: string,
  minScore: number = 70,
  limit?: number,
  dryRun: boolean = false
) {
  console.log(`\n🔄 Reprocessing denied citations with AI score >= ${minScore}\n`)

  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch not found: ${patchHandle}`)
    process.exit(1)
  }

  // Find denied citations with high scores
  const deniedHighScore = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'denied',
      aiPriorityScore: { gte: minScore },
      savedContentId: null,
      scanStatus: 'scanned',
      contentText: { not: null }
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      aiPriorityScore: true,
      contentText: true
    },
    orderBy: { aiPriorityScore: 'desc' },
    take: limit || 1000
  })

  console.log(`📊 Found ${deniedHighScore.length} denied citations with score >= ${minScore}\n`)

  if (dryRun) {
    console.log('💡 DRY RUN - would reprocess these citations:\n')
    for (const citation of deniedHighScore.slice(0, 10)) {
      console.log(`   ${citation.citationTitle || citation.citationUrl.substring(0, 60)}... (score: ${citation.aiPriorityScore})`)
    }
    if (deniedHighScore.length > 10) {
      console.log(`   ... and ${deniedHighScore.length - 10} more`)
    }
    console.log()
    return
  }

  // Reset these citations for reprocessing
  await prisma.wikipediaCitation.updateMany({
    where: {
      id: { in: deniedHighScore.map(c => c.id) }
    },
    data: {
      scanStatus: 'not_scanned',
      relevanceDecision: null,
      savedContentId: null
    }
  })

  console.log(`✅ Reset ${deniedHighScore.length} citations for reprocessing\n`)
  console.log('💡 Now run: ts-node scripts/process-all-citations.ts --patch=' + patchHandle)
  console.log()
}

async function main() {
  try {
    const args = await parseArgs()
    const patchHandle = args.patch || 'israel'
    const minScore = args.minScore || 70
    const limit = args.limit
    
    await reprocessDeniedHighScoreCitations(patchHandle, minScore, limit, args.dryRun || false)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

