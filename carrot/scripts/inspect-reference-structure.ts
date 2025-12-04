/**
 * Inspect actual reference structure in REST API HTML
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
  
  // Get first few references
  const citeNoteMatches = Array.from(refsHtml.matchAll(/<li[^>]*id=["']cite_note-(\d+)["'][^>]*>/gi))
  
  console.log(`\n=== Analyzing First 5 References ===\n`)
  
  for (let i = 0; i < Math.min(5, citeNoteMatches.length); i++) {
    const match = citeNoteMatches[i]
    const refId = match[1]
    const refStart = refsHtml.indexOf(match[0])
    
    const nextMatch = citeNoteMatches[i + 1]
    const refEnd = nextMatch ? refsHtml.indexOf(nextMatch[0], refStart) : refsHtml.length
    const refHtml = refsHtml.substring(refStart, refEnd)
    
    console.log(`\n--- Reference #${refId} ---`)
    console.log(`Length: ${refHtml.length} chars`)
    
    // Show first 500 chars
    console.log(`\nFirst 500 chars:`)
    console.log(refHtml.substring(0, 500))
    console.log(`...`)
    
    // Check for reference-text span
    const textMatch = refHtml.match(/<span[^>]*class=["'][^"']*reference-text[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
    if (textMatch) {
      const refText = textMatch[1]
      console.log(`\nReference text found (${refText.length} chars)`)
      
      // Find all href attributes
      const allHrefs = Array.from(refText.matchAll(/href=["']([^"']+)["']/gi))
      console.log(`\nAll href attributes found: ${allHrefs.length}`)
      allHrefs.forEach((m, idx) => {
        console.log(`  ${idx + 1}. ${m[1]}`)
      })
      
      // Check for external class
      const externalMatches = Array.from(refText.matchAll(/<a[^>]*class=["'][^"']*external[^"']*["'][^>]*>/gi))
      console.log(`\nLinks with "external" class: ${externalMatches.length}`)
      externalMatches.forEach((m, idx) => {
        // Get the href from this link
        const linkHtml = m[0]
        const hrefMatch = linkHtml.match(/href=["']([^"']+)["']/i)
        if (hrefMatch) {
          console.log(`  ${idx + 1}. ${hrefMatch[1]}`)
        }
      })
      
      // Check for any http/https URLs
      const httpMatches = Array.from(refText.matchAll(/https?:\/\/[^\s"']+/gi))
      console.log(`\nHTTP/HTTPS URLs found: ${httpMatches.length}`)
      httpMatches.forEach((m, idx) => {
        console.log(`  ${idx + 1}. ${m[0]}`)
      })
    } else {
      console.log(`\n⚠️  No reference-text span found`)
    }
  }

  // Also check if there are references elsewhere in the HTML
  console.log(`\n=== Checking for References in Other Sections ===\n`)
  
  // Check for "Further reading" section
  const furtherReadingMatch = html.match(/<h2[^>]*>.*?Further\s+reading.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
  if (furtherReadingMatch) {
    const sectionHtml = furtherReadingMatch[1]
    const links = Array.from(sectionHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi))
    console.log(`Further reading section: ${links.length} links found`)
    links.slice(0, 5).forEach((m, i) => {
      console.log(`  ${i + 1}. ${m[1]}`)
    })
  } else {
    console.log(`Further reading section: NOT FOUND`)
  }
  
  // Check for "External links" section
  const externalLinksMatch = html.match(/<h2[^>]*>.*?External\s+links.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
  if (externalLinksMatch) {
    const sectionHtml = externalLinksMatch[1]
    const links = Array.from(sectionHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi))
    console.log(`\nExternal links section: ${links.length} links found`)
    links.slice(0, 5).forEach((m, i) => {
      console.log(`  ${i + 1}. ${m[1]}`)
    })
  } else {
    console.log(`\nExternal links section: NOT FOUND`)
  }

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

