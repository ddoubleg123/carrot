/**
 * Test extraction with breakdown of Wikipedia vs External URLs
 * Run with: npx tsx scripts/test-extraction-breakdown.ts
 */

async function testExtractionBreakdown() {
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
    console.log(`Total URLs Found: ${citations.length}\n`)
    
    // Separate Wikipedia vs External
    const wikipediaUrls: typeof citations = []
    const externalUrls: typeof citations = []
    
    citations.forEach(cit => {
      if (cit.url.includes('wikipedia.org')) {
        wikipediaUrls.push(cit)
      } else {
        externalUrls.push(cit)
      }
    })
    
    console.log(`📚 Wikipedia URLs: ${wikipediaUrls.length}`)
    console.log(`🌐 External URLs: ${externalUrls.length}\n`)
    
    // Group by section
    const bySection = citations.reduce((acc, cit) => {
      const section = cit.context || 'Unknown'
      if (!acc[section]) acc[section] = []
      acc[section].push(cit)
      return acc
    }, {} as Record<string, typeof citations>)
    
    console.log('Breakdown by section:')
    Object.entries(bySection).forEach(([section, urls]) => {
      const wikiCount = urls.filter(u => u.url.includes('wikipedia.org')).length
      const extCount = urls.length - wikiCount
      console.log(`  ${section}: ${urls.length} total (${wikiCount} Wikipedia, ${extCount} external)`)
    })
    
    console.log(`\n📋 Sample External URLs (first 10):`)
    externalUrls.slice(0, 10).forEach((cit, i) => {
      console.log(`${i + 1}. ${cit.url}`)
      if (cit.title) console.log(`   Title: ${cit.title}`)
    })
    
    console.log(`\n📚 Sample Wikipedia URLs (first 10):`)
    wikipediaUrls.slice(0, 10).forEach((cit, i) => {
      console.log(`${i + 1}. ${cit.url}`)
      if (cit.title) console.log(`   Title: ${cit.title}`)
    })
    
  } catch (error: any) {
    console.error('Error:', error.message)
    console.error(error)
  }
}

testExtractionBreakdown().catch(console.error)

