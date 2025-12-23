/**
 * Debug a specific content item to see why cleanup isn't working
 */

import { prisma } from '@/lib/prisma'

async function debugItem() {
  const itemId = 'cmjasvv0k009d4siotzomgrnt' // From the screenshot
  
  console.log(`=== DEBUGGING ITEM: ${itemId} ===\n`)
  
  const item = await prisma.discoveredContent.findUnique({
    where: { id: itemId },
    include: {
      heroRecord: {
        select: {
          id: true,
          imageUrl: true,
          status: true
        }
      }
    }
  })
  
  if (!item) {
    console.error('Item not found')
    return
  }
  
  console.log('1. DATABASE STATE:')
  console.log(`   Title: "${item.title}"`)
  console.log(`   Summary: "${(item.summary || '').substring(0, 100)}..."`)
  console.log(`   Summary length: ${(item.summary || '').length}`)
  console.log(`   Facts: ${Array.isArray(item.facts) ? item.facts.length : 0}`)
  console.log(`   Quotes: ${Array.isArray(item.quotes) ? item.quotes.length : 0}`)
  
  const metadata = (item.metadata as any) || {}
  console.log(`   Grammar cleaned: ${metadata.grammarCleaned ? 'YES' : 'NO'}`)
  console.log(`   Grammar cleaned at: ${metadata.grammarCleanedAt || 'Never'}`)
  console.log(`   Content quality: ${metadata.contentQuality || 'Not set'}`)
  console.log(`   Force recheck: ${metadata.forceRecheck || false}`)
  
  console.log('\n2. HERO RECORD:')
  if (item.heroRecord) {
    console.log(`   ✅ Hero record exists`)
    console.log(`   Image URL: ${item.heroRecord.imageUrl || 'MISSING'}`)
    console.log(`   Status: ${item.heroRecord.status}`)
    if (item.heroRecord.imageUrl) {
      const isReal = !item.heroRecord.imageUrl.startsWith('data:image/svg') &&
                     !item.heroRecord.imageUrl.includes('favicon')
      console.log(`   Image type: ${isReal ? '✅ Real' : '⚠️  Placeholder'}`)
    }
  } else {
    console.log(`   ❌ No hero record found`)
  }
  
  console.log('\n3. PREVIEW API SIMULATION:')
  const hasContent = item.summary || (Array.isArray(item.facts) && item.facts.length > 0)
  const neverCleaned = !metadata.grammarCleaned
  const isPoorQuality = metadata.contentQuality === 'poor'
  const needsRecheck = metadata.forceRecheck === true
  const cleanedLongAgo = metadata.grammarCleanedAt ? 
    (Date.now() - new Date(metadata.grammarCleanedAt).getTime() > 7 * 24 * 60 * 60 * 1000) : false
  
  const needsCleanup = hasContent && (neverCleaned || isPoorQuality || needsRecheck || cleanedLongAgo)
  
  console.log(`   Has content: ${hasContent}`)
  console.log(`   Never cleaned: ${neverCleaned}`)
  console.log(`   Poor quality: ${isPoorQuality}`)
  console.log(`   Needs recheck: ${needsRecheck}`)
  console.log(`   Cleaned long ago: ${cleanedLongAgo}`)
  console.log(`   ⚠️  Would cleanup run? ${needsCleanup ? 'YES' : 'NO'}`)
  
  if (!needsCleanup) {
    console.log(`   ❌ Cleanup would NOT run!`)
    if (!hasContent) {
      console.log(`      Reason: No content to clean`)
    } else if (metadata.grammarCleaned && !isPoorQuality && !needsRecheck && !cleanedLongAgo) {
      console.log(`      Reason: Already cleaned recently`)
    }
  }
  
  console.log('\n4. RECOMMENDATIONS:')
  if (!item.heroRecord || !item.heroRecord.imageUrl) {
    console.log(`   ⚠️  Hero image missing - needs to be generated`)
  }
  if (!metadata.grammarCleaned) {
    console.log(`   ⚠️  Content not cleaned - needs DeepSeek cleanup`)
  }
  if (item.summary && item.summary.includes('Bookreader Item Preview')) {
    console.log(`   ⚠️  Summary contains UI text - definitely needs cleanup`)
  }
}

debugItem().catch(console.error)

