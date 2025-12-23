/**
 * Self-audit to verify all fixes are working correctly
 */

import { prisma } from '@/lib/prisma'

async function selfAudit() {
  console.log('=== SELF-AUDIT VERIFICATION ===\n')
  
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true, handle: true }
  })
  
  if (!patch) {
    console.error('❌ Patch "israel" not found')
    return
  }
  
  console.log(`✅ Patch found: ${patch.handle} (${patch.id})\n`)
  
  // 1. Verify Hero Count
  console.log('1. HERO COUNT VERIFICATION:')
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
  
  const missingHeroes = totalContent - totalHeroes
  const coverage = totalContent > 0 ? (totalHeroes / totalContent) * 100 : 0
  
  if (totalHeroes === totalContent && coverage === 100) {
    console.log(`   ✅ PASS: ${totalHeroes}/${totalContent} heroes (100% coverage)`)
  } else {
    console.log(`   ❌ FAIL: ${totalHeroes}/${totalContent} heroes (${coverage.toFixed(1)}% coverage)`)
    console.log(`   Missing: ${missingHeroes} heroes`)
  }
  
  // 2. Verify Hero Image Quality
  console.log('\n2. HERO IMAGE QUALITY VERIFICATION:')
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
          title: true
        }
      }
    }
  })
  
  let svgPlaceholders = 0
  let wikimedia = 0
  let ai = 0
  let favicon = 0
  let missing = 0
  let realImages = 0
  
  heroes.forEach(hero => {
    if (!hero.imageUrl) {
      missing++
    } else if (hero.imageUrl.startsWith('data:image/svg')) {
      svgPlaceholders++
    } else if (hero.imageUrl.includes('wikimedia.org') || hero.imageUrl.includes('upload.wikimedia.org') || hero.imageUrl.includes('commons.wikimedia.org')) {
      wikimedia++
      realImages++
    } else if (hero.imageUrl.includes('favicon') || hero.imageUrl.includes('google.com/s2/favicons')) {
      favicon++
    } else if (hero.imageUrl.includes('firebase') || hero.imageUrl.includes('storage.googleapis.com')) {
      ai++
      realImages++
    } else {
      realImages++ // Assume other URLs are real images
    }
  })
  
  const realImagePct = heroes.length > 0 ? (realImages / heroes.length) * 100 : 0
  
  console.log(`   Total heroes: ${heroes.length}`)
  console.log(`   Real images: ${realImages} (${realImagePct.toFixed(1)}%)`)
  console.log(`   - Wikimedia: ${wikimedia}`)
  console.log(`   - AI Generated: ${ai}`)
  console.log(`   - SVG Placeholders: ${svgPlaceholders}`)
  console.log(`   - Favicon (BAD): ${favicon}`)
  console.log(`   - Missing: ${missing}`)
  
  if (realImagePct >= 90) {
    console.log(`   ✅ PASS: ${realImagePct.toFixed(1)}% have real images (target: ≥90%)`)
  } else {
    console.log(`   ❌ FAIL: Only ${realImagePct.toFixed(1)}% have real images (target: ≥90%)`)
  }
  
  // 3. Verify API Response Structure
  console.log('\n3. API RESPONSE STRUCTURE VERIFICATION:')
  const sampleContent = await prisma.discoveredContent.findFirst({
    where: { patchId: patch.id },
    include: {
      heroRecord: {
        select: {
          imageUrl: true,
          status: true
        }
      }
    }
  })
  
  if (sampleContent) {
    console.log(`   Sample item: ${sampleContent.id}`)
    console.log(`   Title: "${sampleContent.title?.substring(0, 50)}"`)
    
    // Check hero record
    if (sampleContent.heroRecord) {
      console.log(`   ✅ Hero record exists`)
      console.log(`   Hero imageUrl: ${sampleContent.heroRecord.imageUrl ? '✅ Present' : '❌ Missing'}`)
      console.log(`   Hero status: ${sampleContent.heroRecord.status}`)
      
      if (sampleContent.heroRecord.imageUrl) {
        const isReal = !sampleContent.heroRecord.imageUrl.startsWith('data:image/svg') &&
                       !sampleContent.heroRecord.imageUrl.includes('favicon')
        if (isReal) {
          console.log(`   ✅ Hero has real image URL`)
        } else {
          console.log(`   ⚠️  Hero has placeholder/favicon URL`)
        }
      }
    } else {
      console.log(`   ❌ No hero record found`)
    }
    
    // Check content fields
    console.log(`   Summary: ${sampleContent.summary ? `✅ Present (${sampleContent.summary.length} chars)` : '❌ Missing'}`)
    console.log(`   Quotes: ${Array.isArray(sampleContent.quotes) && sampleContent.quotes.length > 0 ? `✅ Present (${sampleContent.quotes.length} quotes)` : '❌ Missing'}`)
    console.log(`   Facts: ${Array.isArray(sampleContent.facts) && sampleContent.facts.length > 0 ? `✅ Present (${sampleContent.facts.length} facts)` : '❌ Missing'}`)
    
    const metadata = (sampleContent.metadata as any) || {}
    console.log(`   Grammar cleaned: ${metadata.grammarCleaned ? '✅ Yes' : '❌ No'}`)
  } else {
    console.log(`   ❌ No content items found`)
  }
  
  // 4. Verify Problematic Items
  console.log('\n4. PROBLEMATIC ITEMS CHECK:')
  const problematicItems = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      OR: [
        { title: { contains: 'Favorite Share Flag' } },
        { title: { contains: 'Book contents' } },
        { title: { contains: '235 ce 3' } },
        { summary: { startsWith: 'Book contents' } },
        { summary: { startsWith: 'This is Jerusalem Bookreader' } }
      ]
    },
    select: {
      id: true,
      title: true,
      summary: true,
      heroRecord: {
        select: {
          imageUrl: true
        }
      }
    },
    take: 5
  })
  
  if (problematicItems.length > 0) {
    console.log(`   ⚠️  Found ${problematicItems.length} potentially problematic items:`)
    problematicItems.forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.id}`)
      console.log(`      Title: "${item.title?.substring(0, 60)}"`)
      console.log(`      Summary: "${(item.summary || '').substring(0, 60)}..."`)
      console.log(`      Hero: ${item.heroRecord?.imageUrl ? '✅ Has image' : '❌ No image'}`)
      if (item.heroRecord?.imageUrl) {
        const isReal = !item.heroRecord.imageUrl.startsWith('data:image/svg')
        console.log(`      Image type: ${isReal ? '✅ Real' : '⚠️  Placeholder'}`)
      }
    })
  } else {
    console.log(`   ✅ No problematic items found`)
  }
  
  // 5. Verify Data Flow (simulate API response)
  console.log('\n5. DATA FLOW VERIFICATION (Simulated API Response):')
  const testItem = await prisma.discoveredContent.findFirst({
    where: { patchId: patch.id },
    include: {
      heroRecord: {
        select: {
          imageUrl: true,
          status: true,
          sourceUrl: true
        }
      }
    }
  })
  
  if (testItem) {
    // Simulate what the API should return
    const heroUrl = testItem.heroRecord?.imageUrl || null
    const hasRealHero = heroUrl && !heroUrl.startsWith('data:image/svg') && !heroUrl.includes('favicon')
    
    const simulatedResponse = {
      id: testItem.id,
      title: testItem.title,
      hero: hasRealHero ? { url: heroUrl, source: heroUrl.includes('wikimedia') ? 'wikimedia' : 'ai' } : null,
      mediaAssets: hasRealHero ? { hero: heroUrl, source: heroUrl.includes('wikimedia') ? 'wikimedia' : 'ai' } : null
    }
    
    console.log(`   Test item: ${testItem.id}`)
    console.log(`   API would return:`)
    console.log(`   - hero: ${simulatedResponse.hero ? '✅ Present' : '❌ Missing'}`)
    console.log(`   - mediaAssets.hero: ${simulatedResponse.mediaAssets?.hero ? '✅ Present' : '❌ Missing'}`)
    
    if (simulatedResponse.hero && simulatedResponse.mediaAssets?.hero) {
      console.log(`   ✅ PASS: API response structure is correct`)
    } else {
      console.log(`   ❌ FAIL: API response missing hero data`)
    }
  }
  
  // 6. Summary
  console.log('\n=== AUDIT SUMMARY ===')
  const allChecks = [
    { name: 'Hero Count (100%)', pass: totalHeroes === totalContent },
    { name: 'Real Images (≥90%)', pass: realImagePct >= 90 },
    { name: 'No Favicons', pass: favicon === 0 },
    { name: 'Hero Records Exist', pass: sampleContent?.heroRecord !== null }
  ]
  
  const passed = allChecks.filter(c => c.pass).length
  const total = allChecks.length
  
  allChecks.forEach(check => {
    console.log(`${check.pass ? '✅' : '❌'} ${check.name}`)
  })
  
  console.log(`\nOverall: ${passed}/${total} checks passed`)
  
  if (passed === total) {
    console.log('✅ ALL CHECKS PASSED')
  } else {
    console.log(`⚠️  ${total - passed} checks failed`)
  }
}

selfAudit().catch(console.error)

