/**
 * Test accessing the wait page directly
 */

async function testWaitPage() {
  const slowDownloadUrl = 'https://annas-archive.org/slow_download/dbe898e329267de1a5530f26de6c784a/0/2'
  
  console.log(`Testing wait page: ${slowDownloadUrl}\n`)
  
  try {
    // First request - might get redirected or get the wait page
    const response = await fetch(slowDownloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://annas-archive.org/md5/dbe898e329267de1a5530f26de6c784a'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(30000)
    })
    
    console.log(`Status: ${response.status}`)
    console.log(`Content-Type: ${response.headers.get('content-type')}`)
    console.log(`Location: ${response.headers.get('location') || 'none'}`)
    console.log(`Final URL: ${response.url}`)
    
    if (response.ok) {
      const html = await response.text()
      console.log(`\nHTML length: ${html.length}`)
      console.log(`\n=== HTML Preview (first 2000 chars) ===\n`)
      console.log(html.substring(0, 2000))
      
      // Look for wait-related text
      if (html.includes('wait') || html.includes('5 seconds') || html.includes('Please wait')) {
        console.log(`\n✅ Found wait page content`)
        
        // Look for the download now link
        const downloadNowPatterns = [
          /download now/gi,
          /Download Now/gi,
          /href="([^"]*download[^"]*)"/gi
        ]
        
        for (const pattern of downloadNowPatterns) {
          const matches = html.match(pattern)
          if (matches) {
            console.log(`\nFound matches for pattern: ${pattern}`)
            console.log(matches.slice(0, 5))
          }
        }
      }
      
      // Save full HTML for inspection
      const fs = await import('fs/promises')
      await fs.writeFile('carrot/data/wait-page.html', html)
      console.log(`\n✅ Saved full HTML to carrot/data/wait-page.html`)
    }
    
  } catch (error: any) {
    console.error('Error:', error.message)
  }
}

testWaitPage().catch(console.error)

