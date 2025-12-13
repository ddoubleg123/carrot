/**
 * Reprocess ALL Denied Citations
 * 
 * Finds ALL citations that were denied and resets them for reprocessing
 * This is needed because the initial processing may have been too strict
 * 
 * Usage:
 *   ts-node scripts/reprocess-all-denied-citations.ts --patch=israel --min-score=0
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

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

async function reprocessAllDeniedCitations(
  patchHandle: string,
  minScore: number = 0,
  limit?: number,
  dryRun: boolean = false
) {
  console.log(`\n🔄 Reprocessing ALL denied citations (score >= ${minScore})\n`)

  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch not found: ${patchHandle}`)
    process.exit(1)
  }

  // Find ALL denied citations (with optional min score)
  const where: any = {
    monitoring: { patchId: patch.id },
    relevanceDecision: 'denied',
    savedContentId: null
  }

  if (minScore > 0) {
    where.aiPriorityScore = { gte: minScore }
  }

  const deniedCitations = await prisma.wikipediaCitation.findMany({
    where,
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      aiPriorityScore: true,
      contentText: true,
      scanStatus: true
    },
    orderBy: { aiPriorityScore: 'desc' },
    take: limit || 10000
  })

  console.log(`📊 Found ${deniedCitations.length} denied citations\n`)

  if (deniedCitations.length === 0) {
    console.log('✅ No denied citations to reprocess\n')
    return
  }

  // Show breakdown by score ranges
  const scoreRanges = {
    '90-100': deniedCitations.filter(c => (c.aiPriorityScore || 0) >= 90).length,
    '80-89': deniedCitations.filter(c => (c.aiPriorityScore || 0) >= 80 && (c.aiPriorityScore || 0) < 90).length,
    '70-79': deniedCitations.filter(c => (c.aiPriorityScore || 0) >= 70 && (c.aiPriorityScore || 0) < 80).length,
    '60-69': deniedCitations.filter(c => (c.aiPriorityScore || 0) >= 60 && (c.aiPriorityScore || 0) < 70).length,
    '50-59': deniedCitations.filter(c => (c.aiPriorityScore || 0) >= 50 && (c.aiPriorityScore || 0) < 60).length,
    '0-49': deniedCitations.filter(c => (c.aiPriorityScore || 0) < 50).length,
    'null': deniedCitations.filter(c => !c.aiPriorityScore).length
  }

  console.log('📈 Score Breakdown:')
  for (const [range, count] of Object.entries(scoreRanges)) {
    if (count > 0) {
      console.log(`   ${range}: ${count}`)
    }
  }
  console.log()

  if (dryRun) {
    console.log('💡 DRY RUN - would reset these citations:\n')
    for (const citation of deniedCitations.slice(0, 20)) {
      console.log(`   ${citation.citationTitle || citation.citationUrl.substring(0, 60)}... (score: ${citation.aiPriorityScore || 'N/A'})`)
    }
    if (deniedCitations.length > 20) {
      console.log(`   ... and ${deniedCitations.length - 20} more`)
    }
    console.log()
    return
  }

  // Reset these citations for reprocessing
  const result = await prisma.wikipediaCitation.updateMany({
    where: {
      id: { in: deniedCitations.map(c => c.id) }
    },
    data: {
      scanStatus: 'not_scanned',
      relevanceDecision: null,
      savedContentId: null
    }
  })

  console.log(`✅ Reset ${result.count} citations for reprocessing\n`)
  console.log('💡 Now run: ts-node scripts/process-all-citations.ts --patch=' + patchHandle)
  console.log()
}

async function main() {
  try {
    const args = await parseArgs()
    const patchHandle = args.patch || 'israel'
    const minScore = args.minScore || 0
    const limit = args.limit
    
    await reprocessAllDeniedCitations(patchHandle, minScore, limit, args.dryRun || false)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

