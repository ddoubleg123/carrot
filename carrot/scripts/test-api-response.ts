/**
 * Test what the API actually returns
 */

import { prisma } from '@/lib/prisma'

async function testAPIResponse() {
  console.log('=== TESTING API RESPONSE ===\n')
  
  // Get the Israel patch
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })
  
  if (!patch) {
    console.log('Patch "israel" not found')
    return
  }
  
  // Get items with poor titles
  const poorItems = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      OR: [
        { title: { contains: 'doi.org' } },
        { title: { contains: 'cambridge.org' } },
        { title: 'Untitled' }
      ]
    },
    select: {
      id: true,
      title: true,
      summary: true,
      whyItMatters: true,
      hero: true,
      heroRecord: {
        select: {
          imageUrl: true,
          status: true
        }
      }
    },
    take: 3
  })
  
  console.log(`Found ${poorItems.length} items with poor titles:\n`)
  
  for (const item of poorItems) {
    console.log(`Item: ${item.id}`)
    console.log(`  DB Title: "${item.title}"`)
    console.log(`  Summary: ${item.summary?.substring(0, 80) || 'N/A'}...`)
    
    // Simulate what the API should return
    const summary = item.summary || item.whyItMatters || ''
    let improvedTitle = item.title
    
    // Check if title is poor
    const poorTitlePatterns = [
      /^[a-z0-9.-]+\.(org|com|edu|gov|net)\s*-\s*/i,
      /^doi\.org/i,
      /^[0-9.]+(\/[0-9a-z]+)+$/i,
      /^(book part|untitled)$/i
    ]
    const isPoorTitle = poorTitlePatterns.some(pattern => pattern.test(item.title))
    
    if (isPoorTitle && summary && summary.length > 20) {
      const firstSentence = summary.split(/[.!?]/)[0].trim()
      if (firstSentence.length > 15 && firstSentence.length < 100) {
        improvedTitle = firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1)
        console.log(`  ✅ Improved Title: "${improvedTitle}"`)
      } else {
        console.log(`  ⚠️  Could not improve (first sentence too short/long)`)
      }
    } else {
      console.log(`  ⚠️  Title not improved (not poor or no summary)`)
    }
    
    // Check hero image
    const heroUrl = item.heroRecord?.imageUrl || (item.hero as any)?.url || null
    console.log(`  Hero URL: ${heroUrl || 'MISSING'}`)
    if (heroUrl) {
      if (heroUrl.startsWith('data:image/svg')) {
        console.log(`    ✅ SVG Data URI (good)`)
      } else if (heroUrl.includes('placeholder.com')) {
        console.log(`    ⚠️  External placeholder (may fail)`)
      } else if (heroUrl.includes('favicon')) {
        console.log(`    ⚠️  Favicon (too small, not suitable)`)
      } else {
        console.log(`    ✅ Regular URL`)
      }
    } else {
      console.log(`    ❌ No hero image - should generate SVG placeholder`)
    }
    
    console.log('')
  }
}

testAPIResponse().catch(console.error)

