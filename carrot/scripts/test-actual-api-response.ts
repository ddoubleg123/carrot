/**
 * Test what the API actually returns for the frontend
 */

import { prisma } from '@/lib/prisma'

async function testActualAPI() {
  console.log('=== TESTING ACTUAL API RESPONSE ===\n')
  
  // Get the Israel patch
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })
  
  if (!patch) {
    console.log('Patch "israel" not found')
    return
  }
  
  // Get items that should be visible
  const items = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      OR: [
        { title: { contains: '235 2 The Diaspora' } },
        { title: { contains: 'Diaspora' } }
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
    take: 5
  })
  
  console.log(`Found ${items.length} items matching search:\n`)
  
  for (const item of items) {
    console.log(`\nItem ID: ${item.id}`)
    console.log(`  Database Title: "${item.title}"`)
    console.log(`  Hero Record: ${item.heroRecord ? 'EXISTS' : 'MISSING'}`)
    if (item.heroRecord) {
      console.log(`    Status: ${item.heroRecord.status}`)
      console.log(`    Image URL: ${item.heroRecord.imageUrl?.substring(0, 100) || 'NULL'}...`)
      if (item.heroRecord.imageUrl) {
        if (item.heroRecord.imageUrl.startsWith('data:image/svg')) {
          console.log(`    ✅ SVG Data URI (good)`)
        } else if (item.heroRecord.imageUrl.includes('favicon')) {
          console.log(`    ❌ Favicon (bad - should be skipped)`)
        } else {
          console.log(`    ⚠️  Other URL type`)
        }
      }
    }
    
    // Simulate what the API should return
    const summary = item.summary || item.whyItMatters || ''
    console.log(`  Summary available: ${summary ? `${summary.length} chars` : 'NO'}`)
    
    // Check what improvedTitle would be
    const poorTitlePatterns = [
      /^[a-z0-9.-]+\.(org|com|edu|gov|net)\s*-\s*/i,
      /^doi\.org/i,
      /^[0-9.]+(\/[0-9a-z]+)+$/i,
      /^(book part|untitled)$/i
    ]
    const isPoorTitle = poorTitlePatterns.some(pattern => pattern.test(item.title))
    console.log(`  Is poor title: ${isPoorTitle}`)
    
    if (isPoorTitle && summary && summary.length > 20) {
      const sentences = summary.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 10)
      if (sentences.length > 0) {
        console.log(`  First sentence: "${sentences[0].substring(0, 80)}..."`)
      }
    }
  }
  
  // Now check ALL items to see what's actually being returned
  console.log(`\n\n=== ALL ITEMS FOR ISRAEL PATCH ===\n`)
  const allItems = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      title: true,
      heroRecord: {
        select: {
          imageUrl: true,
          status: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  })
  
  console.log(`Total items: ${allItems.length}`)
  allItems.forEach((item, idx) => {
    console.log(`${idx + 1}. "${item.title}" - Hero: ${item.heroRecord?.imageUrl ? 'YES' : 'NO'} (${item.heroRecord?.status || 'N/A'})`)
  })
}

testActualAPI().catch(console.error)

