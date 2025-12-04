/**
 * Count references in REST API format and compare with database
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  const patchHandle = 'israel'
  const wikipediaTitle = 'Zionism'

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle }
  })

  if (!patch) {
    console.error(`Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`\n=== Fetching REST API HTML ===\n`)
  const restApiUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(wikipediaTitle)}`
  
  let html: string
  try {
    const response = await fetch(restApiUrl, {
      headers: {
        'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
        'Accept': 'text/html'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }
    
    html = await response.text()
    console.log(`✅ Fetched REST API HTML (${html.length} bytes)`)
  } catch (error) {
    console.error(`❌ Failed to fetch:`, error)
    process.exit(1)
  }

  // Extract references section
  const referencesMatch = html.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
  
  if (!referencesMatch) {
    console.log(`❌ No References section found`)
    process.exit(1)
  }

  const refsHtml = referencesMatch[1]
  console.log(`References section HTML length: ${refsHtml.length} bytes`)

  // Count all cite_note items
  const citeNoteMatches = Array.from(refsHtml.matchAll(/<li[^>]*id=["']cite_note-(\d+)["'][^>]*>/gi))
  const totalReferences = citeNoteMatches.length
  console.log(`\n=== Reference Count ===`)
  console.log(`Total cite_note items: ${totalReferences}`)

  // Analyze each reference
  let referencesWithExternalUrls = 0
  let referencesWithWikipediaUrls = 0
  let referencesWithNoUrl = 0
  const externalUrls: Array<{ refId: string; url: string; title?: string }> = []

  for (let i = 0; i < citeNoteMatches.length; i++) {
    const match = citeNoteMatches[i]
    const refId = match[1]
    const refStart = refsHtml.indexOf(match[0])
    
    // Find the end of this reference (start of next one or end of list)
    const nextMatch = citeNoteMatches[i + 1]
    const refEnd = nextMatch ? refsHtml.indexOf(nextMatch[0], refStart) : refsHtml.length
    const refHtml = refsHtml.substring(refStart, refEnd)
    
    // Extract reference text
    const textMatch = refHtml.match(/<span[^>]*class=["'][^"']*reference-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
    if (!textMatch) {
      referencesWithNoUrl++
      continue
    }
    
    const refText = textMatch[1]
    
    // Extract all URLs
    const allUrlMatches = Array.from(refText.matchAll(/href=["']([^"']+)["']/gi))
    
    let hasExternalUrl = false
    let hasWikipediaUrl = false
    let externalUrl: string | undefined
    let urlTitle: string | undefined
    
    for (const urlMatch of allUrlMatches) {
      const url = urlMatch[1]
      
      // Check if it's a Wikipedia URL
      if (url.startsWith('./') || url.startsWith('/wiki/') || url.includes('wikipedia.org')) {
        hasWikipediaUrl = true
      } else if (url.startsWith('http') || url.startsWith('//')) {
        hasExternalUrl = true
        if (!externalUrl) {
          externalUrl = url
          // Try to extract title
          const titleMatch = refText.match(/title=["']([^"']+)["']/i)
          urlTitle = titleMatch ? titleMatch[1] : undefined
        }
      }
    }
    
    if (hasExternalUrl && externalUrl) {
      referencesWithExternalUrls++
      externalUrls.push({
        refId,
        url: externalUrl,
        title: urlTitle
      })
    } else if (hasWikipediaUrl) {
      referencesWithWikipediaUrls++
    } else {
      referencesWithNoUrl++
    }
  }

  console.log(`\n=== Reference URL Breakdown ===`)
  console.log(`References with external URLs: ${referencesWithExternalUrls}`)
  console.log(`References with Wikipedia URLs only: ${referencesWithWikipediaUrls}`)
  console.log(`References with no URLs: ${referencesWithNoUrl}`)

  // Get what we have in database
  const monitoring = await prisma.wikipediaMonitoring.findFirst({
    where: {
      patchId: patch.id,
      wikipediaTitle: wikipediaTitle
    },
    include: {
      citations: {
        select: {
          id: true,
          citationUrl: true,
          sourceNumber: true,
          verificationStatus: true,
          scanStatus: true,
          relevanceDecision: true
        },
        orderBy: {
          sourceNumber: 'asc'
        }
      }
    }
  })

  if (!monitoring) {
    console.log(`\n❌ No monitoring entry found`)
    process.exit(1)
  }

  const totalInDatabase = monitoring.citations.length
  const externalInDatabase = monitoring.citations.filter(c => !c.citationUrl.includes('wikipedia.org')).length
  const wikipediaInDatabase = monitoring.citations.filter(c => c.citationUrl.includes('wikipedia.org')).length

  console.log(`\n=== Database Comparison ===`)
  console.log(`Total citations in database: ${totalInDatabase}`)
  console.log(`External URLs in database: ${externalInDatabase}`)
  console.log(`Wikipedia URLs in database: ${wikipediaInDatabase}`)

  console.log(`\n=== Coverage Analysis ===`)
  console.log(`External URLs in REST API HTML: ${referencesWithExternalUrls}`)
  console.log(`External URLs in database: ${externalInDatabase}`)
  
  if (referencesWithExternalUrls > 0) {
    const coverage = ((externalInDatabase / referencesWithExternalUrls) * 100).toFixed(1)
    console.log(`Coverage: ${coverage}%`)
    
    if (externalInDatabase < referencesWithExternalUrls) {
      const missing = referencesWithExternalUrls - externalInDatabase
      console.log(`\n⚠️  MISSING ${missing} external URLs from References section!`)
      
      // Find which ones are missing
      const dbUrls = new Set(monitoring.citations.map(c => c.citationUrl))
      const missingUrls = externalUrls.filter(u => !dbUrls.has(u.url))
      
      console.log(`\nMissing external URLs (first 20):`)
      missingUrls.slice(0, 20).forEach((u, i) => {
        console.log(`  ${i + 1}. [Ref #${u.refId}] ${u.url}`)
        if (u.title) {
          console.log(`     Title: ${u.title.substring(0, 80)}`)
        }
      })
      
      if (missingUrls.length > 20) {
        console.log(`  ... and ${missingUrls.length - 20} more`)
      }
    } else {
      console.log(`\n✅ All external URLs from References section are in database!`)
    }
  } else {
    console.log(`\n⚠️  No external URLs found in REST API HTML References section`)
    console.log(`This suggests the extraction regex might not be matching correctly`)
  }

  // Check if we're using the right extraction method
  console.log(`\n=== Extraction Method Check ===`)
  console.log(`Total references in HTML: ${totalReferences}`)
  console.log(`Total citations in database: ${totalInDatabase}`)
  
  if (totalInDatabase < totalReferences) {
    console.log(`⚠️  Database has fewer citations than references in HTML`)
    console.log(`   This suggests extraction is incomplete or filtering is too aggressive`)
  } else if (totalInDatabase > totalReferences) {
    console.log(`ℹ️  Database has more citations than references in HTML`)
    console.log(`   This suggests we're extracting from other sections (Further reading, External links)`)
  } else {
    console.log(`✅ Counts match - extraction appears complete`)
  }

  // Show first 10 external URLs from HTML vs database
  console.log(`\n=== Sample Comparison ===`)
  console.log(`\nFirst 10 external URLs from HTML:`)
  externalUrls.slice(0, 10).forEach((u, i) => {
    console.log(`  ${i + 1}. [Ref #${u.refId}] ${u.url}`)
  })
  
  console.log(`\nFirst 10 external URLs from database:`)
  monitoring.citations
    .filter(c => !c.citationUrl.includes('wikipedia.org'))
    .slice(0, 10)
    .forEach((c, i) => {
      console.log(`  ${i + 1}. [Ref #${c.sourceNumber}] ${c.citationUrl}`)
    })

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

