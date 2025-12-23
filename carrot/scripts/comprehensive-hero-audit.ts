/**
 * Comprehensive audit of heroes: count, quality, images, content
 */

import { prisma } from '@/lib/prisma'

async function comprehensiveAudit() {
  console.log('=== COMPREHENSIVE HERO AUDIT ===\n')
  
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })
  
  if (!patch) {
    console.error('Patch "israel" not found')
    return
  }
  
  // 1. Count DiscoveredContent vs Heroes
  const totalContent = await prisma.discoveredContent.count({
    where: { patchId: patch.id }
  })
  
  const totalHeroes = await prisma.hero.count({
    where: {
      content: {
        patchId: patch.id
      }
    }
  })
  
  console.log('1. HERO COUNT:\n')
  console.log(`   Total DiscoveredContent: ${totalContent}`)
  console.log(`   Total Heroes: ${totalHeroes}`)
  console.log(`   Missing Heroes: ${totalContent - totalHeroes}`)
  console.log(`   Coverage: ${((totalHeroes / totalContent) * 100).toFixed(1)}%`)
  
  // 2. Hero Image Quality
  const heroes = await prisma.hero.findMany({
    where: {
      content: {
        patchId: patch.id
      }
    },
    include: {
      content: {
        select: {
          id: true,
          title: true,
          summary: true
        }
      }
    },
    take: 100
  })
  
  console.log('\n2. HERO IMAGE QUALITY:\n')
  let svgPlaceholders = 0
  let wikimedia = 0
  let ai = 0
  let favicon = 0
  let other = 0
  let missing = 0
  
  heroes.forEach(hero => {
    if (!hero.imageUrl) {
      missing++
    } else if (hero.imageUrl.startsWith('data:image/svg')) {
      svgPlaceholders++
    } else if (hero.imageUrl.includes('wikimedia')) {
      wikimedia++
    } else if (hero.imageUrl.includes('favicon') || hero.imageUrl.includes('google.com/s2/favicons')) {
      favicon++
    } else if (hero.imageUrl.includes('firebase') || hero.imageUrl.includes('storage.googleapis.com')) {
      ai++
    } else {
      other++
    }
  })
  
  console.log(`   SVG Placeholders: ${svgPlaceholders} (${((svgPlaceholders / heroes.length) * 100).toFixed(1)}%)`)
  console.log(`   Wikimedia: ${wikimedia} (${((wikimedia / heroes.length) * 100).toFixed(1)}%)`)
  console.log(`   AI Generated: ${ai} (${((ai / heroes.length) * 100).toFixed(1)}%)`)
  console.log(`   Favicon (BAD): ${favicon} (${((favicon / heroes.length) * 100).toFixed(1)}%)`)
  console.log(`   Other: ${other}`)
  console.log(`   Missing: ${missing}`)
  
  // 3. Content Quality (quotes, summary quality)
  console.log('\n3. CONTENT QUALITY:\n')
  let hasQuotes = 0
  let hasGoodSummary = 0
  let hasPoorSummary = 0
  let grammarCleaned = 0
  
  const contentItems = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      title: true,
      summary: true,
      quotes: true,
      facts: true,
      metadata: true
    },
    take: 50
  })
  
  contentItems.forEach(item => {
    const quotes = Array.isArray(item.quotes) ? item.quotes : []
    if (quotes.length > 0) {
      hasQuotes++
    }
    
    const summary = item.summary || ''
    const metadata = (item.metadata as any) || {}
    
    if (metadata.grammarCleaned) {
      grammarCleaned++
    }
    
    // Check if summary is poor (starts with "Book contents", "This is", etc.)
    const poorPatterns = [
      /^Book contents/i,
      /^This is.*Item Preview/i,
      /^Frontmatter/i,
      /^JavaScript is disabled/i
    ]
    
    if (summary && summary.length > 20) {
      if (poorPatterns.some(p => p.test(summary))) {
        hasPoorSummary++
      } else {
        hasGoodSummary++
      }
    }
  })
  
  console.log(`   Items with quotes: ${hasQuotes} (${((hasQuotes / contentItems.length) * 100).toFixed(1)}%)`)
  console.log(`   Items with good summary: ${hasGoodSummary} (${((hasGoodSummary / contentItems.length) * 100).toFixed(1)}%)`)
  console.log(`   Items with poor summary: ${hasPoorSummary} (${((hasPoorSummary / contentItems.length) * 100).toFixed(1)}%)`)
  console.log(`   Items grammar cleaned: ${grammarCleaned} (${((grammarCleaned / contentItems.length) * 100).toFixed(1)}%)`)
  
  // 4. Sample problematic items
  console.log('\n4. SAMPLE PROBLEMATIC ITEMS:\n')
  const problematic = contentItems.filter(item => {
    const summary = item.summary || ''
    const poorPatterns = [
      /^Book contents/i,
      /^This is.*Item Preview/i,
      /^Frontmatter/i
    ]
    return poorPatterns.some(p => p.test(summary))
  }).slice(0, 5)
  
  problematic.forEach((item, idx) => {
    console.log(`   ${idx + 1}. ${item.id}`)
    console.log(`      Title: "${item.title}"`)
    console.log(`      Summary: "${(item.summary || '').substring(0, 80)}..."`)
    const quotes = Array.isArray(item.quotes) ? item.quotes : []
    console.log(`      Quotes: ${quotes.length}`)
    const metadata = (item.metadata as any) || {}
    console.log(`      Grammar Cleaned: ${metadata.grammarCleaned ? 'YES' : 'NO'}`)
  })
  
  console.log('\n=== AUDIT COMPLETE ===')
}

comprehensiveAudit().catch(console.error)

