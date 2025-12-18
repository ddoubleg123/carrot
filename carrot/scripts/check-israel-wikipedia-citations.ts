#!/usr/bin/env tsx
/**
 * Check Israel Wikipedia Page Citations
 * 
 * Manually verify how many external citations are on the Israel Wikipedia page
 */

import 'dotenv/config'
import { extractWikipediaCitationsWithContext } from '../src/lib/discovery/wikiUtils'

async function checkIsraelWikipediaCitations() {
  console.log('🔍 Checking Israel Wikipedia Page for External Citations\n')
  console.log('═'.repeat(70))

  // Fetch the Israel Wikipedia page HTML
  const response = await fetch('https://en.wikipedia.org/wiki/Israel')
  if (!response.ok) {
    console.error(`❌ Failed to fetch: ${response.status}`)
    process.exit(1)
  }

  const html = await response.text()
  console.log(`✅ Fetched HTML (${(html.length / 1024).toFixed(1)} KB)\n`)

  // Extract citations using our extraction function
  const citations = extractWikipediaCitationsWithContext(html, 'https://en.wikipedia.org/wiki/Israel', 10000)

  console.log(`📊 EXTRACTION RESULTS\n`)
  console.log(`   Total Citations Found: ${citations.length}\n`)

  // Categorize
  const external = citations.filter(c => {
    const url = c.url
    return url.startsWith('http://') || url.startsWith('https://')
  })

  const wikipedia = citations.filter(c => {
    const url = c.url
    return url.startsWith('./') || 
           url.startsWith('/wiki/') || 
           url.startsWith('../') ||
           url.includes('wikipedia.org') ||
           url.includes('wikimedia.org') ||
           url.includes('wikidata.org')
  })

  const other = citations.filter(c => {
    const url = c.url
    return !url.startsWith('http://') && 
           !url.startsWith('https://') &&
           !url.startsWith('./') &&
           !url.startsWith('/wiki/') &&
           !url.startsWith('../') &&
           !url.includes('wikipedia.org') &&
           !url.includes('wikimedia.org') &&
           !url.includes('wikidata.org')
  })

  console.log(`   External URLs (http/https): ${external.length}`)
  console.log(`   Wikipedia Links: ${wikipedia.length}`)
  console.log(`   Other: ${other.length}\n`)

  // Show external URLs grouped by section
  const bySection = external.reduce((acc, c) => {
    const section = c.context?.includes('[References]') ? 'References' :
                   c.context?.includes('[Further reading]') ? 'Further reading' :
                   c.context?.includes('[External links]') ? 'External links' :
                   'Unknown'
    if (!acc[section]) acc[section] = []
    acc[section].push(c)
    return acc
  }, {} as Record<string, typeof external>)

  console.log(`📋 EXTERNAL URLS BY SECTION\n`)
  Object.entries(bySection).forEach(([section, urls]) => {
    console.log(`   ${section}: ${urls.length} URLs`)
  })

  // Show sample external URLs
  console.log(`\n📝 SAMPLE EXTERNAL URLS (first 30)\n`)
  external.slice(0, 30).forEach((c, i) => {
    const section = c.context?.includes('[References]') ? 'Ref' :
                   c.context?.includes('[Further reading]') ? 'Read' :
                   c.context?.includes('[External links]') ? 'Ext' :
                   '?'
    console.log(`   ${i + 1}. [${section}] ${c.url}`)
    if (c.title) {
      console.log(`      Title: ${c.title.substring(0, 60)}...`)
    }
  })

  if (external.length > 30) {
    console.log(`\n   ... and ${external.length - 30} more external URLs`)
  }

  // Also check what we have in the database
  console.log(`\n\n💾 DATABASE COMPARISON\n`)
  console.log('═'.repeat(70))

  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })

  if (patch) {
    const dbCitations = await prisma.wikipediaCitation.findMany({
      where: {
        monitoring: {
          patchId: patch.id,
          wikipediaTitle: 'Israel'
        }
      },
      select: {
        citationUrl: true,
        verificationStatus: true
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

    console.log(`\n   Database Citations for "Israel" page:`)
    console.log(`      Total: ${dbCitations.length}`)
    console.log(`      External: ${dbExternal.length}`)
    console.log(`      Wikipedia Links: ${dbWikipedia.length}\n`)

    console.log(`   Comparison:`)
    console.log(`      Extracted External URLs: ${external.length}`)
    console.log(`      Database External URLs: ${dbExternal.length}`)
    console.log(`      Match: ${external.length === dbExternal.length ? '✅' : '❌'}`)
  }

  await prisma.$disconnect()

  console.log(`\n\n📋 SUMMARY\n`)
  console.log('═'.repeat(70))
  console.log(`\n   Israel Wikipedia Page has:`)
  console.log(`      ${external.length} external citation URLs`)
  console.log(`      ${wikipedia.length} Wikipedia internal links`)
  console.log(`\n   These external URLs are the actual citations we should process.`)
  console.log(`   The Wikipedia links are internal references, not citations.\n`)
}

checkIsraelWikipediaCitations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

