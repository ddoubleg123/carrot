/**
 * Inspect a specific book page to understand its structure
 */

async function inspectBookPage() {
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
    console.log(`HTML length: ${html.length} characters\n`)
    
    // Look for the book description specifically
    console.log('=== SEARCHING FOR BOOK DESCRIPTION ===\n')
    
    // Look for "A unique visual story" which we saw in the error message
    const descriptionMatch = html.match(/A unique visual story[\s\S]{0,1000}/i)
    if (descriptionMatch) {
      console.log('Found description text:')
      console.log(descriptionMatch[0].substring(0, 500))
      console.log('\n')
    }
    
    // Find all data-content attributes with longer text
    const dataContentPattern = /data-content="([^"]{200,})"/gi
    const matches: string[] = []
    let match
    
    while ((match = dataContentPattern.exec(html)) !== null) {
      const text = match[1]
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .trim()
      
      if (text.length > 200 && text.includes('unique') && text.includes('visual')) {
        matches.push(text)
      }
    }
    
    if (matches.length > 0) {
      console.log(`Found ${matches.length} potential descriptions:\n`)
      matches.forEach((m, idx) => {
        console.log(`${idx + 1}. ${m.substring(0, 300)}...`)
        console.log('')
      })
    }
    
    // Also look for the description in the HTML structure
    const descriptionHtml = html.match(/Save description[\s\S]{0,2000}/i)
    if (descriptionHtml) {
      console.log('=== HTML AROUND "Save description" ===\n')
      console.log(descriptionHtml[0].substring(0, 1000))
    }
    
  } catch (error: any) {
    console.error('Error:', error.message)
  }
}

inspectBookPage().catch(console.error)

