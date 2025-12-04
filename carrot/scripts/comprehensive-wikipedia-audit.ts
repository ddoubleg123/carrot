/**
 * Comprehensive Wikipedia page audit
 * Counts all references, external URLs, and compares with database
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  const args = process.argv.slice(2)
  const patchHandle = args.find(a => a.startsWith('--patch='))?.split('=')[1] || 'israel'
  const wikiTitle = args.find(a => a.startsWith('--wiki-title='))?.split('=')[1] || 'Zionism'

  console.log(`\n=== Comprehensive Wikipedia Page Audit ===\n`)
  console.log(`Patch: ${patchHandle}`)
  console.log(`Wikipedia Page: ${wikiTitle}\n`)

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  // Fetch Wikipedia page HTML (regular format)
  const wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`
  console.log(`Fetching: ${wikipediaUrl}`)
  
  const response = await fetch(wikipediaUrl, {
    headers: {
      'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
      'Accept': 'text/html'
    }
  })

  if (!response.ok) {
    console.error(`❌ Failed to fetch: HTTP ${response.status}`)
    process.exit(1)
  }

  const html = await response.text()
  console.log(`✅ Fetched HTML (${html.length} bytes)\n`)

  // Also fetch REST API format
  const restApiUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(wikiTitle)}`
  console.log(`Fetching REST API: ${restApiUrl}`)
  
  const restResponse = await fetch(restApiUrl, {
    headers: {
      'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
      'Accept': 'text/html'
    }
  })

  let restHtml: string | null = null
  if (restResponse.ok) {
    restHtml = await restResponse.text()
    console.log(`✅ Fetched REST API HTML (${restHtml.length} bytes)\n`)
  } else {
    console.log(`⚠️  REST API fetch failed: HTTP ${restResponse.status}\n`)
  }

  // ============================================
  // 1. COUNT REFERENCES IN REFERENCES SECTION
  // ============================================
  console.log(`=== 1. References Section Analysis ===\n`)

  // Method 1: Count cite_note items in regular HTML
  const citeNoteMatches = Array.from(html.matchAll(/id=["']cite_note-(\d+)["']/gi))
  console.log(`Regular HTML - cite_note items: ${citeNoteMatches.length}`)

  // Method 2: Count in REST API HTML
  let restCiteNotes = 0
  if (restHtml) {
    const restCiteMatches = Array.from(restHtml.matchAll(/id=["']cite_note-(\d+)["']/gi))
    restCiteNotes = restCiteMatches.length
    console.log(`REST API HTML - cite_note items: ${restCiteNotes}`)
  }

  // Method 3: Count <li> items in References <ol>
  const referencesMatch = html.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
  let refsInOl = 0
  if (referencesMatch) {
    const refsHtml = referencesMatch[1]
    const liMatches = Array.from(refsHtml.matchAll(/<li[^>]*>/gi))
    refsInOl = liMatches.length
    console.log(`References <ol> - <li> items: ${refsInOl}`)
  } else {
    console.log(`References <ol> - NOT FOUND`)
  }

  // Method 4: Count in REST API References section
  let restRefsInOl = 0
  if (restHtml) {
    const restRefsMatch = restHtml.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
    if (restRefsMatch) {
      const restRefsHtml = restRefsMatch[1]
      const restLiMatches = Array.from(restRefsHtml.matchAll(/<li[^>]*>/gi))
      restRefsInOl = restLiMatches.length
      console.log(`REST API References <ol> - <li> items: ${restRefsInOl}`)
    }
  }

  // Method 5: Count "Works cited" references
  const worksCitedMatch = html.match(/<h2[^>]*>.*?Works\s+cited.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
  let worksCitedCount = 0
  if (worksCitedMatch) {
    const worksCitedHtml = worksCitedMatch[1]
    // Count <li> items or bullet points
    const worksLiMatches = Array.from(worksCitedHtml.matchAll(/<li[^>]*>|^\s*\*\s+/gim))
    worksCitedCount = worksLiMatches.length
    console.log(`Works cited section - items: ${worksCitedCount}`)
  } else {
    console.log(`Works cited section - NOT FOUND`)
  }

  console.log(`\n📊 Total References Estimate: ${Math.max(citeNoteMatches.length, restCiteNotes, refsInOl, restRefsInOl, worksCitedCount)}`)

  // ============================================
  // 2. EXTRACT EXTERNAL URLs FROM REFERENCES
  // ============================================
  console.log(`\n=== 2. External URLs in References Section ===\n`)

  let externalUrlsInRefs = 0
  const externalUrlsFromRefs: string[] = []

  if (restHtml) {
    // Use REST API HTML for extraction
    const refsMatch = restHtml.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
    if (refsMatch) {
      const refsHtml = refsMatch[1]
      const refMatches = refsHtml.matchAll(/<li[^>]*id=["']cite_note-(\d+)["'][^>]*>([\s\S]*?)<\/li>/gi)
      
      for (const refMatch of refMatches) {
        const refHtml = refMatch[2]
        
        // Extract reference text
        const textMatch = refHtml.match(/<span[^>]*class=["'][^"']*reference-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
        if (!textMatch) continue
        
        const refText = textMatch[1]
        
        // Try multiple extraction methods
        const urlPatterns = [
          // Pattern 1: <a href="http...">
          /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi,
          // Pattern 2: Citation template attributes
          /(?:url|website|access-url|archive-url)=["']([^"']+)["']/gi,
          // Pattern 3: Direct HTTP/HTTPS in text
          /(https?:\/\/[^\s"'<]+)/gi
        ]
        
        for (const pattern of urlPatterns) {
          const matches = Array.from(refText.matchAll(pattern))
          for (const match of matches) {
            const url = match[1] || match[0]
            
            // Skip Wikipedia URLs
            if (url.includes('wikipedia.org') || url.includes('wikimedia.org') || url.includes('wikidata.org')) {
              continue
            }
            
            // Skip relative links
            if (url.startsWith('./') || url.startsWith('/wiki/') || url.startsWith('../')) {
              continue
            }
            
            // Only count http/https URLs
            if (url.startsWith('http') || url.startsWith('//')) {
              if (!externalUrlsFromRefs.includes(url)) {
                externalUrlsFromRefs.push(url)
                externalUrlsInRefs++
              }
            }
          }
        }
      }
    }
  }

  console.log(`External URLs found in References section: ${externalUrlsInRefs}`)
  if (externalUrlsInRefs > 0 && externalUrlsInRefs <= 20) {
    console.log(`\nSample URLs from References:`)
    externalUrlsFromRefs.slice(0, 10).forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`)
    })
  }

  // ============================================
  // 3. EXTRACT FROM FURTHER READING
  // ============================================
  console.log(`\n=== 3. Further Reading Section ===\n`)

  const furtherReadingMatch = html.match(/<h2[^>]*>.*?Further\s+reading.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
  let furtherReadingUrls = 0
  if (furtherReadingMatch) {
    const sectionHtml = furtherReadingMatch[1]
    const linkMatches = Array.from(sectionHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi))
    
    for (const match of linkMatches) {
      const url = match[1]
      if (url.startsWith('http') || url.startsWith('//')) {
        if (!url.includes('wikipedia.org') && !url.includes('wikimedia.org')) {
          furtherReadingUrls++
        }
      }
    }
    console.log(`External URLs in Further reading: ${furtherReadingUrls}`)
  } else {
    console.log(`Further reading section - NOT FOUND`)
  }

  // ============================================
  // 4. EXTRACT FROM EXTERNAL LINKS
  // ============================================
  console.log(`\n=== 4. External Links Section ===\n`)

  const externalLinksMatch = html.match(/<h2[^>]*>.*?External\s+links.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
  let externalLinksUrls = 0
  if (externalLinksMatch) {
    const sectionHtml = externalLinksMatch[1]
    const linkMatches = Array.from(sectionHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi))
    
    for (const match of linkMatches) {
      const url = match[1]
      if (url.startsWith('http') || url.startsWith('//')) {
        if (!url.includes('wikipedia.org') && !url.includes('wikimedia.org')) {
          externalLinksUrls++
        }
      }
    }
    console.log(`External URLs in External links: ${externalLinksUrls}`)
  } else {
    console.log(`External links section - NOT FOUND`)
  }

  // ============================================
  // 5. TOTAL EXTERNAL URLs
  // ============================================
  console.log(`\n=== 5. Total External URLs Summary ===\n`)
  const totalExternalUrls = externalUrlsInRefs + furtherReadingUrls + externalLinksUrls
  console.log(`References section: ${externalUrlsInRefs}`)
  console.log(`Further reading: ${furtherReadingUrls}`)
  console.log(`External links: ${externalLinksUrls}`)
  console.log(`TOTAL: ${totalExternalUrls}`)

  // ============================================
  // 6. COMPARE WITH DATABASE
  // ============================================
  console.log(`\n=== 6. Database Comparison ===\n`)

  const monitoring = await prisma.wikipediaMonitoring.findFirst({
    where: {
      patchId: patch.id,
      wikipediaTitle: wikiTitle
    },
    include: {
      citations: {
        where: {
          citationUrl: {
            not: { contains: 'wikipedia.org' }
          },
          scanStatus: {
            not: 'scanned_denied'
          }
        },
        select: {
          citationUrl: true,
          sourceNumber: true,
          citationContext: true
        }
      }
    }
  })

  if (monitoring) {
    const dbExternalUrls = monitoring.citations.length
    console.log(`External URLs in database: ${dbExternalUrls}`)
    console.log(`Expected total: ${totalExternalUrls}`)
    console.log(`Coverage: ${((dbExternalUrls / totalExternalUrls) * 100).toFixed(1)}%`)
    
    if (dbExternalUrls < totalExternalUrls) {
      const missing = totalExternalUrls - dbExternalUrls
      console.log(`\n⚠️  Missing ${missing} external URLs from database`)
    }

    // Check section breakdown in database
    const bySection = monitoring.citations.reduce((acc, c) => {
      const section = c.citationContext?.includes('[References]') ? 'References' :
                     c.citationContext?.includes('[Further reading]') ? 'Further reading' :
                     c.citationContext?.includes('[External links]') ? 'External links' : 'Unknown'
      acc[section] = (acc[section] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log(`\nDatabase section breakdown:`)
    Object.entries(bySection).forEach(([section, count]) => {
      console.log(`  ${section}: ${count}`)
    })
  } else {
    console.log(`No monitoring entry found`)
  }

  // ============================================
  // 7. SAMPLE REFERENCES ANALYSIS
  // ============================================
  console.log(`\n=== 7. Sample References Analysis ===\n`)

  if (restHtml) {
    const refsMatch = restHtml.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
    if (refsMatch) {
      const refsHtml = refsMatch[1]
      const refMatches = Array.from(refsHtml.matchAll(/<li[^>]*id=["']cite_note-(\d+)["'][^>]*>([\s\S]*?)<\/li>/gi))
      
      console.log(`Analyzing first 10 references for external URLs:\n`)
      
      for (let i = 0; i < Math.min(10, refMatches.length); i++) {
        const refMatch = refMatches[i]
        const refId = refMatch[1]
        const refHtml = refMatch[2]
        
        const textMatch = refHtml.match(/<span[^>]*class=["'][^"']*reference-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
        if (!textMatch) {
          console.log(`Ref #${refId}: No reference text found`)
          continue
        }
        
        const refText = textMatch[1]
        
        // Check for external URLs
        const httpMatches = Array.from(refText.matchAll(/(https?:\/\/[^\s"'<]+)/gi))
        const wikipediaMatches = Array.from(refText.matchAll(/(https?:\/\/[^\s"'<]*wikipedia[^\s"'<]*)/gi))
        const templateMatches = Array.from(refText.matchAll(/(?:url|website|access-url|archive-url)=["']([^"']+)["']/gi))
        
        const externalUrls = httpMatches.filter(m => !wikipediaMatches.some(w => w[0] === m[0]))
        
        console.log(`Ref #${refId}:`)
        console.log(`  External URLs: ${externalUrls.length}`)
        console.log(`  Wikipedia URLs: ${wikipediaMatches.length}`)
        console.log(`  Template attributes: ${templateMatches.length}`)
        
        if (externalUrls.length > 0) {
          console.log(`  Sample: ${externalUrls[0][0].substring(0, 80)}...`)
        } else if (templateMatches.length > 0) {
          console.log(`  Template URL: ${templateMatches[0][1].substring(0, 80)}...`)
        }
        console.log()
      }
    }
  }

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

