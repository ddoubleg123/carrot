/**
 * Full frontend audit - checks database → API → frontend data flow
 * Identifies caching issues and data transformation problems
 */

import { prisma } from '@/lib/prisma'

async function fullFrontendAudit() {
  console.log('=== FULL FRONTEND AUDIT ===\n')
  
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })
  
  if (!patch) {
    console.error('Patch "israel" not found')
    return
  }
  
  // Get sample items from database
  const dbItems = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    include: {
      heroRecord: true
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })
  
  console.log('1. DATABASE STATE (First 5 items):\n')
  dbItems.forEach((item, idx) => {
    console.log(`   ${idx + 1}. ID: ${item.id}`)
    console.log(`      Title: "${item.title}"`)
    console.log(`      Hero: ${item.heroRecord ? 'EXISTS' : 'MISSING'}`)
    if (item.heroRecord) {
      console.log(`        Status: ${item.heroRecord.status}`)
      console.log(`        Image URL: ${item.heroRecord.imageUrl?.substring(0, 80) || 'NULL'}...`)
      if (item.heroRecord.imageUrl) {
        if (item.heroRecord.imageUrl.startsWith('data:image/svg')) {
          console.log(`        ✅ SVG Data URI`)
        } else if (item.heroRecord.imageUrl.includes('wikimedia')) {
          console.log(`        ✅ Wikimedia URL`)
        } else if (item.heroRecord.imageUrl.includes('favicon')) {
          console.log(`        ❌ FAVICON (BAD)`)
        } else {
          console.log(`        ⚠️  Other URL`)
        }
      }
    }
    console.log('')
  })
  
  // Simulate API response
  console.log('\n2. API RESPONSE SIMULATION:\n')
  const sampleItem = dbItems[0]
  if (sampleItem) {
    console.log(`   Processing item: ${sampleItem.id}`)
    
    // Simulate the exact API logic from discovered-content/route.ts
    const heroRelation = sampleItem.heroRecord
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
    
    // Simulate title improvement
    const summary = sampleItem.summary || sampleItem.whyItMatters || ''
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
      /^Frontmatter/i
    ]
    const isPoorTitle = poorTitlePatterns.some(pattern => pattern.test(sampleItem.title))
    
    let improvedTitle = sampleItem.title
    if (isPoorTitle && summary && summary.length > 20) {
      const skipPrefixes = [
        'book contents', 'frontmatter', 'introduction', 'chapter', 'page',
        'javascript is disabled', 'sign in', 'check out', 'advanced embedding',
        'summary', 'abstract', 'table of contents'
      ]
      
      const sentences = summary.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => {
        const sLower = s.toLowerCase()
        return s.length > 10 && !skipPrefixes.some(prefix => sLower.startsWith(prefix))
      })
      
      if (sentences.length > 0) {
        improvedTitle = sentences[0].charAt(0).toUpperCase() + sentences[0].slice(1)
        if (improvedTitle.length > 80) {
          const words = improvedTitle.split(' ')
          improvedTitle = words.slice(0, 10).join(' ')
        }
        console.log(`   ✅ Improved title: "${improvedTitle}"`)
      }
    }
    
    // Simulate API response structure
    const apiResponse = {
      id: sampleItem.id,
      title: improvedTitle,
      displayTitle: improvedTitle,
      hero: heroRaw,
      mediaAssets: {
        hero: heroRaw?.url || null,
        source: heroRaw?.source || 'skeleton'
      }
    }
    
    console.log(`\n   API Response Structure:`)
    console.log(`     id: "${apiResponse.id}"`)
    console.log(`     title: "${apiResponse.title}"`)
    console.log(`     displayTitle: "${apiResponse.displayTitle}"`)
    console.log(`     hero: ${apiResponse.hero ? JSON.stringify({ url: apiResponse.hero.url.substring(0, 60) + '...', source: apiResponse.hero.source }) : 'null'}`)
    console.log(`     mediaAssets.hero: "${apiResponse.mediaAssets.hero?.substring(0, 60) || 'null'}..."`)
    
    // Simulate frontend resolution
    console.log(`\n3. FRONTEND RESOLUTION (DiscoveryCard.tsx logic):\n`)
    const item = apiResponse as any
    const mediaAssetsHero = item.mediaAssets?.hero
    const heroObjectUrl = item.hero && typeof item.hero === 'object' ? item.hero.url : null
    const heroStringUrl = typeof item.hero === 'string' ? item.hero : null
    const heroUrl = heroObjectUrl ?? heroStringUrl ?? 
                    (mediaAssetsHero && typeof mediaAssetsHero === 'string' ? mediaAssetsHero : null) ??
                    null
    
    console.log(`   heroObjectUrl: ${heroObjectUrl ? '✅ ' + heroObjectUrl.substring(0, 50) + '...' : '❌ null'}`)
    console.log(`   heroStringUrl: ${heroStringUrl || 'null'}`)
    console.log(`   mediaAssetsHero: ${mediaAssetsHero ? '✅ ' + mediaAssetsHero.substring(0, 50) + '...' : '❌ null'}`)
    console.log(`   Final heroUrl: ${heroUrl ? '✅ ' + heroUrl.substring(0, 50) + '...' : '❌ NULL - IMAGE WON\'T SHOW!'}`)
    console.log(`   displayTitle: ${(item as any).displayTitle || item.title || 'MISSING'}`)
    
    // Check for issues
    console.log(`\n4. ISSUE DETECTION:\n`)
    const issues: string[] = []
    
    if (!heroUrl) {
      issues.push('❌ CRITICAL: No hero URL resolved - images will not show')
    }
    
    if (isPoorTitle && improvedTitle === sampleItem.title) {
      issues.push('❌ Title not improved - still poor')
    }
    
    if (heroRelation && heroRelation.imageUrl && heroRelation.imageUrl.includes('favicon')) {
      issues.push('❌ Hero record has favicon URL - should be replaced')
    }
    
    if (!heroRelation) {
      issues.push('⚠️  No hero record - should create one')
    }
    
    if (issues.length === 0) {
      console.log('   ✅ No issues detected - data flow looks correct')
      console.log('   ⚠️  If frontend still shows issues, check:')
      console.log('      1. Browser cache (hard refresh: Ctrl+Shift+R)')
      console.log('      2. Next.js cache (restart dev server or clear .next folder)')
      console.log('      3. API response caching (check Cache-Control headers)')
      console.log('      4. Network tab - verify actual API response matches this simulation')
    } else {
      issues.forEach(issue => console.log(`   ${issue}`))
    }
  }
  
  console.log(`\n=== AUDIT COMPLETE ===`)
  console.log(`\nNext steps:`)
  console.log(`1. Check browser Network tab - verify API response matches simulation`)
  console.log(`2. Check browser Console - look for errors or warnings`)
  console.log(`3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)`)
  console.log(`4. Check if Next.js is caching - restart dev server if needed`)
}

fullFrontendAudit().catch(console.error)

