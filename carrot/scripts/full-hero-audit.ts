/**
 * Full audit of hero titles, images, and content quality
 */

import { prisma } from '@/lib/prisma'

async function fullAudit() {
  console.log('=== FULL HERO AUDIT ===\n')
  
  // 1. Check database titles
  console.log('1. DATABASE TITLES:')
  const poorTitles = await prisma.discoveredContent.findMany({
    where: {
      OR: [
        { title: { contains: 'doi.org' } },
        { title: { contains: 'cambridge.org' } },
        { title: 'Untitled' },
        { title: { contains: 'book part' } }
      ]
    },
    select: {
      id: true,
      title: true,
      summary: true,
      whyItMatters: true,
      sourceUrl: true,
      updatedAt: true
    },
    take: 10
  })
  
  console.log(`   Found ${poorTitles.length} items with poor titles:`)
  poorTitles.forEach(item => {
    console.log(`   - ${item.id}: "${item.title}"`)
    console.log(`     Summary: ${item.summary?.substring(0, 60) || 'N/A'}...`)
    console.log(`     Updated: ${item.updatedAt.toISOString()}`)
  })
  
  // 2. Check hero images
  console.log('\n2. HERO IMAGES:')
  const heroesWithoutImages = await prisma.hero.findMany({
    where: {
      OR: [
        { imageUrl: null },
        { status: 'ERROR' },
        { imageUrl: { contains: 'placeholder.com' } }
      ]
    },
    select: {
      id: true,
      contentId: true,
      imageUrl: true,
      status: true,
      errorMessage: true
    },
    take: 10
  })
  
  console.log(`   Found ${heroesWithoutImages.length} heroes with issues:`)
  heroesWithoutImages.forEach(hero => {
    console.log(`   - Hero ${hero.id} (Content: ${hero.contentId}):`)
    console.log(`     Status: ${hero.status}`)
    console.log(`     Image URL: ${hero.imageUrl || 'NULL'}`)
    if (hero.errorMessage) {
      console.log(`     Error: ${hero.errorMessage}`)
    }
  })
  
  // 3. Check content quality
  console.log('\n3. CONTENT QUALITY:')
  const contentWithoutSummary = await prisma.discoveredContent.findMany({
    where: {
      OR: [
        { summary: null },
        { summary: '' }
      ]
    },
    select: {
      id: true,
      title: true,
      summary: true,
      facts: true,
      metadata: true
    },
    take: 10
  })
  
  console.log(`   Found ${contentWithoutSummary.length} items with missing/incomplete content:`)
  contentWithoutSummary.forEach(item => {
    const metadata = (item.metadata as any) || {}
    console.log(`   - ${item.id}: "${item.title}"`)
    console.log(`     Summary: ${item.summary ? `${item.summary.length} chars` : 'MISSING'}`)
    console.log(`     Facts: ${Array.isArray(item.facts) ? item.facts.length : 'MISSING'}`)
    console.log(`     Grammar cleaned: ${metadata.grammarCleaned || false}`)
  })
  
  // 4. Check a specific item end-to-end
  console.log('\n4. END-TO-END CHECK (Sample Item):')
  if (poorTitles.length > 0) {
    const sampleId = poorTitles[0].id
    const fullItem = await prisma.discoveredContent.findUnique({
      where: { id: sampleId },
      include: {
        heroRecord: true
      }
    })
    
    if (fullItem) {
      console.log(`   Item ID: ${fullItem.id}`)
      console.log(`   Title: "${fullItem.title}"`)
      console.log(`   Summary: ${fullItem.summary?.substring(0, 100) || 'MISSING'}...`)
      console.log(`   Hero Record: ${fullItem.heroRecord ? 'EXISTS' : 'MISSING'}`)
      if (fullItem.heroRecord) {
        console.log(`     - Status: ${fullItem.heroRecord.status}`)
        console.log(`     - Image URL: ${fullItem.heroRecord.imageUrl || 'NULL'}`)
      }
      console.log(`   Source URL: ${fullItem.sourceUrl}`)
    }
  }
  
  // 5. Check API response simulation
  console.log('\n5. API RESPONSE SIMULATION:')
  const sampleItems = await prisma.discoveredContent.findMany({
    where: {
      OR: [
        { title: { contains: 'doi.org' } },
        { title: { contains: 'cambridge.org' } }
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
  
  sampleItems.forEach(item => {
    console.log(`   Item ${item.id}:`)
    console.log(`     DB Title: "${item.title}"`)
    
    // Simulate title improvement
    const summary = item.summary || item.whyItMatters || ''
    let improvedTitle = item.title
    if (item.title.includes('doi.org') || item.title.includes('cambridge.org')) {
      if (summary && summary.length > 20) {
        const firstSentence = summary.split(/[.!?]/)[0].trim()
        if (firstSentence.length > 15 && firstSentence.length < 100) {
          improvedTitle = firstSentence.charAt(0).toUpperCase() + firstSentence.slice(1)
        }
      }
    }
    console.log(`     Improved Title: "${improvedTitle}"`)
    
    // Check hero image
    const heroUrl = item.heroRecord?.imageUrl || (item.hero as any)?.url || null
    console.log(`     Hero URL: ${heroUrl || 'MISSING'}`)
    if (heroUrl) {
      console.log(`       Type: ${heroUrl.startsWith('data:') ? 'SVG Data URI' : heroUrl.includes('placeholder') ? 'External Placeholder' : 'Regular URL'}`)
    }
  })
  
  console.log('\n=== AUDIT COMPLETE ===')
}

fullAudit().catch(console.error)

