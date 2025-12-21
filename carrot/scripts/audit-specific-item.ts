/**
 * Audit a specific content item to check title and hero image issues
 */

import { prisma } from '@/lib/prisma'
import { generateSVGPlaceholder } from '@/lib/media/fallbackImages'

async function auditSpecificItem(contentId: string) {
  console.log(`=== AUDITING CONTENT ITEM: ${contentId} ===\n`)
  
  // Get the item from database
  const item = await prisma.discoveredContent.findUnique({
    where: { id: contentId },
    include: {
      heroRecord: true
    }
  })
  
  if (!item) {
    console.error(`Item ${contentId} not found`)
    return
  }
  
  console.log('1. DATABASE STATE:\n')
  console.log(`   ID: ${item.id}`)
  console.log(`   Title: "${item.title}"`)
  console.log(`   Summary: ${item.summary?.substring(0, 100) || 'N/A'}...`)
  console.log(`   WhyItMatters: ${item.whyItMatters?.substring(0, 100) || 'N/A'}...`)
  console.log(`   Source URL: ${item.sourceUrl}`)
  console.log(`   Canonical URL: ${item.canonicalUrl}`)
  
  if (item.heroRecord) {
    console.log(`\n   Hero Record:`)
    console.log(`     Status: ${item.heroRecord.status}`)
    console.log(`     Image URL: ${item.heroRecord.imageUrl?.substring(0, 100) || 'NULL'}...`)
    console.log(`     Title: ${item.heroRecord.title || 'N/A'}`)
    if (item.heroRecord.imageUrl) {
      if (item.heroRecord.imageUrl.startsWith('data:image/svg')) {
        console.log(`     ✅ SVG Data URI`)
      } else if (item.heroRecord.imageUrl.includes('wikimedia')) {
        console.log(`     ✅ Wikimedia URL`)
      } else if (item.heroRecord.imageUrl.includes('favicon')) {
        console.log(`     ❌ FAVICON (BAD)`)
      } else {
        console.log(`     ⚠️  Other URL`)
      }
    }
  } else {
    console.log(`\n   ❌ No Hero Record`)
  }
  
  // Check if title is poor
  console.log(`\n2. TITLE ANALYSIS:\n`)
  const poorTitlePatterns = [
    /^[a-z0-9.-]+\.(org|com|edu|gov|net)\s*-\s*/i,
    /^doi\.org/i,
    /^[0-9.]+(\/[0-9a-z]+)+$/i,
    /^(book part|untitled)$/i,
    /^cambridge\.org/i,
    /^\d+\s+\d+\s+[A-Z]/i,
    /^[0-9]+\s+[0-9]+\s+/i,
    /^[0-9]+\s+[A-Z]/i,
    /^[A-Z]{1,2}$/i,
    /^--\s+/i,
    /^It was just that/i,
    /^Book contents/i,
    /^Frontmatter/i,
    /^JavaScript is disabled/i,
    /^Advanced embedding/i,
    /^Some features of this site/i
  ]
  
  const isPoorTitle = poorTitlePatterns.some(pattern => pattern.test(item.title))
  console.log(`   Is Poor Title: ${isPoorTitle ? '❌ YES' : '✅ NO'}`)
  
  if (isPoorTitle) {
    console.log(`   Current Title: "${item.title}"`)
    
    // Try to extract better title from summary
    const summary = item.summary || item.whyItMatters || ''
    if (summary && summary.length > 20) {
      const skipPrefixes = [
        'book contents', 'frontmatter', 'introduction', 'chapter', 'page',
        'javascript is disabled', 'sign in', 'check out', 'advanced embedding',
        'summary', 'abstract', 'table of contents', 'some features of this site'
      ]
      
      const sentences = summary.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => {
        const sLower = s.toLowerCase()
        return s.length > 10 && !skipPrefixes.some(prefix => sLower.startsWith(prefix))
      })
      
      if (sentences.length > 0) {
        const improvedTitle = sentences[0].charAt(0).toUpperCase() + sentences[0].slice(1)
        console.log(`   ✅ Suggested Improved Title: "${improvedTitle.substring(0, 80)}"`)
      } else {
        console.log(`   ⚠️  Could not extract better title from summary`)
      }
    } else {
      console.log(`   ⚠️  No summary available for title improvement`)
    }
  }
  
  // Simulate API response
  console.log(`\n3. API RESPONSE SIMULATION:\n`)
  const heroRelation = item.heroRecord
  let heroRaw: any = null
  
  if (heroRelation && heroRelation.imageUrl) {
    const imageUrl = heroRelation.imageUrl
    const urlLower = imageUrl.toLowerCase()
    
    if (urlLower.includes('favicon') || urlLower.includes('google.com/s2/favicons')) {
      console.log(`   ⚠️  Hero has favicon - should be skipped`)
    } else {
      let heroSource: 'ai' | 'wikimedia' | 'skeleton' = 'skeleton'
      if (urlLower.includes('wikimedia.org') || urlLower.includes('upload.wikimedia.org') || urlLower.includes('commons.wikimedia.org')) {
        heroSource = 'wikimedia'
      } else if (imageUrl.startsWith('data:image/svg')) {
        heroSource = 'skeleton'
      } else {
        heroSource = 'ai'
      }
      
      heroRaw = {
        url: imageUrl,
        source: heroSource
      }
      console.log(`   ✅ Using hero record: ${imageUrl.substring(0, 60)}... (source: ${heroSource})`)
    }
  }
  
  // Generate improved title
  const summary = item.summary || item.whyItMatters || ''
  const improvedTitle = (() => {
    const originalTitle = item.title || ''
    const poorTitlePatterns = [
      /^[a-z0-9.-]+\.(org|com|edu|gov|net)\s*-\s*/i,
      /^doi\.org/i,
      /^[0-9.]+(\/[0-9a-z]+)+$/i,
      /^(book part|untitled)$/i,
      /^cambridge\.org/i,
      /^\d+\s+\d+\s+[A-Z]/i,
      /^[0-9]+\s+[0-9]+\s+/i,
      /^[0-9]+\s+[A-Z]/i,
      /^[A-Z]{1,2}$/i,
      /^--\s+/i,
      /^It was just that/i,
      /^Book contents/i,
      /^Frontmatter/i,
      /^JavaScript is disabled/i,
      /^Advanced embedding/i,
      /^Some features of this site/i
    ]
    const isPoorTitle = poorTitlePatterns.some(pattern => pattern.test(originalTitle))
    
    if (isPoorTitle && summary && summary.length > 20) {
      const skipPrefixes = [
        'book contents', 'frontmatter', 'introduction', 'chapter', 'page',
        'javascript is disabled', 'sign in', 'check out', 'advanced embedding',
        'summary', 'abstract', 'table of contents', 'some features of this site'
      ]
      
      const sentences = summary.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => {
        const sLower = s.toLowerCase()
        return s.length > 10 && !skipPrefixes.some(prefix => sLower.startsWith(prefix))
      })
      
      if (sentences.length > 0) {
        let improved = sentences[0].charAt(0).toUpperCase() + sentences[0].slice(1)
        if (improved.length > 80) {
          const words = improved.split(' ')
          improved = words.slice(0, 10).join(' ')
        }
        return improved
      }
    }
    
    return originalTitle
  })()
  
  // Fallback to placeholder if no hero
  if (!heroRaw) {
    const placeholderUrl = generateSVGPlaceholder(improvedTitle, 800, 400)
    heroRaw = {
      url: placeholderUrl,
      source: 'skeleton'
    }
    console.log(`   ✅ Generated placeholder: ${placeholderUrl.substring(0, 60)}...`)
  }
  
  const apiResponse = {
    id: item.id,
    title: improvedTitle,
    displayTitle: improvedTitle,
    hero: heroRaw,
    mediaAssets: {
      hero: heroRaw.url,
      source: heroRaw.source
    }
  }
  
  console.log(`\n   API Response:`)
  console.log(`     title: "${apiResponse.title}"`)
  console.log(`     displayTitle: "${apiResponse.displayTitle}"`)
  console.log(`     hero: { url: "${apiResponse.hero.url.substring(0, 60)}...", source: "${apiResponse.hero.source}" }`)
  console.log(`     mediaAssets.hero: "${apiResponse.mediaAssets.hero.substring(0, 60)}..."`)
  
  // Simulate frontend resolution
  console.log(`\n4. FRONTEND RESOLUTION:\n`)
  const frontendItem = apiResponse as any
  const mediaAssetsHero = frontendItem.mediaAssets?.hero
  const heroObjectUrl = frontendItem.hero && typeof frontendItem.hero === 'object' ? frontendItem.hero.url : null
  const heroStringUrl = typeof frontendItem.hero === 'string' ? frontendItem.hero : null
  const heroUrl = heroObjectUrl ?? heroStringUrl ?? 
                  (mediaAssetsHero && typeof mediaAssetsHero === 'string' ? mediaAssetsHero : null) ??
                  null
  
  console.log(`   heroObjectUrl: ${heroObjectUrl ? '✅ ' + heroObjectUrl.substring(0, 50) + '...' : '❌ null'}`)
  console.log(`   heroStringUrl: ${heroStringUrl || 'null'}`)
  console.log(`   mediaAssetsHero: ${mediaAssetsHero ? '✅ ' + mediaAssetsHero.substring(0, 50) + '...' : '❌ null'}`)
  console.log(`   Final heroUrl: ${heroUrl ? '✅ ' + heroUrl.substring(0, 50) + '...' : '❌ NULL - IMAGE WON\'T SHOW!'}`)
  console.log(`   displayTitle: ${frontendItem.displayTitle || frontendItem.title || 'MISSING'}`)
  
  // Check for issues
  console.log(`\n5. ISSUES DETECTED:\n`)
  const issues: string[] = []
  
  if (!heroUrl) {
    issues.push('❌ CRITICAL: No hero URL resolved - images will not show')
  }
  
  if (isPoorTitle && improvedTitle === item.title) {
    issues.push('❌ Title not improved - still poor')
  }
  
  if (heroRelation && heroRelation.imageUrl && heroRelation.imageUrl.includes('favicon')) {
    issues.push('❌ Hero record has favicon URL - should be replaced')
  }
  
  if (!heroRelation) {
    issues.push('⚠️  No hero record - should create one')
  }
  
  if (issues.length === 0) {
    console.log('   ✅ No issues detected in simulation')
  } else {
    issues.forEach(issue => console.log(`   ${issue}`))
  }
  
  console.log(`\n=== AUDIT COMPLETE ===`)
}

const contentId = process.argv[2] || 'cmjasuorz00974siorthcnqm3'
auditSpecificItem(contentId).catch(console.error)

