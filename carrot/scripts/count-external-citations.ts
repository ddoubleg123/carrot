/**
 * Count external citations (non-Wikipedia) from the Apartheid Wikipedia page
 * Run with: npx tsx scripts/count-external-citations.ts
 */

import { prisma } from '../src/lib/prisma'

async function countExternalCitations() {
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
        citationUrl: true
      }
    })

    // Count external citations (not Wikipedia/Wikimedia)
    const wikipediaDomains = [
      'wikipedia.org',
      'wikimedia.org',
      'wikidata.org',
      'wikiquote.org',
      'wikinews.org',
      'wikisource.org',
      'wikibooks.org',
      'wikiversity.org',
      'wiktionary.org',
      'commons.wikimedia.org',
      'upload.wikimedia.org'
    ]

    const externalCitations: string[] = []
    const internalCitations: string[] = []
    const relativeLinks: string[] = []

    citations.forEach(citation => {
      const url = citation.citationUrl
      
      // Relative links (start with ./)
      if (url.startsWith('./')) {
        relativeLinks.push(url)
        return
      }

      // Try to parse URL
      try {
        const urlObj = new URL(url, 'https://en.wikipedia.org')
        const hostname = urlObj.hostname.replace(/^www\./, '')
        
        // Check if it's a Wikipedia/Wikimedia domain
        const isWikipedia = wikipediaDomains.some(domain => hostname.includes(domain))
        
        if (isWikipedia) {
          internalCitations.push(url)
        } else {
          externalCitations.push(url)
        }
      } catch (error) {
        // If URL parsing fails, treat as relative/internal
        if (url.startsWith('/') || url.startsWith('#')) {
          relativeLinks.push(url)
        } else {
          // Unknown format, count as external to be safe
          externalCitations.push(url)
        }
      }
    })

    console.log(`\n📊 Citation Breakdown for Apartheid Page:\n`)
    console.log(`Total Citations: ${citations.length}`)
    console.log(`\nExternal Citations (non-Wikipedia): ${externalCitations.length}`)
    console.log(`Internal Wikipedia Links: ${internalCitations.length}`)
    console.log(`Relative Links (./): ${relativeLinks.length}`)
    
    if (externalCitations.length > 0) {
      console.log(`\n📋 External Citations (first 20):`)
      externalCitations.slice(0, 20).forEach(url => {
        console.log(`  - ${url}`)
      })
      if (externalCitations.length > 20) {
        console.log(`  ... and ${externalCitations.length - 20} more`)
      }
    }

  } catch (error: any) {
    console.error('Error:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

countExternalCitations().catch(console.error)

