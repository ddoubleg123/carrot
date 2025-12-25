/**
 * Inspect download links structure on Anna's Archive book page
 */

async function inspectDownloads() {
  const bookUrl = 'https://annas-archive.org/md5/dbe898e329267de1a5530f26de6c784a'
  
  console.log(`Fetching: ${bookUrl}\n`)
  
  try {
    const response = await fetch(bookUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://annas-archive.org/'
      },
      signal: AbortSignal.timeout(15000)
    })
    
    if (!response.ok) {
      console.error(`HTTP ${response.status}: ${response.statusText}`)
      return
    }
    
    const html = await response.text()
    
    // Look for "slow downloads" section
    const slowDownloadsMatch = html.match(/slow downloads[\s\S]{0,10000}/i)
    if (slowDownloadsMatch) {
      console.log('=== SLOW DOWNLOADS SECTION ===\n')
      console.log(slowDownloadsMatch[0].substring(0, 2000))
      console.log('\n')
      
      // Look for JavaScript that might generate download URLs
      const jsPattern = /<script[^>]*>[\s\S]{0,5000}slow[\s\S]{0,5000}download[\s\S]{0,5000}<\/script>/gi
      const jsMatches = html.match(jsPattern)
      if (jsMatches) {
        console.log('=== JAVASCRIPT RELATED TO DOWNLOADS ===\n')
        jsMatches.forEach((match, idx) => {
          console.log(`Script ${idx + 1}:`)
          console.log(match.substring(0, 1000))
          console.log('\n')
        })
      }
      
      // Look for data attributes that might contain download info
      const dataPattern = /data-[^=]+="[^"]*download[^"]*"/gi
      const dataMatches = html.match(dataPattern)
      if (dataMatches) {
        console.log('=== DATA ATTRIBUTES WITH DOWNLOAD ===\n')
        dataMatches.slice(0, 10).forEach(attr => console.log(attr))
        console.log('\n')
      }
      
      // Look for onclick handlers
      const onclickPattern = /onclick="[^"]*download[^"]*"/gi
      const onclickMatches = html.match(onclickPattern)
      if (onclickMatches) {
        console.log('=== ONCLICK HANDLERS ===\n')
        onclickMatches.forEach(handler => console.log(handler))
        console.log('\n')
      }
    }
    
    // Look for API endpoints
    const apiPattern = /(?:api|endpoint|fetch|axios)\(['"]([^'"]*download[^'"]*)['"]/gi
    const apiMatches = html.match(apiPattern)
    if (apiMatches) {
      console.log('=== API ENDPOINTS ===\n')
      apiMatches.forEach(match => console.log(match))
      console.log('\n')
    }
    
  } catch (error: any) {
    console.error('Error:', error.message)
  }
}

inspectDownloads().catch(console.error)

