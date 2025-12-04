/**
 * Find external URLs in References section - check different formats
 */

async function main() {
  const wikipediaTitle = 'Zionism'
  const restApiUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(wikipediaTitle)}`
  
  console.log(`\n=== Fetching REST API HTML ===\n`)
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
  const citeNoteMatches = Array.from(refsHtml.matchAll(/<li[^>]*id=["']cite_note-(\d+)["'][^>]*>/gi))
  
  console.log(`\n=== Searching for External URLs in References ===\n`)
  console.log(`Total references: ${citeNoteMatches.length}\n`)
  
  let foundExternalUrls = 0
  let foundWikipediaUrls = 0
  
  for (let i = 0; i < citeNoteMatches.length; i++) {
    const match = citeNoteMatches[i]
    const refId = match[1]
    const refStart = refsHtml.indexOf(match[0])
    
    const nextMatch = citeNoteMatches[i + 1]
    const refEnd = nextMatch ? refsHtml.indexOf(nextMatch[0], refStart) : refsHtml.length
    const refHtml = refsHtml.substring(refStart, refEnd)
    
    // Try multiple patterns to find external URLs
    const patterns = [
      // Pattern 1: href="http..." or href="https..."
      /href=["'](https?:\/\/[^"']+)["']/gi,
      // Pattern 2: href="//..." (protocol-relative)
      /href=["'](\/\/[^"']+)["']/gi,
      // Pattern 3: Just look for http:// or https:// anywhere
      /(https?:\/\/[^\s"'<]+)/gi,
      // Pattern 4: Look for URLs in citation templates (cite web, cite book, etc.)
      /(?:url|website|access-url|archive-url)=["']([^"']+)["']/gi
    ]
    
    let foundUrl: string | undefined
    
    for (const pattern of patterns) {
      const matches = Array.from(refHtml.matchAll(pattern))
      for (const m of matches) {
        const url = m[1] || m[0]
        
        // Skip Wikipedia URLs
        if (url.includes('wikipedia.org') || url.startsWith('./') || url.startsWith('/wiki/')) {
          continue
        }
        
        // Check if it's an external URL
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
          foundUrl = url
          foundExternalUrls++
          console.log(`✅ Ref #${refId}: ${url}`)
          break
        }
      }
      if (foundUrl) break
    }
    
    // Also check for Wikipedia URLs
    if (!foundUrl) {
      const wikiMatches = Array.from(refHtml.matchAll(/href=["'](\.\/[^"']+|https?:\/\/[^"']*wikipedia[^"']*)["']/gi))
      if (wikiMatches.length > 0) {
        foundWikipediaUrls++
      }
    }
  }
  
  console.log(`\n=== Summary ===`)
  console.log(`References with external URLs: ${foundExternalUrls}`)
  console.log(`References with Wikipedia URLs only: ${foundWikipediaUrls}`)
  console.log(`References with no URLs: ${citeNoteMatches.length - foundExternalUrls - foundWikipediaUrls}`)
  
  if (foundExternalUrls === 0) {
    console.log(`\n⚠️  No external URLs found in References section using standard patterns`)
    console.log(`   This suggests external URLs might be in citation templates or formatted differently`)
    console.log(`   Let's check a sample reference more carefully...`)
    
    // Show a sample reference that might have an external URL
    if (citeNoteMatches.length > 0) {
      const sampleRef = citeNoteMatches[Math.floor(citeNoteMatches.length / 2)]
      const refId = sampleRef[1]
      const refStart = refsHtml.indexOf(sampleRef[0])
      const nextMatch = citeNoteMatches[citeNoteMatches.indexOf(sampleRef) + 1]
      const refEnd = nextMatch ? refsHtml.indexOf(nextMatch[0], refStart) : refsHtml.length
      const refHtml = refsHtml.substring(refStart, refEnd)
      
      console.log(`\n--- Sample Reference #${refId} (full HTML) ---`)
      console.log(refHtml.substring(0, 2000))
      console.log(`...`)
    }
  }

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

