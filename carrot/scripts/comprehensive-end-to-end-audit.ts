/**
 * Comprehensive end-to-end audit
 * Checks database → API → Frontend data flow
 */

import { prisma } from '@/lib/prisma'
import { generateSVGPlaceholder } from '@/lib/media/fallbackImages'

async function comprehensiveAudit() {
  console.log('=== COMPREHENSIVE END-TO-END AUDIT ===\n')
  
  // 1. Check database state
  console.log('1. DATABASE STATE:')
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })
  
  if (!patch) {
    console.log('❌ Patch "israel" not found')
    return
  }
  
  const dbItems = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    include: {
      heroRecord: true
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  })
  
  console.log(`   Found ${dbItems.length} items in database:\n`)
  dbItems.forEach((item, idx) => {
    console.log(`   ${idx + 1}. ID: ${item.id}`)
    console.log(`      Title: "${item.title}"`)
    console.log(`      Hero: ${item.heroRecord ? 'EXISTS' : 'MISSING'}`)
    if (item.heroRecord) {
      console.log(`        Status: ${item.heroRecord.status}`)
      console.log(`        Image URL: ${item.heroRecord.imageUrl?.substring(0, 60) || 'NULL'}...`)
      if (item.heroRecord.imageUrl) {
        if (item.heroRecord.imageUrl.startsWith('data:image/svg')) {
          console.log(`        ✅ SVG Data URI`)
        } else if (item.heroRecord.imageUrl.includes('favicon')) {
          console.log(`        ❌ FAVICON (BAD)`)
        } else {
          console.log(`        ⚠️  Other URL`)
        }
      }
    }
    console.log('')
  })
  
  // 2. Simulate API response for one item
  console.log('\n2. API RESPONSE SIMULATION:\n')
  const sampleItem = dbItems[0]
  if (sampleItem) {
    console.log(`   Processing item: ${sampleItem.id}`)
    console.log(`   DB Title: "${sampleItem.title}"`)
    
    // Simulate the API logic
    const heroRelation = sampleItem.heroRecord
    let heroRaw: any = null
    
    if (heroRelation && heroRelation.imageUrl) {
      const imageUrl = heroRelation.imageUrl
      const urlLower = imageUrl.toLowerCase()
      
      if (urlLower.includes('favicon') || urlLower.includes('google.com/s2/favicons')) {
        console.log(`   ⚠️  Hero has favicon - should be skipped`)
      } else {
        heroRaw = {
          url: imageUrl,
          source: imageUrl.startsWith('data:image/svg') ? 'skeleton' : 'ai'
        }
        console.log(`   ✅ Using hero record: ${imageUrl.substring(0, 60)}...`)
      }
    }
    
    if (!heroRaw) {
      const placeholderUrl = generateSVGPlaceholder(sampleItem.title, 800, 400)
      heroRaw = {
        url: placeholderUrl,
        source: 'skeleton'
      }
      console.log(`   ✅ Generated placeholder: ${placeholderUrl.substring(0, 60)}...`)
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
      } else {
        console.log(`   ⚠️  Could not improve title (no good sentences)`)
      }
    } else {
      console.log(`   ℹ️  Title not poor or no summary`)
    }
    
    // Simulate API response
    const apiResponse = {
      id: sampleItem.id,
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
    
    // 3. Simulate frontend resolution
    console.log(`\n3. FRONTEND RESOLUTION:\n`)
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
    
    // 4. Check for issues
    console.log(`\n4. ISSUE DETECTION:\n`)
    const issues: string[] = []
    
    if (!heroUrl) {
      issues.push('❌ No hero URL resolved - images will not show')
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
    } else {
      issues.forEach(issue => console.log(`   ${issue}`))
    }
  }
  
  // 5. Check all items for common issues
  console.log(`\n5. BULK ISSUE CHECK:\n`)
  const allItems = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    include: {
      heroRecord: true
    },
    take: 20
  })
  
  let noHero = 0
  let faviconHero = 0
  let poorTitle = 0
  
  allItems.forEach(item => {
    if (!item.heroRecord) noHero++
    if (item.heroRecord?.imageUrl?.includes('favicon')) faviconHero++
    
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
      /^JavaScript is disabled/i
    ]
    if (poorTitlePatterns.some(pattern => pattern.test(item.title))) {
      poorTitle++
    }
  })
  
  console.log(`   Items without heroes: ${noHero}`)
  console.log(`   Items with favicon heroes: ${faviconHero}`)
  console.log(`   Items with poor titles: ${poorTitle}`)
  console.log(`   Total items checked: ${allItems.length}`)
  
  console.log(`\n=== AUDIT COMPLETE ===`)
}

comprehensiveAudit().catch(console.error)

