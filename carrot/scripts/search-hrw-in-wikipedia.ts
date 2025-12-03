/**
 * Search for HRW URL in Wikipedia pages we're monitoring
 * Run with: npx tsx scripts/search-hrw-in-wikipedia.ts
 */

import { prisma } from '../src/lib/prisma'

async function searchHRWInWikipedia() {
  const targetUrl = 'https://www.hrw.org/news/2020/05/12/israel-discriminatory-land-policies-hem-palestinians'
  const targetUrlVariants = [
    'hrw.org/news/2020/05/12/israel-discriminatory-land-policies-hem-palestinians',
    'israel-discriminatory-land-policies-hem-palestinians',
    'discriminatory-land-policies-hem-palestinians'
  ]
  
  try {
    const patch = await prisma.patch.findUnique({
      where: { handle: 'israel' },
      select: { id: true, title: true }
    })

    if (!patch) {
      console.log('Patch "israel" not found')
      return
    }

    console.log(`\n🔍 Searching for HRW URL in Wikipedia pages...\n`)
    console.log(`Target URL: ${targetUrl}\n`)

    // Get all Wikipedia pages we're monitoring
    const wikipediaPages = await prisma.wikipediaMonitoring.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        wikipediaTitle: true,
        wikipediaUrl: true,
        status: true
      },
      orderBy: { wikipediaTitle: 'asc' }
    })

    console.log(`📚 Checking ${wikipediaPages.length} Wikipedia pages...\n`)

    let foundInPages: string[] = []

    for (const page of wikipediaPages) {
      try {
        // Fetch the Wikipedia page
        const response = await fetch(page.wikipediaUrl, {
          headers: {
            'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)'
          }
        })

        if (!response.ok) continue

        const html = await response.text()
        
        // Check if URL or variants exist in the HTML
        const found = targetUrlVariants.some(variant => 
          html.toLowerCase().includes(variant.toLowerCase())
        )

        if (found) {
          foundInPages.push(page.wikipediaTitle)
          console.log(`✅ Found in: ${page.wikipediaTitle}`)
          console.log(`   URL: ${page.wikipediaUrl}\n`)
        }
      } catch (error) {
        // Skip errors
      }
    }

    if (foundInPages.length === 0) {
      console.log(`❌ URL not found in any monitored Wikipedia pages\n`)
      console.log(`This means:`)
      console.log(`- The Wikipedia pages we're monitoring don't link to this specific HRW article`)
      console.log(`- It might be in a Wikipedia page we haven't discovered yet`)
      console.log(`- The link might use a different format (redirect, archive, etc.)`)
    }

    // Check what HRW URLs we did find
    console.log(`\n📋 Checking what HRW URLs we actually extracted...\n`)
    const hrwCitations = await prisma.wikipediaCitation.findMany({
      where: {
        monitoring: { patchId: patch.id },
        citationUrl: { contains: 'hrw.org' }
      },
      select: {
        citationTitle: true,
        citationUrl: true,
        monitoring: {
          select: {
            wikipediaTitle: true
          }
        }
      }
    })

    console.log(`Found ${hrwCitations.length} HRW citations:`)
    hrwCitations.forEach(c => {
      console.log(`  - ${c.citationUrl}`)
      console.log(`    From: ${c.monitoring.wikipediaTitle}`)
      console.log(`    Title: ${c.citationTitle || 'N/A'}\n`)
    })

  } catch (error: any) {
    console.error('Error:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

searchHRWInWikipedia().catch(console.error)

