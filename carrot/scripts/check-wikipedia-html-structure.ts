/**
 * Check Wikipedia HTML structure to understand how references are formatted
 */

async function main() {
  const wikipediaTitle = 'Zionism'
  const wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikipediaTitle)}`
  
  console.log(`\n=== Fetching Wikipedia Page ===\n`)
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
    console.log(`✅ Fetched HTML (${html.length} bytes)`)
  } catch (error) {
    console.error(`❌ Failed to fetch:`, error)
    process.exit(1)
  }

  // Try different patterns for References section
  console.log(`\n=== Looking for References Section ===\n`)
  
  // Pattern 1: <ol class="references">
  const pattern1 = html.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>/i)
  console.log(`Pattern 1 (<ol class="references">): ${pattern1 ? 'FOUND' : 'NOT FOUND'}`)
  
  // Pattern 2: <div class="reflist">
  const pattern2 = html.match(/<div[^>]*class=["'][^"']*reflist[^"']*["'][^>]*>/i)
  console.log(`Pattern 2 (<div class="reflist">): ${pattern2 ? 'FOUND' : 'NOT FOUND'}`)
  
  // Pattern 3: <h2>References</h2>
  const pattern3 = html.match(/<h2[^>]*>.*?References.*?<\/h2>/i)
  console.log(`Pattern 3 (<h2>References</h2>): ${pattern3 ? 'FOUND' : 'NOT FOUND'}`)
  
  if (pattern3) {
    console.log(`\nFound References heading, extracting section...`)
    const refsSectionMatch = html.match(/<h2[^>]*>.*?References.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
    if (refsSectionMatch) {
      const refsSection = refsSectionMatch[1]
      console.log(`References section length: ${refsSection.length} chars`)
      
      // Count cite_note items
      const citeNotes = refsSection.matchAll(/id=["']cite_note-(\d+)["']/gi)
      const citeNoteArray = Array.from(citeNotes)
      console.log(`\nFound ${citeNoteArray.length} cite_note items`)
      
      if (citeNoteArray.length > 0) {
        console.log(`\nFirst 5 cite_note IDs:`)
        citeNoteArray.slice(0, 5).forEach((match, i) => {
          console.log(`  ${i + 1}. cite_note-${match[1]}`)
        })
      }
      
      // Check for external links in first few references
      console.log(`\n=== Analyzing First 3 References ===`)
      for (let i = 0; i < Math.min(3, citeNoteArray.length); i++) {
        const match = citeNoteArray[i]
        const refId = match[1]
        const refIdIndex = refsSection.indexOf(match[0])
        
        // Find the full reference (until next cite_note or </li>)
        const nextMatch = citeNoteArray[i + 1]
        const refEnd = nextMatch ? refsSection.indexOf(nextMatch[0], refIdIndex) : refsSection.length
        const refHtml = refsSection.substring(refIdIndex, refEnd)
        
        console.log(`\nReference #${refId}:`)
        console.log(`  Length: ${refHtml.length} chars`)
        
        // Check for external URLs
        const externalUrlMatches = Array.from(refHtml.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi))
        const wikipediaUrlMatches = Array.from(refHtml.matchAll(/href=["'](\.\/[^"']+|https?:\/\/[^"']*wikipedia[^"']*)["']/gi))
        
        console.log(`  External URLs: ${externalUrlMatches.length}`)
        console.log(`  Wikipedia URLs: ${wikipediaUrlMatches.length}`)
        
        if (externalUrlMatches.length > 0) {
          console.log(`  External URL examples:`)
          externalUrlMatches.slice(0, 3).forEach((m, idx) => {
            console.log(`    ${idx + 1}. ${m[1]}`)
          })
        }
      }
    }
  }
  
  // Also check REST API format
  console.log(`\n=== Checking REST API Format ===\n`)
  try {
    const restApiUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(wikipediaTitle)}`
    const restResponse = await fetch(restApiUrl, {
      headers: {
        'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
        'Accept': 'text/html'
      }
    })
    
    if (restResponse.ok) {
      const restHtml = await restResponse.text()
      console.log(`✅ Fetched REST API HTML (${restHtml.length} bytes)`)
      
      // Check for references in REST API format
      const restRefsMatch = restHtml.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>/i)
      console.log(`REST API has <ol class="references">: ${restRefsMatch ? 'YES' : 'NO'}`)
      
      if (restRefsMatch) {
        const restRefsSection = restHtml.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
        if (restRefsSection) {
          const restRefsHtml = restRefsSection[1]
          const restCiteNotes = Array.from(restRefsHtml.matchAll(/id=["']cite_note-(\d+)["']/gi))
          console.log(`REST API has ${restCiteNotes.length} cite_note items`)
        }
      }
    }
  } catch (error) {
    console.log(`⚠️  Could not fetch REST API format:`, error)
  }

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

