/**
 * Inspect Anna's Archive HTML structure to improve parsing
 */

async function inspectHTML() {
  console.log('=== INSPECTING ANNA\'S ARCHIVE HTML ===\n')
  
  const searchUrl = 'https://annas-archive.org/search?q=Israel+history&lang=en'
  
  console.log(`Fetching: ${searchUrl}\n`)
  
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      signal: AbortSignal.timeout(15000)
    })
    
    if (!response.ok) {
      console.error(`HTTP ${response.status}: ${response.statusText}`)
      return
    }
    
    const html = await response.text()
    console.log(`HTML length: ${html.length} characters\n`)
    
    // Look for common patterns
    console.log('=== SEARCHING FOR COMMON PATTERNS ===\n')
    
    // Look for result containers
    const resultPatterns = [
      /<div[^>]*class="[^"]*result[^"]*"/gi,
      /<div[^>]*class="[^"]*book[^"]*"/gi,
      /<div[^>]*class="[^"]*item[^"]*"/gi,
      /<tr[^>]*class="[^"]*result[^"]*"/gi,
      /<article[^>]*>/gi,
      /data-testid="[^"]*result[^"]*"/gi
    ]
    
    resultPatterns.forEach((pattern, idx) => {
      const matches = html.match(pattern)
      if (matches) {
        console.log(`Pattern ${idx + 1} found: ${matches.length} matches`)
      }
    })
    
    // Look for title patterns
    console.log('\n=== SEARCHING FOR TITLE PATTERNS ===\n')
    const titlePatterns = [
      /<h[123][^>]*>([^<]+)<\/h[123]>/gi,
      /<a[^>]*href="[^"]*"[^>]*>([^<]+)<\/a>/gi,
      /title="([^"]+)"/gi,
      /<span[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/span>/gi
    ]
    
    titlePatterns.forEach((pattern, idx) => {
      const matches = [...html.matchAll(pattern)]
      if (matches.length > 0) {
        console.log(`Title pattern ${idx + 1} found: ${matches.length} matches`)
        console.log(`  First 3 examples:`)
        matches.slice(0, 3).forEach(m => {
          console.log(`    - ${m[1]?.substring(0, 60)}`)
        })
      }
    })
    
    // Save a sample of HTML for inspection
    const sampleStart = html.indexOf('<body')
    const sampleEnd = Math.min(sampleStart + 5000, html.length)
    const sample = html.substring(sampleStart, sampleEnd)
    
    console.log('\n=== HTML SAMPLE (first 5000 chars of body) ===\n')
    console.log(sample)
    
    // Look for specific Anna's Archive structure
    console.log('\n=== LOOKING FOR ANNA\'S ARCHIVE SPECIFIC STRUCTURE ===\n')
    
    // Check if it's a table-based layout
    if (html.includes('<table')) {
      console.log('✓ Uses <table> structure')
      const tableMatches = html.match(/<table[^>]*>[\s\S]{0,2000}/gi)
      if (tableMatches) {
        console.log(`Found ${tableMatches.length} tables`)
        console.log('Sample table structure:')
        console.log(tableMatches[0]?.substring(0, 500))
      }
    }
    
    // Check for data attributes
    const dataAttrs = html.match(/data-[^=]+="[^"]+"/gi)
    if (dataAttrs) {
      console.log(`\nFound ${dataAttrs.length} data attributes`)
      console.log('Sample data attributes:')
      dataAttrs.slice(0, 10).forEach(attr => console.log(`  ${attr}`))
    }
    
  } catch (error: any) {
    console.error('Error:', error.message)
    console.error(error.stack)
  }
}

inspectHTML().catch(console.error)

