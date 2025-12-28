/**
 * Check what was actually saved to production database
 * Compares discovered sources vs saved content
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const PATCH_HANDLE = 'israel'

async function main() {
  console.log(`\n📊 Checking Saved Content Statistics for: ${PATCH_HANDLE}\n`)
  
  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, title: true }
  })
  
  if (!patch) {
    console.error(`❌ Patch "${PATCH_HANDLE}" not found`)
    process.exit(1)
  }
  
  console.log(`Patch: ${patch.title}`)
  console.log(`Patch ID: ${patch.id}\n`)
  
  // Get latest discovery run
  const latestRun = await (prisma as any).discoveryRun.findMany({
    where: { patchId: patch.id },
    orderBy: { id: 'desc' },
    take: 1
  })
  
  const runId = latestRun[0]?.id
  const runStartedAt = latestRun[0]?.startedAt
  
  console.log(`Latest Discovery Run:`)
  console.log(`  Run ID: ${runId || 'None'}`)
  console.log(`  Started: ${runStartedAt ? new Date(runStartedAt).toISOString() : 'N/A'}`)
  console.log(`  Status: ${latestRun[0]?.status || 'N/A'}\n`)
  
  // Get all discovered content for this patch
  const allContent = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      sourceDomain: true,
      category: true,
      createdAt: true,
      relevanceScore: true,
      qualityScore: true,
      textContent: true,
      metadata: true
    }
  })
  
  console.log(`\n📦 TOTAL DISCOVERED CONTENT: ${allContent.length} items\n`)
  
  // Filter by source
  const wikipediaContent = allContent.filter(c => 
    c.sourceDomain?.includes('wikipedia.org') || 
    c.sourceUrl?.includes('wikipedia.org')
  )
  
  const newsContent = allContent.filter(c => {
    const domain = c.sourceDomain?.toLowerCase() || ''
    const url = c.sourceUrl?.toLowerCase() || ''
    return (
      domain.includes('news') ||
      domain.includes('bbc') ||
      domain.includes('reuters') ||
      domain.includes('cnn') ||
      domain.includes('theguardian') ||
      url.includes('news') ||
      c.category === 'news' ||
      (c.metadata as any)?.source === 'NewsAPI'
    )
  })
  
  const annasArchiveContent = allContent.filter(c => {
    const domain = c.sourceDomain?.toLowerCase() || ''
    const url = c.sourceUrl?.toLowerCase() || ''
    return (
      domain.includes('annas-archive.org') ||
      url.includes('annas-archive.org') ||
      c.category === 'book' ||
      (c.metadata as any)?.source === "Anna's Archive"
    )
  })
  
  // Get content from the latest run (if we have a run timestamp)
  let recentContent: typeof allContent = []
  if (runStartedAt) {
    const runTime = new Date(runStartedAt)
    recentContent = allContent.filter(c => new Date(c.createdAt) >= runTime)
    
    console.log(`\n🆕 CONTENT FROM LATEST RUN (since ${runTime.toISOString()}):`)
    console.log(`  Total items: ${recentContent.length}`)
    
    const recentWikipedia = recentContent.filter(c => 
      c.sourceDomain?.includes('wikipedia.org') || 
      c.sourceUrl?.includes('wikipedia.org')
    )
    
    const recentNews = recentContent.filter(c => {
      const domain = c.sourceDomain?.toLowerCase() || ''
      const url = c.sourceUrl?.toLowerCase() || ''
      return (
        domain.includes('news') ||
        domain.includes('bbc') ||
        domain.includes('reuters') ||
        url.includes('news') ||
        c.category === 'news'
      )
    })
    
    const recentAnnasArchive = recentContent.filter(c => {
      const domain = c.sourceDomain?.toLowerCase() || ''
      const url = c.sourceUrl?.toLowerCase() || ''
      return (
        domain.includes('annas-archive.org') ||
        url.includes('annas-archive.org') ||
        c.category === 'book'
      )
    })
    
    console.log(`  - Wikipedia: ${recentWikipedia.length}`)
    console.log(`  - News: ${recentNews.length}`)
    console.log(`  - Anna's Archive: ${recentAnnasArchive.length}`)
    console.log(`  - Other: ${recentContent.length - recentWikipedia.length - recentNews.length - recentAnnasArchive.length}\n`)
  }
  
  // Statistics by source
  console.log(`\n📊 CONTENT BY SOURCE (All Time):`)
  console.log(`  Wikipedia: ${wikipediaContent.length} items`)
  console.log(`  News: ${newsContent.length} items`)
  console.log(`  Anna's Archive: ${annasArchiveContent.length} items`)
  console.log(`  Other: ${allContent.length - wikipediaContent.length - newsContent.length - annasArchiveContent.length} items\n`)
  
  // Wikipedia statistics
  if (wikipediaContent.length > 0) {
    console.log(`\n📚 WIKIPEDIA CONTENT DETAILS:`)
    console.log(`  Total saved: ${wikipediaContent.length}`)
    
    const withText = wikipediaContent.filter(c => c.textContent && c.textContent.length > 100)
    const avgTextLength = wikipediaContent.length > 0
      ? Math.round(wikipediaContent.reduce((sum, c) => sum + (c.textContent?.length || 0), 0) / wikipediaContent.length)
      : 0
    const avgRelevance = wikipediaContent.length > 0
      ? Math.round(wikipediaContent.reduce((sum, c) => sum + (c.relevanceScore || 0), 0) / wikipediaContent.length)
      : 0
    
    console.log(`  Items with text (>100 chars): ${withText.length}`)
    console.log(`  Average text length: ${avgTextLength.toLocaleString()} chars`)
    console.log(`  Average relevance score: ${avgRelevance}`)
    
    // Show sample titles
    console.log(`  \n  Sample items:`)
    wikipediaContent.slice(0, 5).forEach((item, idx) => {
      console.log(`    ${idx + 1}. ${item.title?.substring(0, 60) || 'No title'}...`)
      console.log(`       URL: ${item.sourceUrl?.substring(0, 70) || 'N/A'}...`)
      console.log(`       Text: ${(item.textContent?.length || 0).toLocaleString()} chars, Relevance: ${item.relevanceScore || 'N/A'}`)
    })
  }
  
  // News statistics
  if (newsContent.length > 0) {
    console.log(`\n📰 NEWS CONTENT DETAILS:`)
    console.log(`  Total saved: ${newsContent.length}`)
    
    const withText = newsContent.filter(c => c.textContent && c.textContent.length > 100)
    const avgTextLength = newsContent.length > 0
      ? Math.round(newsContent.reduce((sum, c) => sum + (c.textContent?.length || 0), 0) / newsContent.length)
      : 0
    const avgRelevance = newsContent.length > 0
      ? Math.round(newsContent.reduce((sum, c) => sum + (c.relevanceScore || 0), 0) / newsContent.length)
      : 0
    
    console.log(`  Items with text (>100 chars): ${withText.length}`)
    console.log(`  Average text length: ${avgTextLength.toLocaleString()} chars`)
    console.log(`  Average relevance score: ${avgRelevance}`)
    
    // Group by domain
    const byDomain = new Map<string, number>()
    newsContent.forEach(c => {
      const domain = c.sourceDomain || 'unknown'
      byDomain.set(domain, (byDomain.get(domain) || 0) + 1)
    })
    
    console.log(`  \n  By domain:`)
    Array.from(byDomain.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([domain, count]) => {
        console.log(`    - ${domain}: ${count} items`)
      })
    
    // Show sample titles
    console.log(`  \n  Sample items:`)
    newsContent.slice(0, 5).forEach((item, idx) => {
      console.log(`    ${idx + 1}. ${item.title?.substring(0, 60) || 'No title'}...`)
      console.log(`       Domain: ${item.sourceDomain || 'N/A'}`)
      console.log(`       Text: ${(item.textContent?.length || 0).toLocaleString()} chars, Relevance: ${item.relevanceScore || 'N/A'}`)
    })
  }
  
  // Anna's Archive statistics
  if (annasArchiveContent.length > 0) {
    console.log(`\n📚 ANNA'S ARCHIVE CONTENT DETAILS:`)
    console.log(`  Total saved: ${annasArchiveContent.length}`)
    
    const withText = annasArchiveContent.filter(c => c.textContent && c.textContent.length > 100)
    const avgTextLength = annasArchiveContent.length > 0
      ? Math.round(annasArchiveContent.reduce((sum, c) => sum + (c.textContent?.length || 0), 0) / annasArchiveContent.length)
      : 0
    const avgRelevance = annasArchiveContent.length > 0
      ? Math.round(annasArchiveContent.reduce((sum, c) => sum + (c.relevanceScore || 0), 0) / annasArchiveContent.length)
      : 0
    
    console.log(`  Items with text (>100 chars): ${withText.length}`)
    console.log(`  Average text length: ${avgTextLength.toLocaleString()} chars`)
    console.log(`  Average relevance score: ${avgRelevance}`)
    
    // Show sample titles
    console.log(`  \n  Sample items:`)
    annasArchiveContent.slice(0, 10).forEach((item, idx) => {
      console.log(`    ${idx + 1}. ${item.title?.substring(0, 60) || 'No title'}...`)
      console.log(`       URL: ${item.sourceUrl?.substring(0, 70) || 'N/A'}...`)
      console.log(`       Text: ${(item.textContent?.length || 0).toLocaleString()} chars, Relevance: ${item.relevanceScore || 'N/A'}`)
    })
  }
  
  // Get Wikipedia citations (separate from discovered content)
  const wikipediaCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id }
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      relevanceDecision: true,
      scanStatus: true,
      createdAt: true
    }
  })
  
  const savedCitations = wikipediaCitations.filter(c => c.relevanceDecision === 'saved')
  const processedCitations = wikipediaCitations.filter(c => c.scanStatus === 'scanned')
  
  console.log(`\n\n🔗 WIKIPEDIA CITATIONS (Separate from DiscoveredContent):`)
  console.log(`  Total citations found: ${wikipediaCitations.length}`)
  console.log(`  Citations processed (scanned): ${processedCitations.length}`)
  console.log(`  Citations saved: ${savedCitations.length}`)
  console.log(`  Citations pending: ${wikipediaCitations.length - processedCitations.length}\n`)
  
  // Comparison with what was discovered
  console.log(`\n📊 DISCOVERY VS SAVED COMPARISON:`)
  console.log(`  From audit logs, we discovered:`)
  console.log(`    - Wikipedia pages: 4 (with ~101 citations total)`)
  console.log(`    - NewsAPI articles: 13`)
  console.log(`    - Anna's Archive books: 14`)
  console.log(`  \n  What was actually saved:`)
  console.log(`    - Wikipedia DiscoveredContent: ${wikipediaContent.length}`)
  console.log(`    - Wikipedia Citations: ${wikipediaCitations.length} found, ${savedCitations.length} saved`)
  console.log(`    - News DiscoveredContent: ${newsContent.length}`)
  console.log(`    - Anna's Archive DiscoveredContent: ${annasArchiveContent.length}`)
  
  if (runStartedAt) {
    console.log(`  \n  From latest run only:`)
    const recentWikipedia = recentContent.filter(c => 
      c.sourceDomain?.includes('wikipedia.org') || 
      c.sourceUrl?.includes('wikipedia.org')
    )
    const recentNews = recentContent.filter(c => {
      const domain = c.sourceDomain?.toLowerCase() || ''
      return domain.includes('news') || domain.includes('bbc') || domain.includes('reuters')
    })
    const recentAnnasArchive = recentContent.filter(c => {
      const domain = c.sourceDomain?.toLowerCase() || ''
      const url = c.sourceUrl?.toLowerCase() || ''
      return domain.includes('annas-archive.org') || url.includes('annas-archive.org')
    })
    
    console.log(`    - Wikipedia: ${recentWikipedia.length} saved`)
    console.log(`    - News: ${recentNews.length} saved`)
    console.log(`    - Anna's Archive: ${recentAnnasArchive.length} saved`)
  }
  
  console.log(`\n`)
  
  await prisma.$disconnect()
}

main().catch(console.error)

