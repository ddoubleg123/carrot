#!/usr/bin/env tsx
/**
 * Verify All Wikipedia Pages Citation Extraction
 * 
 * Checks that all monitored Wikipedia pages are extracting external citations correctly
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { extractWikipediaCitationsWithContext } from '../src/lib/discovery/wikiUtils'

const prisma = new PrismaClient()

async function verifyAllWikipediaPages(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`🔍 Verifying Citation Extraction for: ${patch.title}\n`)
  console.log('═'.repeat(70))

  // Get all monitored Wikipedia pages
  const monitoredPages = await prisma.wikipediaMonitoring.findMany({
    where: {
      patchId: patch.id,
      citationsExtracted: true
    },
    select: {
      id: true,
      wikipediaTitle: true,
      wikipediaUrl: true,
      citationCount: true
    },
    orderBy: {
      citationCount: 'desc'
    }
  })

  console.log(`\n📄 Found ${monitoredPages.length} Wikipedia pages with extracted citations\n`)

  if (monitoredPages.length === 0) {
    console.log('No pages to verify')
    await prisma.$disconnect()
    return
  }

  const results: Array<{
    pageTitle: string
    expectedExternal: number
    actualExternal: number
    wikipediaLinks: number
    match: boolean
  }> = []

  // Check first 10 pages (to avoid too many API calls)
  const pagesToCheck = monitoredPages.slice(0, 10)

  console.log(`Checking ${pagesToCheck.length} pages...\n`)

  for (const page of pagesToCheck) {
    try {
      // Fetch the page
      const response = await fetch(page.wikipediaUrl)
      if (!response.ok) {
        console.log(`⚠️  ${page.wikipediaTitle}: Failed to fetch (${response.status})`)
        continue
      }

      const html = await response.text()
      
      // Extract citations
      const extracted = extractWikipediaCitationsWithContext(html, page.wikipediaUrl, 10000)
      
      const external = extracted.filter(c => {
        const url = c.url
        return url.startsWith('http://') || url.startsWith('https://')
      })

      const wikipedia = extracted.filter(c => {
        const url = c.url
        return url.startsWith('./') || 
               url.startsWith('/wiki/') ||
               url.includes('wikipedia.org') ||
               url.includes('wikimedia.org')
      })

      // Check database
      const dbCitations = await prisma.wikipediaCitation.findMany({
        where: {
          monitoringId: page.id
        },
        select: {
          citationUrl: true
        }
      })

      const dbExternal = dbCitations.filter(c => {
        const url = c.citationUrl
        return url.startsWith('http://') || url.startsWith('https://')
      })

      const dbWikipedia = dbCitations.filter(c => {
        const url = c.citationUrl
        return url.startsWith('./') || 
               url.startsWith('/wiki/') ||
               url.includes('wikipedia.org')
      })

      const match = dbExternal.length === external.length && dbWikipedia.length === 0

      results.push({
        pageTitle: page.wikipediaTitle,
        expectedExternal: external.length,
        actualExternal: dbExternal.length,
        wikipediaLinks: dbWikipedia.length,
        match
      })

      const status = match ? '✅' : '❌'
      console.log(`${status} ${page.wikipediaTitle}`)
      console.log(`   Expected: ${external.length} external, 0 Wikipedia`)
      console.log(`   Actual: ${dbExternal.length} external, ${dbWikipedia.length} Wikipedia`)
      if (!match) {
        const missing = external.length - dbExternal.length
        if (missing > 0) {
          console.log(`   ⚠️  Missing ${missing} external citations`)
        }
        if (dbWikipedia.length > 0) {
          console.log(`   ⚠️  ${dbWikipedia.length} Wikipedia links should not be stored`)
        }
      }
      console.log()

    } catch (error: any) {
      console.log(`❌ ${page.wikipediaTitle}: Error - ${error.message}\n`)
    }
  }

  // Summary
  console.log('\n📊 VERIFICATION SUMMARY\n')
  console.log('═'.repeat(70))

  const matched = results.filter(r => r.match).length
  const total = results.length

  console.log(`\n   Pages Checked: ${total}`)
  console.log(`   Pages Matching: ${matched} (${((matched / total) * 100).toFixed(1)}%)`)
  console.log(`   Pages with Issues: ${total - matched}`)

  if (matched === total) {
    console.log(`\n✅ All pages verified correctly!`)
  } else {
    console.log(`\n⚠️  Some pages need attention:`)
    results.filter(r => !r.match).forEach(r => {
      console.log(`   - ${r.pageTitle}: Expected ${r.expectedExternal}, got ${r.actualExternal} external, ${r.wikipediaLinks} Wikipedia links`)
    })
  }

  // Overall statistics
  console.log(`\n\n📈 OVERALL STATISTICS\n`)
  console.log('═'.repeat(70))

  const allCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id }
    },
    select: {
      citationUrl: true
    }
  })

  const allExternal = allCitations.filter(c => {
    const url = c.citationUrl
    return url.startsWith('http://') || url.startsWith('https://')
  })

  const allWikipedia = allCitations.filter(c => {
    const url = c.citationUrl
    return url.startsWith('./') || 
           url.startsWith('/wiki/') ||
           url.includes('wikipedia.org')
  })

  console.log(`\n   Total Citations in Database: ${allCitations.length}`)
  console.log(`   External URLs: ${allExternal.length}`)
  console.log(`   Wikipedia Links: ${allWikipedia.length}`)

  if (allWikipedia.length === 0) {
    console.log(`\n✅ No Wikipedia links in database - all clean!`)
  } else {
    console.log(`\n⚠️  ${allWikipedia.length} Wikipedia links still in database`)
  }

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'

verifyAllWikipediaPages(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

