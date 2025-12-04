/**
 * Inspect the actual HTML structure of References section
 */

async function main() {
  const wikiTitle = process.argv.find(a => a.startsWith('--wiki-title='))?.split('=')[1] || 'Zionism'

  console.log(`\n=== Inspecting References HTML Structure ===\n`)
  console.log(`Wikipedia Page: ${wikiTitle}\n`)

  // Fetch REST API format
  const restApiUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(wikiTitle)}`
  console.log(`Fetching: ${restApiUrl}\n`)
  
  const restResponse = await fetch(restApiUrl, {
    headers: {
      'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
      'Accept': 'text/html'
    }
  })

  if (!restResponse.ok) {
    console.error(`❌ Failed: HTTP ${restResponse.status}`)
    process.exit(1)
  }

  const html = await restResponse.text()

  // Find References section
  const refsMatch = html.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
  
  if (!refsMatch) {
    console.log(`❌ References <ol> not found`)
    
    // Try finding by h2
    const h2Match = html.match(/<h2[^>]*>.*?References.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
    if (h2Match) {
      console.log(`✅ Found References h2, showing first 2000 chars:`)
      console.log(h2Match[1].substring(0, 2000))
    }
    process.exit(1)
  }

  const refsHtml = refsMatch[1]
  console.log(`✅ Found References <ol> (${refsHtml.length} chars)\n`)

  // Extract first 5 reference items
  const refMatches = Array.from(refsHtml.matchAll(/<li[^>]*id=["']cite_note-(\d+)["'][^>]*>([\s\S]*?)<\/li>/gi))
  
  console.log(`Found ${refMatches.length} reference items\n`)
  console.log(`=== First 5 References (Raw HTML) ===\n`)

  for (let i = 0; i < Math.min(5, refMatches.length); i++) {
    const refMatch = refMatches[i]
    const refId = refMatch[1]
    const refHtml = refMatch[2]
    
    console.log(`\n--- Reference #${refId} (${refHtml.length} chars) ---\n`)
    
    // Show first 1000 chars
    console.log(refHtml.substring(0, 1000))
    if (refHtml.length > 1000) {
      console.log(`\n... (${refHtml.length - 1000} more chars)`)
    }
    
    // Look for citation templates
    const citeWebMatch = refHtml.match(/\{\{cite\s+web[^}]*\}\}/i)
    if (citeWebMatch) {
      console.log(`\n✅ Found cite web template:`)
      console.log(citeWebMatch[0])
    }
    
    // Look for URL attributes
    const urlAttrs = Array.from(refHtml.matchAll(/(?:url|website|access-url|archive-url)=["']([^"']+)["']/gi))
    if (urlAttrs.length > 0) {
      console.log(`\n✅ Found URL attributes:`)
      urlAttrs.forEach((match, idx) => {
        console.log(`  ${idx + 1}. ${match[1]}`)
      })
    }
    
    // Look for <a href>
    const hrefMatches = Array.from(refHtml.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi))
    if (hrefMatches.length > 0) {
      console.log(`\n✅ Found <a href> links:`)
      hrefMatches.forEach((match, idx) => {
        console.log(`  ${idx + 1}. ${match[1]}`)
      })
    }
    
    console.log(`\n${'='.repeat(80)}\n`)
  }

  // Also check for "Works cited" section
  console.log(`\n=== Checking for "Works cited" section ===\n`)
  
  const worksCitedMatch = html.match(/<h2[^>]*>.*?Works\s+cited.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
  if (worksCitedMatch) {
    const worksHtml = worksCitedMatch[1]
    console.log(`✅ Found Works cited section (${worksHtml.length} chars)`)
    console.log(`\nFirst 2000 chars:\n`)
    console.log(worksHtml.substring(0, 2000))
    
    // Count items
    const worksItems = Array.from(worksHtml.matchAll(/<li[^>]*>|^\s*\*\s+/gim))
    console.log(`\n📊 Works cited items: ${worksItems.length}`)
    
    // Look for external URLs
    const worksUrls = Array.from(worksHtml.matchAll(/(https?:\/\/[^\s"'<]+)/gi))
    const worksExternalUrls = worksUrls.filter(m => !m[0].includes('wikipedia.org'))
    console.log(`📊 External URLs in Works cited: ${worksExternalUrls.length}`)
    
    if (worksExternalUrls.length > 0 && worksExternalUrls.length <= 10) {
      console.log(`\nSample URLs:`)
      worksExternalUrls.slice(0, 5).forEach((match, i) => {
        console.log(`  ${i + 1}. ${match[0]}`)
      })
    }
  } else {
    console.log(`❌ Works cited section not found`)
  }

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

