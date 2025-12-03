/**
 * Check what we've learned about the Apartheid Wikipedia page
 * Run with: npx tsx scripts/check-apartheid-page.ts
 */

import { prisma } from '../src/lib/prisma'

async function checkApartheidPage() {
  try {
    const patch = await prisma.patch.findUnique({
      where: { handle: 'israel' },
      select: { id: true, title: true }
    })

    if (!patch) {
      console.log('Patch "israel" not found')
      return
    }

    const apartheidPage = await prisma.wikipediaMonitoring.findFirst({
      where: {
        patchId: patch.id,
        wikipediaUrl: 'https://en.wikipedia.org/wiki/Apartheid'
      },
      include: {
        citations: {
          select: {
            id: true,
            citationTitle: true,
            citationUrl: true,
            scanStatus: true,
            relevanceDecision: true,
            aiPriorityScore: true,
            savedContentId: true,
            savedMemoryId: true
          }
        }
      }
    })

    if (!apartheidPage) {
      console.log('Apartheid page not found in monitoring')
      return
    }

    console.log(`\n📄 Wikipedia Page: ${apartheidPage.wikipediaTitle}`)
    console.log(`   URL: ${apartheidPage.wikipediaUrl}`)
    console.log(`   Status: ${apartheidPage.status}`)
    console.log(`   Citations Extracted: ${apartheidPage.citationsExtracted}`)
    console.log(`   Last Scanned: ${apartheidPage.lastScannedAt?.toISOString() || 'Never'}`)
    
    const totalCitations = apartheidPage.citations.length
    const scannedCitations = apartheidPage.citations.filter(c => c.scanStatus === 'scanned').length
    const pendingCitations = apartheidPage.citations.filter(c => c.scanStatus === 'not_scanned').length
    const savedCitations = apartheidPage.citations.filter(c => c.savedContentId !== null).length
    const relevantCitations = apartheidPage.citations.filter(c => c.relevanceDecision === 'approved').length
    const deniedCitations = apartheidPage.citations.filter(c => c.relevanceDecision === 'denied').length
    
    console.log(`\n📊 Citation Statistics:`)
    console.log(`   Total Citations: ${totalCitations}`)
    console.log(`   Scanned: ${scannedCitations}`)
    console.log(`   Pending: ${pendingCitations}`)
    console.log(`   Saved to Content: ${savedCitations}`)
    console.log(`   Approved: ${relevantCitations}`)
    console.log(`   Denied: ${deniedCitations}`)
    
    if (scannedCitations > 0) {
      const scoredCitations = apartheidPage.citations.filter(c => c.aiPriorityScore !== null)
      const avgScore = scoredCitations.length > 0
        ? scoredCitations.reduce((sum, c) => sum + (c.aiPriorityScore || 0), 0) / scoredCitations.length
        : 0
      console.log(`   Average AI Score: ${avgScore.toFixed(1)}`)
      
      const scoresAbove60 = scoredCitations.filter(c => (c.aiPriorityScore || 0) >= 60).length
      const scoresBelow60 = scoredCitations.filter(c => (c.aiPriorityScore || 0) < 60).length
      console.log(`   Scores >= 60: ${scoresAbove60}`)
      console.log(`   Scores < 60: ${scoresBelow60}`)
    }

  } catch (error: any) {
    console.error('Error:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

checkApartheidPage().catch(console.error)

