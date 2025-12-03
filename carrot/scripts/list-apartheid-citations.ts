/**
 * List all citations from the Apartheid Wikipedia page
 * Run with: npx tsx scripts/list-apartheid-citations.ts
 */

import { prisma } from '../src/lib/prisma'

async function listApartheidCitations() {
  try {
    const patch = await prisma.patch.findUnique({
      where: { handle: 'israel' },
      select: { id: true }
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
      select: { id: true }
    })

    if (!apartheidPage) {
      console.log('Apartheid page not found')
      return
    }

    const citations = await prisma.wikipediaCitation.findMany({
      where: {
        monitoringId: apartheidPage.id
      },
      select: {
        citationTitle: true,
        citationUrl: true,
        scanStatus: true,
        relevanceDecision: true,
        aiPriorityScore: true,
        savedContentId: true
      },
      orderBy: {
        citationTitle: 'asc'
      }
    })

    // Output only URLs as bullet points
    citations.forEach(citation => {
      console.log(`- ${citation.citationUrl}`)
    })

  } catch (error: any) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

listApartheidCitations().catch(console.error)

