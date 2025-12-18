#!/usr/bin/env tsx
/**
 * Analyze Citation URLs
 * 
 * Detailed analysis of what types of URLs we're actually extracting
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function analyzeCitationUrls(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`🔍 Citation URL Analysis for: ${patch.title}\n`)
  console.log(`═`.repeat(70))

  // Get all citations with their URLs
  const allCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id }
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      monitoring: {
        select: {
          wikipediaTitle: true
        }
      }
    }
  })

  console.log(`\n📊 Total Citations: ${allCitations.length.toLocaleString()}\n`)

  // Categorize URLs
  const categories = {
    relativeWiki: [] as string[],
    absoluteWiki: [] as string[],
    externalHttp: [] as string[],
    externalHttps: [] as string[],
    other: [] as string[]
  }

  allCitations.forEach(c => {
    const url = c.citationUrl
    if (url.startsWith('./') || url.startsWith('../') || url.startsWith('/wiki/')) {
      categories.relativeWiki.push(url)
    } else if (url.includes('wikipedia.org') || url.includes('wikimedia.org') || url.includes('wikidata.org')) {
      categories.absoluteWiki.push(url)
    } else if (url.startsWith('http://')) {
      categories.externalHttp.push(url)
    } else if (url.startsWith('https://')) {
      categories.externalHttps.push(url)
    } else {
      categories.other.push(url)
    }
  })

  console.log(`📋 URL CATEGORIZATION\n`)
  console.log(`   Relative Wiki Links (./PageName, /wiki/PageName): ${categories.relativeWiki.length.toLocaleString()}`)
  console.log(`   Absolute Wiki Links (wikipedia.org, wikimedia.org, wikidata.org): ${categories.absoluteWiki.length.toLocaleString()}`)
  console.log(`   External HTTP URLs: ${categories.externalHttp.length.toLocaleString()}`)
  console.log(`   External HTTPS URLs: ${categories.externalHttps.length.toLocaleString()}`)
  console.log(`   Other/Unknown: ${categories.other.length.toLocaleString()}`)

  const totalExternal = categories.externalHttp.length + categories.externalHttps.length
  const totalWiki = categories.relativeWiki.length + categories.absoluteWiki.length

  console.log(`\n   Total External URLs: ${totalExternal.toLocaleString()}`)
  console.log(`   Total Wikipedia Links: ${totalWiki.toLocaleString()}`)
  console.log(`   Ratio: ${((totalExternal / allCitations.length) * 100).toFixed(1)}% external, ${((totalWiki / allCitations.length) * 100).toFixed(1)}% Wikipedia`)

  // Sample URLs from each category
  console.log(`\n📝 SAMPLE URLs BY CATEGORY\n`)

  console.log(`   Relative Wiki Links (first 10):`)
  categories.relativeWiki.slice(0, 10).forEach((url, i) => {
    console.log(`      ${i + 1}. ${url}`)
  })
  if (categories.relativeWiki.length > 10) {
    console.log(`      ... and ${categories.relativeWiki.length - 10} more`)
  }

  console.log(`\n   Absolute Wiki Links (first 10):`)
  categories.absoluteWiki.slice(0, 10).forEach((url, i) => {
    console.log(`      ${i + 1}. ${url}`)
  })
  if (categories.absoluteWiki.length > 10) {
    console.log(`      ... and ${categories.absoluteWiki.length - 10} more`)
  }

  console.log(`\n   External HTTPS URLs (first 20):`)
  categories.externalHttps.slice(0, 20).forEach((url, i) => {
    console.log(`      ${i + 1}. ${url}`)
  })
  if (categories.externalHttps.length > 20) {
    console.log(`      ... and ${categories.externalHttps.length - 20} more`)
  }

  console.log(`\n   External HTTP URLs (first 10):`)
  categories.externalHttp.slice(0, 10).forEach((url, i) => {
    console.log(`      ${i + 1}. ${url}`)
  })
  if (categories.externalHttp.length > 10) {
    console.log(`      ... and ${categories.externalHttp.length - 10} more`)
  }

  if (categories.other.length > 0) {
    console.log(`\n   Other/Unknown URLs (first 10):`)
    categories.other.slice(0, 10).forEach((url, i) => {
      console.log(`      ${i + 1}. ${url}`)
    })
  }

  // Analyze by Wikipedia page
  console.log(`\n\n📄 ANALYSIS BY WIKIPEDIA PAGE\n`)
  console.log(`═`.repeat(70))

  const citationsByPage = allCitations.reduce((acc, c) => {
    const pageTitle = c.monitoring.wikipediaTitle || 'Unknown'
    if (!acc[pageTitle]) {
      acc[pageTitle] = {
        total: 0,
        relativeWiki: 0,
        absoluteWiki: 0,
        external: 0,
        other: 0
      }
    }
    acc[pageTitle].total++
    
    const url = c.citationUrl
    if (url.startsWith('./') || url.startsWith('../') || url.startsWith('/wiki/')) {
      acc[pageTitle].relativeWiki++
    } else if (url.includes('wikipedia.org') || url.includes('wikimedia.org') || url.includes('wikidata.org')) {
      acc[pageTitle].absoluteWiki++
    } else if (url.startsWith('http://') || url.startsWith('https://')) {
      acc[pageTitle].external++
    } else {
      acc[pageTitle].other++
    }
    
    return acc
  }, {} as Record<string, { total: number; relativeWiki: number; absoluteWiki: number; external: number; other: number }>)

  const pages = Object.entries(citationsByPage)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)

  console.log(`\n   Top 20 Wikipedia Pages by Citation Count:\n`)
  pages.forEach(([pageTitle, stats], i) => {
    const externalPct = (stats.external / stats.total * 100).toFixed(1)
    const wikiPct = ((stats.relativeWiki + stats.absoluteWiki) / stats.total * 100).toFixed(1)
    console.log(`   ${i + 1}. ${pageTitle}`)
    console.log(`      Total: ${stats.total}, External: ${stats.external} (${externalPct}%), Wiki: ${stats.relativeWiki + stats.absoluteWiki} (${wikiPct}%)`)
  })

  // Check if relative links are being incorrectly counted
  console.log(`\n\n🔍 RELATIVE LINK ANALYSIS\n`)
  console.log(`═`.repeat(70))

  const relativeLinks = categories.relativeWiki
  const uniqueRelativeLinks = new Set(relativeLinks)
  
  console.log(`\n   Total Relative Links: ${relativeLinks.length.toLocaleString()}`)
  console.log(`   Unique Relative Links: ${uniqueRelativeLinks.size.toLocaleString()}`)
  console.log(`   Average Occurrences: ${(relativeLinks.length / uniqueRelativeLinks.size).toFixed(1)}`)

  // Count relative links by pattern
  const relativePatterns = {
    './': 0,
    '../': 0,
    '/wiki/': 0
  }

  relativeLinks.forEach(url => {
    if (url.startsWith('./')) relativePatterns['./']++
    else if (url.startsWith('../')) relativePatterns['../']++
    else if (url.startsWith('/wiki/')) relativePatterns['/wiki/']++
  })

  console.log(`\n   Relative Link Patterns:`)
  console.log(`      ./PageName: ${relativePatterns['./'].toLocaleString()}`)
  console.log(`      ../PageName: ${relativePatterns['../'].toLocaleString()}`)
  console.log(`      /wiki/PageName: ${relativePatterns['/wiki/'].toLocaleString()}`)

  // Sample relative links
  console.log(`\n   Sample Relative Links (first 20):`)
  Array.from(uniqueRelativeLinks).slice(0, 20).forEach((url, i) => {
    const count = relativeLinks.filter(u => u === url).length
    console.log(`      ${i + 1}. ${url} (appears ${count} time${count > 1 ? 's' : ''})`)
  })

  // Final summary
  console.log(`\n\n📋 FINAL SUMMARY\n`)
  console.log(`═`.repeat(70))
  console.log(`\n   Total Citations: ${allCitations.length.toLocaleString()}`)
  console.log(`   External URLs (http/https): ${totalExternal.toLocaleString()} (${((totalExternal / allCitations.length) * 100).toFixed(1)}%)`)
  console.log(`   Wikipedia Links (relative + absolute): ${totalWiki.toLocaleString()} (${((totalWiki / allCitations.length) * 100).toFixed(1)}%)`)
  console.log(`   Other: ${categories.other.length.toLocaleString()}`)
  
  console.log(`\n   ⚠️  NOTE: Relative Wikipedia links (./PageName) are internal references`)
  console.log(`      and should NOT be counted as external citations.`)
  console.log(`      These are links to other Wikipedia pages, not source citations.`)

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'

analyzeCitationUrls(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

