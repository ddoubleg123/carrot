/**
 * Test comprehensive external URL extraction
 * Run with: npx tsx scripts/test-comprehensive-extraction.ts
 */

async function testExtraction() {
  try {
    // Fetch Apartheid page HTML
    const response = await fetch('https://en.wikipedia.org/wiki/Apartheid', {
      headers: {
        'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }
    
    const html = await response.text()
    
    // Import extraction function
    const { extractAllExternalUrls } = await import('../src/lib/discovery/wikiUtils')
    
    const citations = extractAllExternalUrls(html, 'https://en.wikipedia.org/wiki/Apartheid')
    
    console.log(`\n📊 Comprehensive Extraction Results:\n`)
    console.log(`Total External URLs Found: ${citations.length}\n`)
    
    // Group by section
    const bySection = citations.reduce((acc, cit) => {
      const section = cit.context || 'Unknown'
      if (!acc[section]) acc[section] = []
      acc[section].push(cit)
      return acc
    }, {} as Record<string, typeof citations>)
    
    console.log('Breakdown by section:')
    Object.entries(bySection).forEach(([section, urls]) => {
      console.log(`  ${section}: ${urls.length}`)
    })
    
    console.log(`\n📋 Sample URLs (first 20):`)
    citations.slice(0, 20).forEach((cit, i) => {
      console.log(`${i + 1}. ${cit.url}`)
      if (cit.title) console.log(`   Title: ${cit.title}`)
      if (cit.context && cit.context !== cit.title) console.log(`   Context: ${cit.context}`)
    })
    
  } catch (error: any) {
    console.error('Error:', error.message)
    console.error(error)
  }
}

testExtraction().catch(console.error)

