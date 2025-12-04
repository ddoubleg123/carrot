/**
 * Deep inspection of Wikipedia references to understand actual structure
 * Goal: Find all 439 external URLs
 */

async function main() {
  const wikiTitle = process.argv.find(a => a.startsWith('--wiki-title='))?.split('=')[1] || 'Zionism'

  console.log(`\n=== Deep Reference Inspection ===\n`)
  console.log(`Wikipedia Page: ${wikiTitle}\n`)

  // Method 1: REST API HTML
  console.log(`=== Method 1: REST API HTML ===\n`)
  const restApiUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(wikiTitle)}`
  const restResponse = await fetch(restApiUrl, {
    headers: { 'User-Agent': 'CarrotBot/1.0', 'Accept': 'text/html' }
  })
  
  if (restResponse.ok) {
    const restHtml = await restResponse.text()
    console.log(`✅ REST API HTML: ${restHtml.length} bytes`)
    
    // Count ALL <a href> tags with http/https
    const allLinks = Array.from(restHtml.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi))
    console.log(`Total <a href> with http/https: ${allLinks.length}`)
    
    // Filter out Wikipedia URLs
    const externalLinks = allLinks.filter(m => {
      const url = m[1]
      return !url.includes('wikipedia.org') && 
             !url.includes('wikimedia.org') && 
             !url.includes('wikidata.org')
    })
    console.log(`External URLs (excluding Wikipedia): ${externalLinks.length}`)
    
    // Count in References section specifically
    const refsMatch = restHtml.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
    if (refsMatch) {
      const refsHtml = refsMatch[1]
      const refLinks = Array.from(refsHtml.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi))
      const refExternalLinks = refLinks.filter(m => {
        const url = m[1]
        return !url.includes('wikipedia.org') && 
               !url.includes('wikimedia.org') && 
               !url.includes('wikidata.org')
      })
      console.log(`External URLs in References <ol>: ${refExternalLinks.length}`)
      
      // Also check for data attributes, citation templates, etc.
      const dataUrlMatches = Array.from(refsHtml.matchAll(/data-url=["']([^"']+)["']/gi))
      const templateUrlMatches = Array.from(refsHtml.matchAll(/(?:url|website|access-url|archive-url)=["']([^"']+)["']/gi))
      console.log(`data-url attributes: ${dataUrlMatches.length}`)
      console.log(`Template URL attributes: ${templateUrlMatches.length}`)
    }
  }

  // Method 2: Regular HTML (browser-rendered)
  console.log(`\n=== Method 2: Regular HTML ===\n`)
  const regularUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`
  const regularResponse = await fetch(regularUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }
  })
  
  if (regularResponse.ok) {
    const regularHtml = await regularResponse.text()
    console.log(`✅ Regular HTML: ${regularHtml.length} bytes`)
    
    // Count ALL <a href> tags with http/https
    const allLinks = Array.from(regularHtml.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi))
    console.log(`Total <a href> with http/https: ${allLinks.length}`)
    
    // Filter out Wikipedia URLs
    const externalLinks = allLinks.filter(m => {
      const url = m[1]
      return !url.includes('wikipedia.org') && 
             !url.includes('wikimedia.org') && 
             !url.includes('wikidata.org')
    })
    console.log(`External URLs (excluding Wikipedia): ${externalLinks.length}`)
    
    // Count in References section
    const refsMatch = regularHtml.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
    if (refsMatch) {
      const refsHtml = refsMatch[1]
      const refLinks = Array.from(refsHtml.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi))
      const refExternalLinks = refLinks.filter(m => {
        const url = m[1]
        return !url.includes('wikipedia.org') && 
               !url.includes('wikimedia.org') && 
               !url.includes('wikidata.org')
      })
      console.log(`External URLs in References <ol>: ${refExternalLinks.length}`)
    }
  }

  // Method 3: MediaWiki API (wikitext)
  console.log(`\n=== Method 3: MediaWiki API (Wikitext) ===\n`)
  const mwApiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(wikiTitle)}&format=json&origin=*`
  const mwResponse = await fetch(mwApiUrl, {
    headers: { 'User-Agent': 'CarrotBot/1.0' }
  })
  
  if (mwResponse.ok) {
    const mwData = await mwResponse.json()
    const pages = mwData.query?.pages
    if (pages) {
      const pageId = Object.keys(pages)[0]
      const wikitext = pages[pageId]?.revisions?.[0]?.slots?.main?.content
      
      if (wikitext) {
        console.log(`✅ Wikitext: ${wikitext.length} chars`)
        
        // Count citation templates
        const citeWebMatches = Array.from(wikitext.matchAll(/\{\{cite\s+web[^}]*\}\}/gi))
        const citeJournalMatches = Array.from(wikitext.matchAll(/\{\{cite\s+journal[^}]*\}\}/gi))
        const citeBookMatches = Array.from(wikitext.matchAll(/\{\{cite\s+book[^}]*\}\}/gi))
        const citeNewsMatches = Array.from(wikitext.matchAll(/\{\{cite\s+news[^}]*\}\}/gi))
        const citeMatches = Array.from(wikitext.matchAll(/\{\{cite[^}]*\}\}/gi))
        
        console.log(`{{cite web}} templates: ${citeWebMatches.length}`)
        console.log(`{{cite journal}} templates: ${citeJournalMatches.length}`)
        console.log(`{{cite book}} templates: ${citeBookMatches.length}`)
        console.log(`{{cite news}} templates: ${citeNewsMatches.length}`)
        console.log(`Total {{cite *}} templates: ${citeMatches.length}`)
        
        // Extract URLs from citation templates
        const urlMatches = Array.from(wikitext.matchAll(/\|\s*url\s*=\s*([^|\n}]+)/gi))
        const websiteMatches = Array.from(wikitext.matchAll(/\|\s*website\s*=\s*([^|\n}]+)/gi))
        const accessUrlMatches = Array.from(wikitext.matchAll(/\|\s*access-url\s*=\s*([^|\n}]+)/gi))
        
        console.log(`|url= parameters: ${urlMatches.length}`)
        console.log(`|website= parameters: ${websiteMatches.length}`)
        console.log(`|access-url= parameters: ${accessUrlMatches.length}`)
        
        // Filter external URLs
        const allTemplateUrls = [
          ...urlMatches.map(m => m[1].trim()),
          ...websiteMatches.map(m => m[1].trim()),
          ...accessUrlMatches.map(m => m[1].trim())
        ].filter(url => {
          const clean = url.replace(/['"]/g, '').trim()
          return clean.startsWith('http') && 
                 !clean.includes('wikipedia.org') &&
                 !clean.includes('wikimedia.org')
        })
        
        console.log(`External URLs from templates: ${allTemplateUrls.length}`)
        
        if (allTemplateUrls.length > 0 && allTemplateUrls.length <= 20) {
          console.log(`\nSample template URLs:`)
          allTemplateUrls.slice(0, 10).forEach((url, i) => {
            console.log(`  ${i + 1}. ${url}`)
          })
        }
      }
    }
  }

  // Method 4: Check "Works cited" section
  console.log(`\n=== Method 4: Works Cited Section ===\n`)
  const restApiUrl2 = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(wikiTitle)}`
  const restResponse2 = await fetch(restApiUrl2, {
    headers: { 'User-Agent': 'CarrotBot/1.0', 'Accept': 'text/html' }
  })
  
  if (restResponse2.ok) {
    const restHtml = await restResponse2.text()
    const worksMatch = restHtml.match(/<h2[^>]*>.*?Works\s+cited.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
    if (worksMatch) {
      const worksHtml = worksMatch[1]
      const worksLinks = Array.from(worksHtml.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi))
      const worksExternalLinks = worksLinks.filter(m => {
        const url = m[1]
        return !url.includes('wikipedia.org') && 
               !url.includes('wikimedia.org') && 
               !url.includes('wikidata.org')
      })
      console.log(`External URLs in Works cited (<a href>): ${worksExternalLinks.length}`)
      
      // Also check for plain text URLs
      const plainUrls = Array.from(worksHtml.matchAll(/(https?:\/\/[^\s"'<]+)/gi))
      const plainExternalUrls = plainUrls.filter(m => {
        const url = m[1]
        return !url.includes('wikipedia.org') && 
               !url.includes('wikimedia.org') && 
               !url.includes('wikidata.org')
      })
      console.log(`Plain text URLs in Works cited: ${plainExternalUrls.length}`)
      
      // Count <li> items in Works cited
      const worksLiMatches = Array.from(worksHtml.matchAll(/<li[^>]*>/gi))
      console.log(`<li> items in Works cited: ${worksLiMatches.length}`)
      
      // Show sample URLs
      if (worksExternalLinks.length > 0) {
        console.log(`\nSample external URLs from Works cited:`)
        worksExternalLinks.slice(0, 10).forEach((match, i) => {
          console.log(`  ${i + 1}. ${match[1]}`)
        })
      }
    } else {
      console.log(`Works cited section not found`)
    }
  }

  console.log(`\n=== Summary ===\n`)
  console.log(`Run this script to see where the 439 external URLs are located.`)
  console.log(`Then we can fix the extraction logic accordingly.`)

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

