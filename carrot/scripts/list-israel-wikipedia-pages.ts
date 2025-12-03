/**
 * List Wikipedia pages being monitored for Israel patch
 * Run with: npx tsx scripts/list-israel-wikipedia-pages.ts
 */

import { prisma } from '../src/lib/prisma'

async function listIsraelWikipediaPages() {
  try {
    const patch = await prisma.patch.findUnique({
      where: { handle: 'israel' },
      select: { id: true }
    })

    if (!patch) {
      console.log('Patch "israel" not found')
      return
    }

    const wikipediaPages = await prisma.wikipediaMonitoring.findMany({
      where: { patchId: patch.id },
      select: {
        wikipediaUrl: true
      },
      orderBy: { wikipediaTitle: 'asc' }
    })

    // Output only URLs as bullet points
    wikipediaPages.forEach(page => {
      console.log(`- ${page.wikipediaUrl}`)
    })

  } catch (error: any) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

listIsraelWikipediaPages().catch(console.error)

