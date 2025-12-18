#!/usr/bin/env tsx
/**
 * Re-extract Citations for All Wikipedia Pages
 * 
 * Re-extracts citations from all monitored Wikipedia pages to ensure all external citations are stored
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { extractWikipediaCitationsWithContext } from '../src/lib/discovery/wikiUtils'
import { extractAndStoreCitations } from '../src/lib/discovery/wikipediaCitation'

const prisma = new PrismaClient()

async function reExtractAllCitations(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`🔄 Re-extracting Citations for: ${patch.title}\n`)
  console.log('═'.repeat(70))

  // Get all monitored Wikipedia pages
  const monitoredPages = await prisma.wikipediaMonitoring.findMany({
    where: {
      patchId: patch.id
    },
    select: {
      id: true,
      wikipediaTitle: true,
      wikipediaUrl: true
    },
    orderBy: {
      wikipediaTitle: 'asc'
    }
  })

  console.log(`\n📄 Found ${monitoredPages.length} Wikipedia pages\n`)

  if (monitoredPages.length === 0) {
    console.log('No pages to process')
    await prisma.$disconnect()
    return
  }

  // Mock prioritize function
  const prioritizeCitations = async (citations: any[]) => {
    return citations.map(c => ({ ...c, score: 50 }))
  }

  let totalExtracted = 0
  let totalStored = 0
  let pagesProcessed = 0
  let pagesWithIssues = 0

  for (const page of monitoredPages) {
    try {
      console.log(`\n[${pagesProcessed + 1}/${monitoredPages.length}] Processing: ${page.wikipediaTitle}`)

      // Fetch the page
      const response = await fetch(page.wikipediaUrl)
      if (!response.ok) {
        console.log(`   ⚠️  Failed to fetch: ${response.status}`)
        pagesWithIssues++
        continue
      }

      const html = await response.text()

      // Extract citations
      const extracted = extractWikipediaCitationsWithContext(html, page.wikipediaUrl, 10000)
      const external = extracted.filter(c => {
        const url = c.url
        return url.startsWith('http://') || url.startsWith('https://')
      })

      console.log(`   Extracted: ${external.length} external citations`)

      // Re-extract and store
      const result = await extractAndStoreCitations(
        page.id,
        page.wikipediaUrl,
        html,
        prioritizeCitations
      )

      totalExtracted += result.citationsFound
      totalStored += result.citationsStored

      console.log(`   Stored: ${result.citationsStored} new citations`)

      // Verify
      const dbCount = await prisma.wikipediaCitation.count({
        where: {
          monitoringId: page.id,
          citationUrl: {
            startsWith: 'http'
          },
          NOT: [
            { citationUrl: { contains: 'wikipedia.org' } },
            { citationUrl: { contains: 'wikimedia.org' } },
            { citationUrl: { contains: 'wikidata.org' } },
            { citationUrl: { contains: 'wiktionary.org' } },
            { citationUrl: { contains: 'wikinews.org' } },
            { citationUrl: { contains: 'wikiquote.org' } },
            { citationUrl: { contains: 'wikisource.org' } },
            { citationUrl: { contains: 'wikibooks.org' } },
            { citationUrl: { contains: 'wikiversity.org' } },
            { citationUrl: { contains: 'wikivoyage.org' } },
            { citationUrl: { contains: 'wikimediafoundation.org' } },
            { citationUrl: { contains: 'mediawiki.org' } },
            { citationUrl: { contains: 'toolforge.org' } }
          ]
        }
      })

      if (dbCount === external.length) {
        console.log(`   ✅ All ${external.length} citations stored`)
      } else {
        const missing = external.length - dbCount
        console.log(`   ⚠️  Missing ${missing} citations (${dbCount}/${external.length} stored)`)
        pagesWithIssues++
      }

      pagesProcessed++

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`)
      pagesWithIssues++
    }
  }

  // Summary
  console.log(`\n\n📊 RE-EXTRACTION SUMMARY\n`)
  console.log('═'.repeat(70))
  console.log(`\n   Pages Processed: ${pagesProcessed}/${monitoredPages.length}`)
  console.log(`   Total Citations Extracted: ${totalExtracted}`)
  console.log(`   Total Citations Stored: ${totalStored}`)
  console.log(`   Pages with Issues: ${pagesWithIssues}`)

  // Final verification
  const allCitations = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id }
    }
  })

  const allExternal = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: {
        startsWith: 'http'
      },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } },
        { citationUrl: { contains: 'wiktionary.org' } },
        { citationUrl: { contains: 'wikinews.org' } },
        { citationUrl: { contains: 'wikiquote.org' } },
        { citationUrl: { contains: 'wikisource.org' } },
        { citationUrl: { contains: 'wikibooks.org' } },
        { citationUrl: { contains: 'wikiversity.org' } },
        { citationUrl: { contains: 'wikivoyage.org' } },
        { citationUrl: { contains: 'wikimediafoundation.org' } },
        { citationUrl: { contains: 'mediawiki.org' } },
        { citationUrl: { contains: 'toolforge.org' } }
      ]
    }
  })

  const allWikipedia = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      OR: [
        { citationUrl: { startsWith: './' } },
        { citationUrl: { contains: 'wikipedia.org' } }
      ]
    }
  })

  console.log(`\n   Final Database State:`)
  console.log(`      Total Citations: ${allCitations}`)
  console.log(`      External URLs: ${allExternal}`)
  console.log(`      Wikipedia Links: ${allWikipedia}`)

  if (allWikipedia === 0) {
    console.log(`\n✅ No Wikipedia links in database`)
  } else {
    console.log(`\n⚠️  ${allWikipedia} Wikipedia links still need cleanup`)
  }

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'

reExtractAllCitations(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

