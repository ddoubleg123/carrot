/**
 * Analyze Zionism page references - compare actual vs extracted
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

  // Fetch the actual Wikipedia page HTML
  console.log(`\n=== Fetching Zionism Wikipedia Page ===\n`)
  const wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikipediaTitle)}`
  
  let html: string
  try {
    const response = await fetch(wikipediaUrl, {
      headers: {
        'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }
    
    html = await response.text()
    console.log(`✅ Fetched Wikipedia page HTML (${html.length} bytes)`)
  } catch (error) {
    console.error(`❌ Failed to fetch Wikipedia page:`, error)
    process.exit(1)
  }

  // Count references in References section
  const referencesMatch = html.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
  
  if (!referencesMatch) {
    console.log(`❌ No References section found in HTML`)
    process.exit(1)
  }

  const refsHtml = referencesMatch[1]
  const refMatches = Array.from(refsHtml.matchAll(/<li[^>]*id=["']cite_note-(\d+)["'][^>]*>/gi))
  
  const totalReferencesInHTML = refMatches.length
  console.log(`\n=== References Section Analysis ===`)
  console.log(`Total reference items in HTML: ${totalReferencesInHTML}`)

  // Count references with external URLs
  let referencesWithExternalUrls = 0
  let referencesWithWikipediaUrls = 0
  let referencesWithNoUrl = 0
  
  for (const refMatch of refMatches) {
    const refId = refMatch[1]
    const refHtml = refMatch[0]
    
    // Find the full reference content
    const refStart = html.indexOf(refMatch[0])
    const nextRefMatch = html.substring(refStart + refMatch[0].length).match(/<li[^>]*id=["']cite_note-(\d+)["'][^>]*>/i)
    const refEnd = nextRefMatch ? refStart + refMatch[0].length + html.substring(refStart + refMatch[0].length).indexOf(nextRefMatch[0]) : html.length
    const fullRefHtml = html.substring(refStart, refEnd)
    
    // Extract reference text
    const textMatch = fullRefHtml.match(/<span[^>]*class=["'][^"']*reference-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
    if (!textMatch) {
      referencesWithNoUrl++
      continue
    }
    
    const refText = textMatch[1]
    
    // Extract all URLs from this reference
    const urlMatches = Array.from(refText.matchAll(/href=["']([^"']+)["']/gi))
    
    let hasExternalUrl = false
    let hasWikipediaUrl = false
    
    for (const urlMatch of urlMatches) {
      const url = urlMatch[1]
      
      // Check if it's a Wikipedia URL
      if (url.startsWith('./') || url.startsWith('/wiki/') || url.includes('wikipedia.org')) {
        hasWikipediaUrl = true
      } else if (url.startsWith('http') || url.startsWith('//')) {
        hasExternalUrl = true
      }
    }
    
    if (hasExternalUrl) {
      referencesWithExternalUrls++
    } else if (hasWikipediaUrl) {
      referencesWithWikipediaUrls++
    } else {
      referencesWithNoUrl++
    }
  }

  console.log(`\n--- Reference URL Breakdown ---`)
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
        }
      }
    }
  })

  if (!monitoring) {
    console.log(`\n❌ No monitoring entry found for "${wikipediaTitle}"`)
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
  console.log(`References with external URLs in HTML: ${referencesWithExternalUrls}`)
  console.log(`External URLs in database: ${externalInDatabase}`)
  console.log(`Coverage: ${((externalInDatabase / referencesWithExternalUrls) * 100).toFixed(1)}%`)

  if (externalInDatabase < referencesWithExternalUrls) {
    const missing = referencesWithExternalUrls - externalInDatabase
    console.log(`\n⚠️  MISSING ${missing} external URLs from References section!`)
    
    // Try to identify which ones are missing
    console.log(`\n--- Analyzing Missing References ---`)
    
    // Extract external URLs from HTML
    const externalUrlsFromHTML: Array<{ refId: string; url: string; title?: string }> = []
    
    for (const refMatch of refMatches) {
      const refId = refMatch[1]
      const refStart = html.indexOf(refMatch[0])
      const nextRefMatch = html.substring(refStart + refMatch[0].length).match(/<li[^>]*id=["']cite_note-(\d+)["'][^>]*>/i)
      const refEnd = nextRefMatch ? refStart + refMatch[0].length + html.substring(refStart + refMatch[0].length).indexOf(nextRefMatch[0]) : html.length
      const fullRefHtml = html.substring(refStart, refEnd)
      
      const textMatch = fullRefHtml.match(/<span[^>]*class=["'][^"']*reference-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
      if (!textMatch) continue
      
      const refText = textMatch[1]
      
      // Extract external URLs
      const urlMatches = Array.from(refText.matchAll(/href=["']([^"']+)["']/gi))
      
      for (const urlMatch of urlMatches) {
        const url = urlMatch[1]
        
        // Skip Wikipedia URLs
        if (url.startsWith('./') || url.startsWith('/wiki/') || url.includes('wikipedia.org')) {
          continue
        }
        
        // Only count external URLs
        if (url.startsWith('http') || url.startsWith('//')) {
          const titleMatch = refText.match(/title=["']([^"']+)["']/i)
          externalUrlsFromHTML.push({
            refId,
            url,
            title: titleMatch ? titleMatch[1] : undefined
          })
        }
      }
    }

    // Check which ones are in database
    const dbUrls = new Set(monitoring.citations.map(c => c.citationUrl))
    const missingUrls = externalUrlsFromHTML.filter(u => !dbUrls.has(u.url))

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

    // Check extraction method used
    console.log(`\n--- Extraction Method Analysis ---`)
    console.log(`Checking which extraction method was used...`)
    
    // Check if we used WikipediaSource or extractWikipediaCitationsWithContext
    // This would be in logs, but we can infer from the count
    if (totalInDatabase < referencesWithExternalUrls) {
      console.log(`⚠️  Extraction appears incomplete - only ${totalInDatabase} citations stored vs ${referencesWithExternalUrls} expected external URLs`)
    }
  } else {
    console.log(`\n✅ All external URLs from References section are in database!`)
  }

  // Check verification status
  console.log(`\n=== Verification Status ===`)
  const verified = monitoring.citations.filter(c => c.verificationStatus === 'verified').length
  const failed = monitoring.citations.filter(c => c.verificationStatus === 'failed').length
  const pending = monitoring.citations.filter(c => c.verificationStatus === 'pending').length
  
  console.log(`Verified: ${verified}`)
  console.log(`Failed: ${failed}`)
  console.log(`Pending: ${pending}`)

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

