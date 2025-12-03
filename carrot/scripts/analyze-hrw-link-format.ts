/**
 * Analyze how the HRW URL appears in the Wikipedia page
 * Run with: npx tsx scripts/analyze-hrw-link-format.ts
 */

async function analyzeHRWLinkFormat() {
  const targetUrl = 'https://www.hrw.org/news/2020/05/12/israel-discriminatory-land-policies-hem-palestinians'
  
  try {
    // Fetch the Apartheid page
    const response = await fetch('https://en.wikipedia.org/wiki/Apartheid', {
      headers: {
        'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const html = await response.text()
    
    console.log(`\n🔍 Analyzing HRW URL format in Wikipedia page...\n`)
    console.log(`Target URL: ${targetUrl}\n`)

    // Find all occurrences of the URL or parts of it
    const searchTerms = [
      'israel-discriminatory-land-policies-hem-palestinians',
      'hrw.org/news/2020/05/12',
      'discriminatory-land-policies'
    ]

    for (const term of searchTerms) {
      const index = html.toLowerCase().indexOf(term.toLowerCase())
      if (index !== -1) {
        // Get context around the match
        const start = Math.max(0, index - 200)
        const end = Math.min(html.length, index + 500)
        const context = html.substring(start, end)
        
        console.log(`✅ Found "${term}" in HTML:`)
        console.log(`   Position: ${index}`)
        console.log(`   Context:\n${context}\n`)
        console.log(`   ` + '='.repeat(80) + `\n`)
      }
    }

    // Try to find it in different sections
    console.log(`\n📋 Checking different sections:\n`)

    // Check References section
    const refsMatch = html.match(/<ol[^>]*class="[^"]*references[^"]*"[^>]*>([\s\S]*?)<\/ol>/i)
    if (refsMatch) {
      const refsHtml = refsMatch[1]
      if (refsHtml.toLowerCase().includes('israel-discriminatory-land-policies')) {
        console.log(`✅ Found in References section`)
        // Find the specific reference
        const refMatches = refsHtml.match(/<li[^>]*>[\s\S]*?israel-discriminatory[\s\S]*?<\/li>/gi)
        if (refMatches) {
          console.log(`   Reference HTML:\n${refMatches[0].substring(0, 1000)}\n`)
        }
      } else {
        console.log(`❌ Not found in References section`)
      }
    }

    // Check External links
    const extLinksMatch = html.match(/<h2[^>]*>.*?External\s+links.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
    if (extLinksMatch) {
      const extHtml = extLinksMatch[1]
      if (extHtml.toLowerCase().includes('israel-discriminatory-land-policies')) {
        console.log(`✅ Found in External links section`)
        // Find the specific link
        const linkMatches = extHtml.match(/<a[^>]*>[\s\S]*?israel-discriminatory[\s\S]*?<\/a>/gi)
        if (linkMatches) {
          console.log(`   Link HTML:\n${linkMatches[0]}\n`)
        }
      } else {
        console.log(`❌ Not found in External links section`)
      }
    }

    // Check Further reading
    const furtherMatch = html.match(/<h2[^>]*>.*?Further\s+reading.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
    if (furtherMatch) {
      const furtherHtml = furtherMatch[1]
      if (furtherHtml.toLowerCase().includes('israel-discriminatory-land-policies')) {
        console.log(`✅ Found in Further reading section`)
      } else {
        console.log(`❌ Not found in Further reading section`)
      }
    }

    // Test our extraction function
    console.log(`\n🧪 Testing our extraction function...\n`)
    const { extractAllExternalUrls } = await import('../src/lib/discovery/wikiUtils')
    const extracted = extractAllExternalUrls(html, 'https://en.wikipedia.org/wiki/Apartheid')
    
    const foundInExtracted = extracted.find(c => 
      c.url.includes('israel-discriminatory-land-policies-hem-palestinians') ||
      c.url.includes('hrw.org/news/2020/05/12')
    )

    if (foundInExtracted) {
      console.log(`✅ URL WAS EXTRACTED by our function!`)
      console.log(`   Extracted URL: ${foundInExtracted.url}`)
      console.log(`   Title: ${foundInExtracted.title || 'N/A'}`)
      console.log(`   Context: ${foundInExtracted.context || 'N/A'}`)
    } else {
      console.log(`❌ URL WAS NOT EXTRACTED by our function`)
      console.log(`   This means our extraction regex/pattern didn't match it`)
      console.log(`   Total URLs extracted: ${extracted.length}`)
      console.log(`   HRW URLs extracted: ${extracted.filter(c => c.url.includes('hrw.org')).length}`)
    }

  } catch (error: any) {
    console.error('Error:', error.message)
    console.error(error)
  }
}

analyzeHRWLinkFormat().catch(console.error)

