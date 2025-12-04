/**
 * Find ALL external URLs from Wikipedia references
 * Looking for: archive URLs, source URLs, access URLs, etc.
 */

async function main() {
  const wikiTitle = process.argv.find(a => a.startsWith('--wiki-title='))?.split('=')[1] || 'Zionism'

  console.log(`\n=== Finding ALL Reference URLs ===\n`)
  console.log(`Wikipedia Page: ${wikiTitle}\n`)

  // Fetch REST API HTML
  const restApiUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(wikiTitle)}`
  const restResponse = await fetch(restApiUrl, {
    headers: { 'User-Agent': 'CarrotBot/1.0', 'Accept': 'text/html' }
  })
  
  if (!restResponse.ok) {
    console.error(`❌ Failed: HTTP ${restResponse.status}`)
    process.exit(1)
  }

  const html = await restResponse.text()
  console.log(`✅ Fetched HTML: ${html.length} bytes\n`)

  const allExternalUrls = new Set<string>()
  const urlSources: Array<{ url: string; source: string; context?: string }> = []

  // Helper to check if URL is external (not Wikipedia)
  function isExternalUrl(url: string): boolean {
    if (!url.startsWith('http') && !url.startsWith('//')) return false
    if (url.includes('wikipedia.org') || url.includes('wikimedia.org') || url.includes('wikidata.org')) {
      return false
    }
    return true
  }

  // Method 1: Extract from References <ol> section
  console.log(`=== Method 1: References <ol> Section ===\n`)
  const refsMatch = html.match(/<ol[^>]*class=["'][^"']*references[^"']*["'][^>]*>([\s\S]*?)<\/ol>/i)
  if (refsMatch) {
    const refsHtml = refsMatch[1]
    const refMatches = refsHtml.matchAll(/<li[^>]*id=["']cite_note-(\d+)["'][^>]*>([\s\S]*?)<\/li>/gi)
    
    let refCount = 0
    let urlCount = 0
    
    for (const refMatch of refMatches) {
      refCount++
      const refId = refMatch[1]
      const refHtml = refMatch[2]
      
      // Extract ALL URLs from this reference
      const urlPatterns = [
        // Standard <a href>
        /<a[^>]+href=["']([^"']+)["'][^>]*>/gi,
        // data-url attributes
        /data-url=["']([^"']+)["']/gi,
        // Plain text URLs
        /(https?:\/\/[^\s"'<]+)/gi,
        // Citation template attributes
        /(?:url|website|access-url|archive-url|archiveurl)=["']([^"']+)["']/gi
      ]
      
      for (const pattern of urlPatterns) {
        const matches = Array.from(refHtml.matchAll(pattern))
        for (const match of matches) {
          const url = match[1] || match[0]
          if (isExternalUrl(url)) {
            if (!allExternalUrls.has(url)) {
              allExternalUrls.add(url)
              urlCount++
              urlSources.push({
                url,
                source: `References <ol> - Ref #${refId}`,
                context: refHtml.substring(0, 200)
              })
            }
          }
        }
      }
    }
    
    console.log(`References found: ${refCount}`)
    console.log(`External URLs found: ${urlCount}`)
  } else {
    console.log(`References <ol> not found`)
  }

  // Method 2: Extract from "Works cited" section
  console.log(`\n=== Method 2: Works Cited Section ===\n`)
  const worksMatch = html.match(/<h2[^>]*>.*?Works\s+cited.*?<\/h2>([\s\S]*?)(?:<h2|$)/i)
  if (worksMatch) {
    const worksHtml = worksMatch[1]
    
    // Count <li> items
    const liMatches = Array.from(worksHtml.matchAll(/<li[^>]*>/gi))
    console.log(`<li> items in Works cited: ${liMatches.length}`)
    
    // Extract ALL URLs from Works cited
    const urlPatterns = [
      // Standard <a href>
      /<a[^>]+href=["']([^"']+)["'][^>]*>/gi,
      // "Archived from the original" links (archive.org, web.archive.org, etc.)
      /<a[^>]*class=["'][^"']*external[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>.*?Archived.*?from.*?the.*?original/gi,
      // Plain text URLs
      /(https?:\/\/[^\s"'<]+)/gi,
      // Citation template attributes
      /(?:url|website|access-url|archive-url|archiveurl)=["']([^"']+)["']/gi
    ]
    
    let worksUrlCount = 0
    for (const pattern of urlPatterns) {
      const matches = Array.from(worksHtml.matchAll(pattern))
      for (const match of matches) {
        const url = match[1] || match[0]
        if (isExternalUrl(url)) {
          if (!allExternalUrls.has(url)) {
            allExternalUrls.add(url)
            worksUrlCount++
            urlSources.push({
              url,
              source: 'Works cited',
              context: worksHtml.substring(Math.max(0, match.index! - 100), match.index! + 200)
            })
          }
        }
      }
    }
    
    console.log(`External URLs found in Works cited: ${worksUrlCount}`)
    
    // Also check for "Archived from" pattern specifically
    const archivedMatches = Array.from(worksHtml.matchAll(/Archived\s+from\s+the\s+original[^<]*<a[^>]+href=["']([^"']+)["'][^>]*>/gi))
    const archivedUrls = new Set<string>()
    for (const match of archivedMatches) {
      const url = match[1]
      if (isExternalUrl(url)) {
        archivedUrls.add(url)
      }
    }
    console.log(`"Archived from the original" URLs: ${archivedUrls.size}`)
    
    // Show sample
    if (archivedUrls.size > 0 && archivedUrls.size <= 10) {
      console.log(`\nSample archived URLs:`)
      Array.from(archivedUrls).slice(0, 5).forEach((url, i) => {
        console.log(`  ${i + 1}. ${url}`)
      })
    }
  } else {
    console.log(`Works cited section not found`)
  }

  // Method 3: Extract ALL external URLs from entire page (in References/Works cited area)
  console.log(`\n=== Method 3: All External URLs in References Area ===\n`)
  
  // Find the References section and everything after it
  const refsSectionMatch = html.match(/<h2[^>]*>.*?References.*?<\/h2>([\s\S]*?)(?:<h2[^>]*>.*?See\s+also|$)/i)
  if (refsSectionMatch) {
    const refsAreaHtml = refsSectionMatch[1]
    
    // Extract ALL http/https URLs
    const allUrlMatches = Array.from(refsAreaHtml.matchAll(/(https?:\/\/[^\s"'<]+)/gi))
    const externalUrlMatches = allUrlMatches.filter(m => {
      const url = m[1]
      return isExternalUrl(url)
    })
    
    console.log(`Total URLs in References area: ${allUrlMatches.length}`)
    console.log(`External URLs in References area: ${externalUrlMatches.length}`)
    
    // Deduplicate
    const uniqueUrls = new Set(externalUrlMatches.map(m => m[1]))
    console.log(`Unique external URLs: ${uniqueUrls.size}`)
    
    // Show breakdown by domain
    const domainCounts = new Map<string, number>()
    uniqueUrls.forEach(url => {
      try {
        const domain = new URL(url).hostname.replace(/^www\./, '')
        domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1)
      } catch {}
    })
    
    console.log(`\nTop domains:`)
    Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([domain, count]) => {
        console.log(`  ${domain}: ${count}`)
      })
  }

  // Summary
  console.log(`\n=== Summary ===\n`)
  console.log(`Total unique external URLs found: ${allExternalUrls.size}`)
  console.log(`\nBreakdown by source:`)
  const sourceCounts = new Map<string, number>()
  urlSources.forEach(({ source }) => {
    const baseSource = source.split(' - ')[0]
    sourceCounts.set(baseSource, (sourceCounts.get(baseSource) || 0) + 1)
  })
  sourceCounts.forEach((count, source) => {
    console.log(`  ${source}: ${count}`)
  })

  // Show first 20 URLs
  if (allExternalUrls.size > 0) {
    console.log(`\nFirst 20 external URLs:`)
    Array.from(allExternalUrls).slice(0, 20).forEach((url, i) => {
      console.log(`  ${i + 1}. ${url}`)
    })
  }

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

