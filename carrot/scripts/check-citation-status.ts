/**
 * Check Citation Status
 * 
 * Analyzes citation processing status for given citation IDs
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

async function checkCitations() {
  console.log(`\n🔍 Checking ${citationIds.length} citations...\n`)

  const citations = await prisma.wikipediaCitation.findMany({
    where: { id: { in: citationIds } },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      verificationStatus: true,
      scanStatus: true,
      relevanceDecision: true,
      savedContentId: true,
      aiPriorityScore: true,
      contentText: true,
      lastScannedAt: true,
      createdAt: true,
      monitoring: {
        select: {
          patchId: true,
          wikipediaTitle: true
        }
      }
    }
  })

  console.log(`📊 Found ${citations.length} citations in database\n`)

  // Group by status
  const byStatus = {
    notScanned: citations.filter(c => c.scanStatus === 'not_scanned'),
    scanning: citations.filter(c => c.scanStatus === 'scanning'),
    scanned: citations.filter(c => c.scanStatus === 'scanned'),
    saved: citations.filter(c => c.relevanceDecision === 'saved'),
    denied: citations.filter(c => c.relevanceDecision === 'denied'),
    noDecision: citations.filter(c => !c.relevanceDecision),
    hasSavedContent: citations.filter(c => c.savedContentId),
    noSavedContent: citations.filter(c => !c.savedContentId && c.relevanceDecision === 'saved')
  }

  console.log('📈 Status Breakdown:')
  console.log(`   Not scanned: ${byStatus.notScanned.length}`)
  console.log(`   Scanning: ${byStatus.scanning.length}`)
  console.log(`   Scanned: ${byStatus.scanned.length}`)
  console.log(`   Saved: ${byStatus.saved.length}`)
  console.log(`   Denied: ${byStatus.denied.length}`)
  console.log(`   No decision: ${byStatus.noDecision.length}`)
  console.log(`   Has savedContentId: ${byStatus.hasSavedContent.length}`)
  console.log(`   Saved but no savedContentId: ${byStatus.noSavedContent.length}`)
  console.log()

  // Show details for each citation
  console.log('📋 Citation Details:\n')
  for (const citation of citations) {
    console.log(`ID: ${citation.id}`)
    console.log(`   URL: ${citation.citationUrl.substring(0, 80)}...`)
    console.log(`   Title: ${citation.citationTitle || 'N/A'}`)
    console.log(`   Verification: ${citation.verificationStatus}`)
    console.log(`   Scan Status: ${citation.scanStatus}`)
    console.log(`   Decision: ${citation.relevanceDecision || 'none'}`)
    console.log(`   Saved Content ID: ${citation.savedContentId || 'NONE'}`)
    console.log(`   AI Score: ${citation.aiPriorityScore || 'N/A'}`)
    console.log(`   Has Content: ${citation.contentText ? 'Yes' : 'No'}`)
    console.log(`   Last Scanned: ${citation.lastScannedAt || 'Never'}`)
    console.log()
  }

  // Check overall stats
  const allCitations = await prisma.wikipediaCitation.count()
  const scannedCount = await prisma.wikipediaCitation.count({
    where: { scanStatus: 'scanned' }
  })
  const savedCount = await prisma.wikipediaCitation.count({
    where: { relevanceDecision: 'saved' }
  })
  const savedWithContent = await prisma.wikipediaCitation.count({
    where: {
      relevanceDecision: 'saved',
      savedContentId: { not: null }
    }
  })

  console.log('\n📊 Overall Database Stats:')
  console.log(`   Total citations: ${allCitations}`)
  console.log(`   Scanned: ${scannedCount}`)
  console.log(`   Saved: ${savedCount}`)
  console.log(`   Saved with savedContentId: ${savedWithContent}`)
  console.log(`   Saved but missing savedContentId: ${savedCount - savedWithContent}`)
  console.log()
}

checkCitations()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
