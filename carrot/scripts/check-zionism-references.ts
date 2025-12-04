import { prisma } from '../src/lib/prisma'

async function main() {
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' }
  })

  if (!patch) {
    console.error('Patch "israel" not found')
    process.exit(1)
  }

  // Get all citations from Zionism page
  const zionismCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: {
        patchId: patch.id,
        wikipediaTitle: 'Zionism'
      }
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      verificationStatus: true,
      scanStatus: true,
      relevanceDecision: true,
      savedContentId: true,
      savedMemoryId: true,
      contentText: true,
      aiPriorityScore: true
    }
  })

  console.log('\n=== ZIONISM PAGE REFERENCE ANALYSIS ===\n')
  console.log(`Total citations extracted from Zionism page: ${zionismCitations.length}`)
  console.log(`\n--- Status Breakdown ---`)
  console.log(`Verification Status:`)
  console.log(`  - Pending: ${zionismCitations.filter(c => c.verificationStatus === 'pending').length}`)
  console.log(`  - Verified: ${zionismCitations.filter(c => c.verificationStatus === 'verified').length}`)
  console.log(`  - Failed: ${zionismCitations.filter(c => c.verificationStatus === 'failed').length}`)
  
  console.log(`\nScan Status:`)
  console.log(`  - Not scanned: ${zionismCitations.filter(c => c.scanStatus === 'not_scanned').length}`)
  console.log(`  - Scanning: ${zionismCitations.filter(c => c.scanStatus === 'scanning').length}`)
  console.log(`  - Scanned: ${zionismCitations.filter(c => c.scanStatus === 'scanned').length}`)
  
  console.log(`\nRelevance Decision:`)
  console.log(`  - Pending (null): ${zionismCitations.filter(c => !c.relevanceDecision).length}`)
  console.log(`  - Saved: ${zionismCitations.filter(c => c.relevanceDecision === 'saved').length}`)
  console.log(`  - Denied: ${zionismCitations.filter(c => c.relevanceDecision === 'denied').length}`)
  
  console.log(`\n--- Content Status ---`)
  console.log(`With content extracted: ${zionismCitations.filter(c => (c.contentText?.length || 0) > 0).length}`)
  console.log(`Saved to DiscoveredContent: ${zionismCitations.filter(c => c.savedContentId).length}`)
  console.log(`Saved to AgentMemory: ${zionismCitations.filter(c => c.savedMemoryId).length}`)
  
  console.log(`\n--- Failed + Pending Issue ---`)
  const failedButPending = zionismCitations.filter(c => 
    c.verificationStatus === 'failed' && 
    c.scanStatus === 'not_scanned' && 
    !c.relevanceDecision
  )
  console.log(`Citations with verification=failed, scan=not_scanned, decision=null: ${failedButPending.length}`)
  
  if (failedButPending.length > 0) {
    console.log(`\nSample failed citations (first 5):`)
    failedButPending.slice(0, 5).forEach(c => {
      console.log(`  - ${c.citationTitle || 'Untitled'}: ${c.citationUrl}`)
    })
  }

  // Count external vs Wikipedia internal
  const external = zionismCitations.filter(c => !c.citationUrl.includes('wikipedia.org') && !c.citationUrl.startsWith('./') && !c.citationUrl.startsWith('../'))
  const wikipediaInternal = zionismCitations.filter(c => c.citationUrl.includes('wikipedia.org') || c.citationUrl.startsWith('./') || c.citationUrl.startsWith('../'))
  
  console.log(`\n--- URL Type Breakdown ---`)
  console.log(`External URLs: ${external.length}`)
  console.log(`Wikipedia Internal URLs: ${wikipediaInternal.length}`)
  
  console.log(`\n--- External URLs Status ---`)
  console.log(`External - Verified: ${external.filter(c => c.verificationStatus === 'verified').length}`)
  console.log(`External - Failed: ${external.filter(c => c.verificationStatus === 'failed').length}`)
  console.log(`External - Saved: ${external.filter(c => c.savedContentId).length}`)
  
  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

