/**
 * Review Specific Citations
 * 
 * Fetches and displays detailed information about specific citation IDs
 * 
 * Usage:
 *   ts-node scripts/review-specific-citations.ts --patch=israel
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const citationIds = [
  'cmip9so2u0561ox1t56gue2ye',
  'cmip9sq9d056box1tg3a2rj8b',
  'cmip9uv2f08sfox1tr6n3y2b6',
  'cmip9uv4a08spox1tbiio3vqw',
  'cmipabsa902rtt01tvapjdf45',
  'cmipabscz02s9t01t70l8ew2u',
  'cmiqsxwht000f4s0wlp6xqtw0',
  'cmip9rvw903q50x1tbnb3kxwg',
  'cmip9t4jr057jox1t4oboafd8',
  'cmip9t4o40583ox1t0g9trmg4',
  'cmip9tgfr06fpox1tzv9yjy5r',
  'cmip9u0ho06ijox1tnyrmeh3x',
  'cmip9u0i006ilox1t413xis0z',
  'cmip9uanj086vox1tt6k6iq9m',
  'cmip9uv2108sdox1tonypz24r',
  'cmip9uv5108stox1tof61colr',
  'cmip9uv7108t5ox1t6gbvy6pm',
  'cmip9v2oe09h9ox1toxg6k107',
  'cmipabs9k02rpt01tttosdi4y',
  'cmipabscb02s5t01tg4e5qsp0',
  'cmipac4av04nvt01thdce7ykd',
  'cmipac4ba04nxt01tzwfzzfx4',
  'cmip9tggd06ftox1ta22yr9g3',
  'cmip9u0io06ipox1tpzxdqq3m',
  'cmip9u0jc06itox1tk1byvnq5',
  'cmipabsam02rvt01t81ugwf2t',
  'cmip9pskc00t3ox1t1mt52psv',
  'cmip9u0ic06inox1tt0naig7z'
]

interface Args {
  patch?: string
}

async function parseArgs(): Promise<Args> {
  const args: Args = {}
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (arg.startsWith('--patch=')) {
      args.patch = arg.split('=')[1]
    }
  }
  
  return args
}

async function reviewCitations(patchHandle: string) {
  console.log(`\n🔍 Reviewing ${citationIds.length} specific citations for patch: ${patchHandle}\n`)

  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch not found: ${patchHandle}`)
    process.exit(1)
  }

  // Fetch all citations
  const citations = await prisma.wikipediaCitation.findMany({
    where: { 
      id: { in: citationIds },
      monitoring: { patchId: patch.id }
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      citationContext: true,
      verificationStatus: true,
      scanStatus: true,
      relevanceDecision: true,
      savedContentId: true,
      aiPriorityScore: true,
      contentText: true,
      lastScannedAt: true,
      createdAt: true,
      errorMessage: true,
      monitoring: {
        select: {
          wikipediaTitle: true,
          status: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  console.log(`📊 Found ${citations.length} citations in database\n`)

  // Group by status
  const byStatus = {
    saved: citations.filter(c => c.relevanceDecision === 'saved'),
    denied: citations.filter(c => c.relevanceDecision === 'denied'),
    noDecision: citations.filter(c => !c.relevanceDecision),
    scanned: citations.filter(c => c.scanStatus === 'scanned'),
    notScanned: citations.filter(c => c.scanStatus === 'not_scanned'),
    hasContent: citations.filter(c => c.contentText && c.contentText.length > 0),
    hasSavedContent: citations.filter(c => c.savedContentId)
  }

  console.log('📈 Status Breakdown:')
  console.log(`   Saved: ${byStatus.saved.length}`)
  console.log(`   Denied: ${byStatus.denied.length}`)
  console.log(`   No Decision: ${byStatus.noDecision.length}`)
  console.log(`   Scanned: ${byStatus.scanned.length}`)
  console.log(`   Not Scanned: ${byStatus.notScanned.length}`)
  console.log(`   Has Content: ${byStatus.hasContent.length}`)
  console.log(`   Has savedContentId: ${byStatus.hasSavedContent.length}`)
  console.log()

  // Show detailed information for each citation
  console.log('📋 Detailed Citation Information:\n')
  console.log('='.repeat(100))
  
  for (let i = 0; i < citations.length; i++) {
    const citation = citations[i]
    const contentLength = citation.contentText ? citation.contentText.length : 0
    
    console.log(`\n[${i + 1}] Citation ID: ${citation.id}`)
    console.log(`    Title: ${citation.citationTitle || 'N/A'}`)
    console.log(`    URL: ${citation.citationUrl}`)
    console.log(`    Context: ${citation.citationContext ? citation.citationContext.substring(0, 100) + '...' : 'N/A'}`)
    console.log(`    Wikipedia Page: ${citation.monitoring?.wikipediaTitle || 'N/A'}`)
    console.log(`    Verification: ${citation.verificationStatus}`)
    console.log(`    Scan Status: ${citation.scanStatus}`)
    console.log(`    Decision: ${citation.relevanceDecision || 'none'}`)
    console.log(`    AI Score: ${citation.aiPriorityScore || 'N/A'}`)
    console.log(`    Saved Content ID: ${citation.savedContentId || 'NONE'}`)
    console.log(`    Content Length: ${contentLength} chars`)
    console.log(`    Last Scanned: ${citation.lastScannedAt ? citation.lastScannedAt.toISOString() : 'Never'}`)
    if (citation.errorMessage) {
      console.log(`    Error: ${citation.errorMessage.substring(0, 200)}`)
    }
    
    // Show content preview if available
    if (citation.contentText && citation.contentText.length > 0) {
      const preview = citation.contentText.substring(0, 200).replace(/\n/g, ' ')
      console.log(`    Content Preview: ${preview}...`)
    }
    
    console.log()
  }

  console.log('='.repeat(100))
  console.log()

  // Summary table
  console.log('📊 Summary Table:\n')
  console.log('ID'.padEnd(30) + 'Title'.padEnd(40) + 'Status'.padEnd(10) + 'Score'.padEnd(8) + 'URL')
  console.log('-'.repeat(120))
  
  for (const citation of citations) {
    const title = (citation.citationTitle || 'N/A').substring(0, 38)
    const status = (citation.relevanceDecision || citation.scanStatus || 'unknown').padEnd(10)
    const score = (citation.aiPriorityScore?.toFixed(1) || 'N/A').padEnd(8)
    const url = citation.citationUrl.substring(0, 50)
    console.log(`${citation.id.padEnd(30)}${title.padEnd(40)}${status}${score}${url}`)
  }
  
  console.log()
}

async function main() {
  try {
    const args = await parseArgs()
    const patchHandle = args.patch || 'israel'
    
    await reviewCitations(patchHandle)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

