/**
 * Test accessing the archive.org link directly
 */

async function testArchiveOrg() {
  const archiveUrl = 'https://archive.org/details/israelrisingland0000doug'
  
  console.log(`Testing archive.org link: ${archiveUrl}\n`)
  
  try {
    const response = await fetch(archiveUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(30000)
    })
    
    console.log(`Status: ${response.status}`)
    console.log(`Content-Type: ${response.headers.get('content-type')}`)
    console.log(`Final URL: ${response.url}`)
    
    if (response.ok) {
      const html = await response.text()
      console.log(`\nHTML length: ${html.length}`)
      
      // Look for download/view links
      const downloadPatterns = [
        /href="([^"]*\.pdf)"/gi,
        /href="([^"]*download[^"]*)"/gi,
        /href="([^"]*stream[^"]*)"/gi,
        /href="([^"]*read[^"]*)"/gi
      ]
      
      console.log(`\n=== Download/View Links ===\n`)
      for (const pattern of downloadPatterns) {
        const matches = [...html.matchAll(pattern)]
        if (matches.length > 0) {
          console.log(`Pattern: ${pattern}`)
          matches.slice(0, 5).forEach(match => {
            let url = match[1]
            if (url.startsWith('/')) {
              url = `https://archive.org${url}`
            }
            console.log(`  - ${url}`)
          })
        }
      }
      
      // Look for book description
      const descPattern = /<meta[^>]*name="description"[^>]*content="([^"]+)"/i
      const descMatch = html.match(descPattern)
      if (descMatch) {
        console.log(`\n=== Description ===\n${descMatch[1]}\n`)
      }
      
      // Save a snippet
      const fs = await import('fs/promises')
      await fs.writeFile('carrot/data/archive-org-page.html', html.substring(0, 50000))
      console.log(`\n✅ Saved HTML snippet to carrot/data/archive-org-page.html`)
    }
    
  } catch (error: any) {
    console.error('Error:', error.message)
  }
}

testArchiveOrg().catch(console.error)

