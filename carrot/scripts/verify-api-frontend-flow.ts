/**
 * Verify the API → Frontend data flow
 */

import { prisma } from '@/lib/prisma'
import { generateSVGPlaceholder } from '@/lib/media/fallbackImages'

async function verifyFlow() {
  console.log('=== VERIFYING API → FRONTEND FLOW ===\n')
  
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })
  
  if (!patch) {
    console.log('Patch "israel" not found')
    return
  }
  
  // Get a sample item
  const item = await prisma.discoveredContent.findFirst({
    where: { patchId: patch.id },
    include: {
      heroRecord: true
    },
    orderBy: { createdAt: 'desc' }
  })
  
  if (!item) {
    console.log('No items found')
    return
  }
  
  console.log(`Sample Item: ${item.id}`)
  console.log(`  DB Title: "${item.title}"`)
  console.log(`  Hero Record: ${item.heroRecord ? 'EXISTS' : 'MISSING'}`)
  if (item.heroRecord) {
    console.log(`    Status: ${item.heroRecord.status}`)
    console.log(`    Image URL: ${item.heroRecord.imageUrl?.substring(0, 80) || 'NULL'}...`)
  }
  
  // Simulate what the API should return
  console.log(`\n=== API RESPONSE SIMULATION ===`)
  
  const heroRelation = item.heroRecord
  let heroRaw: any = null
  
  if (heroRelation && heroRelation.imageUrl) {
    const imageUrl = heroRelation.imageUrl
    const urlLower = imageUrl.toLowerCase()
    
    if (urlLower.includes('favicon') || urlLower.includes('google.com/s2/favicons')) {
      console.log(`  ⚠️  Hero has favicon URL - should be skipped`)
    } else {
      heroRaw = {
        url: imageUrl,
        source: imageUrl.startsWith('data:image/svg') ? 'skeleton' : 'ai'
      }
      console.log(`  ✅ Hero Raw: ${JSON.stringify(heroRaw).substring(0, 100)}...`)
    }
  }
  
  if (!heroRaw) {
    const placeholderUrl = generateSVGPlaceholder(item.title, 800, 400)
    heroRaw = {
      url: placeholderUrl,
      source: 'skeleton'
    }
    console.log(`  ✅ Generated placeholder: ${placeholderUrl.substring(0, 80)}...`)
  }
  
  const mediaAssets = {
    hero: heroRaw.url,
    source: heroRaw.source
  }
  
  console.log(`\n  API Response Structure:`)
  console.log(`    title: "${item.title}"`)
  console.log(`    hero: { url: "${heroRaw.url.substring(0, 50)}...", source: "${heroRaw.source}" }`)
  console.log(`    mediaAssets: { hero: "${mediaAssets.hero.substring(0, 50)}...", source: "${mediaAssets.source}" }`)
  
  // Check what frontend expects
  console.log(`\n=== FRONTEND EXPECTATIONS ===`)
  console.log(`  DiscoveryCard looks for:`)
  console.log(`    1. item.hero?.url (if hero is object)`)
  console.log(`    2. item.hero (if hero is string)`)
  console.log(`    3. item.mediaAssets?.hero (if mediaAssets.hero is string)`)
  
  // Simulate frontend logic
  const mediaAssetsHero = mediaAssets.hero
  const heroObjectUrl = heroRaw && typeof heroRaw === 'object' ? heroRaw.url : null
  const heroStringUrl = typeof heroRaw === 'string' ? heroRaw : null
  const heroUrl = heroObjectUrl ?? heroStringUrl ?? 
                  (mediaAssetsHero && typeof mediaAssetsHero === 'string' ? mediaAssetsHero : null) ??
                  null
  
  console.log(`\n  Frontend Resolution:`)
  console.log(`    heroObjectUrl: ${heroObjectUrl ? heroObjectUrl.substring(0, 50) + '...' : 'null'}`)
  console.log(`    heroStringUrl: ${heroStringUrl || 'null'}`)
  console.log(`    mediaAssetsHero: ${mediaAssetsHero ? mediaAssetsHero.substring(0, 50) + '...' : 'null'}`)
  console.log(`    Final heroUrl: ${heroUrl ? heroUrl.substring(0, 50) + '...' : 'NULL - IMAGE WON\'T SHOW!'}`)
}

verifyFlow().catch(console.error)

