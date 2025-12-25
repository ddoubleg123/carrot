/**
 * Inspect archive.org page structure to find PDF download links
 */

async function inspectArchiveOrg() {
  const identifier = 'israelrisingland0000doug'
  const url = `https://archive.org/details/${identifier}`
  
  console.log(`Inspecting: ${url}\n`)
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })
    
    if (response.ok) {
      const html = await response.text()
      console.log(`HTML length: ${html.length} chars\n`)
      
      // Save full HTML for inspection
      const fs = await import('fs/promises')
      await fs.mkdir('data', { recursive: true })
      await fs.writeFile('data/archive-org-inspect.html', html)
      console.log(`✅ Saved full HTML to data/archive-org-inspect.html\n`)
      
      // Look for various patterns
      console.log(`=== Looking for PDF-related patterns ===\n`)
      
      // Pattern 1: Direct PDF links
      const pdfLinks = html.match(/href="([^"]*\.pdf[^"]*)"/gi)
      if (pdfLinks) {
        console.log(`Found ${pdfLinks.length} PDF links:`)
        pdfLinks.slice(0, 10).forEach(link => console.log(`  ${link}`))
      }
      
      // Pattern 2: Download links
      const downloadLinks = html.match(/href="([^"]*\/download\/[^"]*)"/gi)
      if (downloadLinks) {
        console.log(`\nFound ${downloadLinks.length} download links:`)
        downloadLinks.slice(0, 10).forEach(link => console.log(`  ${link}`))
      }
      
      // Pattern 3: File data attributes
      const fileData = html.match(/data-file="([^"]+)"/gi)
      if (fileData) {
        console.log(`\nFound ${fileData.length} data-file attributes:`)
        fileData.slice(0, 10).forEach(data => console.log(`  ${data}`))
      }
      
      // Pattern 4: JavaScript variables with file info
      const jsFilePatterns = [
        /downloadUrl['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi,
        /file['"]?\s*[:=]\s*['"]([^'"]*\.pdf[^'"]*)['"]/gi,
        /pdf['"]?\s*[:=]\s*['"]([^'"]+)['"]/gi
      ]
      
      console.log(`\n=== JavaScript file references ===`)
      jsFilePatterns.forEach((pattern, idx) => {
        const matches = [...html.matchAll(pattern)]
        if (matches.length > 0) {
          console.log(`\nPattern ${idx + 1}: Found ${matches.length} matches`)
          matches.slice(0, 5).forEach(match => console.log(`  ${match[1]}`))
        }
      })
      
      // Pattern 5: Look for file list in JSON
      const jsonPattern = /"files":\s*\[([^\]]+)\]/gi
      const jsonMatches = [...html.matchAll(jsonPattern)]
      if (jsonMatches.length > 0) {
        console.log(`\n=== JSON file data ===`)
        jsonMatches.slice(0, 2).forEach(match => {
          console.log(`  ${match[0].substring(0, 200)}...`)
        })
      }
      
      // Pattern 6: Look for specific file formats
      const formats = ['pdf', 'epub', 'djvu', 'txt']
      formats.forEach(format => {
        const pattern = new RegExp(`href="([^"]*\\.${format}[^"]*)"`, 'gi')
        const matches = [...html.matchAll(pattern)]
        if (matches.length > 0) {
          console.log(`\n=== ${format.toUpperCase()} files ===`)
          matches.slice(0, 5).forEach(match => {
            let url = match[1]
            if (url.startsWith('/')) {
              url = `https://archive.org${url}`
            }
            console.log(`  ${url}`)
          })
        }
      })
      
      // Pattern 7: Look for file size/format info
      const fileInfoPattern = /(\d+)\s*(?:MB|KB|bytes).*?\.pdf/gi
      const fileInfo = [...html.matchAll(fileInfoPattern)]
      if (fileInfo.length > 0) {
        console.log(`\n=== File size info ===`)
        fileInfo.slice(0, 5).forEach(match => console.log(`  ${match[0]}`))
      }
      
    } else {
      console.error(`Error: ${response.status} ${response.statusText}`)
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`)
  }
}

inspectArchiveOrg().catch(console.error)

