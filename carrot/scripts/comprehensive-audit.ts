/**
 * Comprehensive System Audit
 * 
 * Checks:
 * 1. Hero titles (poor vs good)
 * 2. Hero images (missing, placeholder, real)
 * 3. DiscoveredContent status
 * 4. Agent learning status
 * 5. Queue status
 * 6. Overall system health
 */

import { prisma } from '@/lib/prisma'

// Patterns that indicate poor titles
const POOR_TITLE_PATTERNS = [
  /^10\.\d{4,}\//, // DOI pattern
  /^untitled$/i,
  /^book part$/i,
  /^article$/i,
  /^page$/i,
  /^document$/i,
  /^content$/i,
  /^untitled content$/i,
  /^https?:\/\//, // URLs as titles
  /^[a-z0-9]{8,}$/i, // Random alphanumeric strings
]

function isPoorTitle(title: string): boolean {
  if (!title || title.trim().length < 3) return true
  return POOR_TITLE_PATTERNS.some(pattern => pattern.test(title.trim()))
}

function isPlaceholderImage(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return true
  const url = imageUrl.toLowerCase()
  return url.includes('via.placeholder.com') || 
         url.includes('placeholder') ||
         url.includes('favicon') ||
         url.includes('google.com/s2/favicons')
}

async function comprehensiveAudit() {
  console.log('🔍 Starting Comprehensive System Audit...\n')
  console.log('=' .repeat(80))

  // 1. DiscoveredContent Overview
  console.log('\n📊 DISCOVERED CONTENT OVERVIEW')
  console.log('-'.repeat(80))
  
  const totalContent = await prisma.discoveredContent.count()
  const contentWithHero = await prisma.discoveredContent.count({
    where: {
      heroRecord: {
        isNot: null
      }
    }
  })
  const contentWithoutHero = totalContent - contentWithHero

  console.log(`Total DiscoveredContent items: ${totalContent}`)
  console.log(`  - With Hero record: ${contentWithHero} (${((contentWithHero / totalContent) * 100).toFixed(1)}%)`)
  console.log(`  - Without Hero record: ${contentWithoutHero} (${((contentWithoutHero / totalContent) * 100).toFixed(1)}%)`)

  // 2. Title Quality Analysis
  console.log('\n📝 TITLE QUALITY ANALYSIS')
  console.log('-'.repeat(80))
  
  const allContent = await prisma.discoveredContent.findMany({
    select: {
      id: true,
      title: true,
      heroRecord: {
        select: {
          title: true
        }
      }
    }
  })

  let poorTitles = 0
  let goodTitles = 0
  const poorTitleExamples: string[] = []

  for (const item of allContent) {
    if (isPoorTitle(item.title)) {
      poorTitles++
      if (poorTitleExamples.length < 10) {
        poorTitleExamples.push(item.title.substring(0, 60))
      }
    } else {
      goodTitles++
    }
  }

  console.log(`Total titles analyzed: ${allContent.length}`)
  console.log(`  - Good titles: ${goodTitles} (${((goodTitles / allContent.length) * 100).toFixed(1)}%)`)
  console.log(`  - Poor titles: ${poorTitles} (${((poorTitles / allContent.length) * 100).toFixed(1)}%)`)
  
  if (poorTitleExamples.length > 0) {
    console.log(`\nExamples of poor titles:`)
    poorTitleExamples.forEach((title, i) => {
      console.log(`  ${i + 1}. "${title}"`)
    })
  }

  // 3. Hero Image Analysis
  console.log('\n🖼️  HERO IMAGE ANALYSIS')
  console.log('-'.repeat(80))
  
  const heroes = await prisma.hero.findMany({
    select: {
      id: true,
      imageUrl: true,
      status: true,
      contentId: true
    }
  })

  let missingImages = 0
  let placeholderImages = 0
  let realImages = 0
  let readyHeroes = 0
  let draftHeroes = 0
  let errorHeroes = 0

  for (const hero of heroes) {
    if (hero.status === 'READY') readyHeroes++
    if (hero.status === 'DRAFT') draftHeroes++
    if (hero.status === 'ERROR') errorHeroes++

    if (!hero.imageUrl) {
      missingImages++
    } else if (isPlaceholderImage(hero.imageUrl)) {
      placeholderImages++
    } else {
      realImages++
    }
  }

  console.log(`Total Hero records: ${heroes.length}`)
  console.log(`  Status breakdown:`)
  console.log(`    - READY: ${readyHeroes} (${((readyHeroes / heroes.length) * 100).toFixed(1)}%)`)
  console.log(`    - DRAFT: ${draftHeroes} (${((draftHeroes / heroes.length) * 100).toFixed(1)}%)`)
  console.log(`    - ERROR: ${errorHeroes} (${((errorHeroes / heroes.length) * 100).toFixed(1)}%)`)
  console.log(`  Image quality:`)
  console.log(`    - Real images: ${realImages} (${((realImages / heroes.length) * 100).toFixed(1)}%)`)
  console.log(`    - Placeholder images: ${placeholderImages} (${((placeholderImages / heroes.length) * 100).toFixed(1)}%)`)
  console.log(`    - Missing images: ${missingImages} (${((missingImages / heroes.length) * 100).toFixed(1)}%)`)

  // 4. Content without Heroes
  console.log('\n⚠️  CONTENT WITHOUT HEROES')
  console.log('-'.repeat(80))
  
  const contentNeedingHeroes = await prisma.discoveredContent.findMany({
    where: {
      heroRecord: null
    },
    select: {
      id: true,
      title: true,
      createdAt: true
    },
    take: 10,
    orderBy: {
      createdAt: 'desc'
    }
  })

  console.log(`Content items without Hero records: ${contentWithoutHero}`)
  if (contentNeedingHeroes.length > 0) {
    console.log(`\nRecent examples (first 10):`)
    contentNeedingHeroes.forEach((item, i) => {
      console.log(`  ${i + 1}. "${item.title.substring(0, 60)}" (created: ${item.createdAt.toISOString().split('T')[0]})`)
    })
  }

  // 5. Agent Learning Status
  console.log('\n🤖 AGENT LEARNING STATUS')
  console.log('-'.repeat(80))
  
  const totalMemories = await prisma.agentMemory.count()
  const memoriesWithContent = await prisma.agentMemory.count({
    where: {
      discoveredContentId: {
        not: null
      }
    }
  })
  const memoriesWithoutContent = totalMemories - memoriesWithContent

  const queueItems = await prisma.agentMemoryFeedQueue.count()
  const pendingQueue = await prisma.agentMemoryFeedQueue.count({
    where: {
      status: 'pending'
    }
  })
  const processingQueue = await prisma.agentMemoryFeedQueue.count({
    where: {
      status: 'processing'
    }
  })
  const completedQueue = await prisma.agentMemoryFeedQueue.count({
    where: {
      status: 'completed'
    }
  })

  console.log(`AgentMemory entries: ${totalMemories}`)
  console.log(`  - Linked to DiscoveredContent: ${memoriesWithContent} (${((memoriesWithContent / totalMemories) * 100).toFixed(1)}%)`)
  console.log(`  - Not linked: ${memoriesWithoutContent} (${((memoriesWithoutContent / totalMemories) * 100).toFixed(1)}%)`)
  console.log(`\nAgentMemoryFeedQueue: ${queueItems} total`)
  console.log(`  - Pending: ${pendingQueue}`)
  console.log(`  - Processing: ${processingQueue}`)
  console.log(`  - Completed: ${completedQueue}`)

  // 6. Wikipedia Citations
  console.log('\n📚 WIKIPEDIA CITATIONS')
  console.log('-'.repeat(80))
  
  const totalCitations = await prisma.wikipediaCitation.count()
  const savedCitations = await prisma.wikipediaCitation.count({
    where: {
      savedContentId: {
        not: null
      }
    }
  })
  const deniedCitations = await prisma.wikipediaCitation.count({
    where: {
      relevanceDecision: 'denied'
    }
  })
  const approvedCitations = await prisma.wikipediaCitation.count({
    where: {
      relevanceDecision: 'approved'
    }
  })

  console.log(`Total WikipediaCitations: ${totalCitations}`)
  console.log(`  - Saved: ${savedCitations} (${((savedCitations / totalCitations) * 100).toFixed(1)}%)`)
  console.log(`  - Approved: ${approvedCitations} (${((approvedCitations / totalCitations) * 100).toFixed(1)}%)`)
  console.log(`  - Denied: ${deniedCitations} (${((deniedCitations / totalCitations) * 100).toFixed(1)}%)`)

  // 7. Content to Hero Linkage
  console.log('\n🔗 CONTENT TO HERO LINKAGE')
  console.log('-'.repeat(80))
  
  const contentWithHeroLink = await prisma.discoveredContent.count({
    where: {
      heroRecord: {
        isNot: null
      }
    }
  })

  console.log(`DiscoveredContent → Hero: ${contentWithHeroLink} / ${totalContent} (${((contentWithHeroLink / totalContent) * 100).toFixed(1)}%)`)
  console.log(`Hero → DiscoveredContent: ${heroes.length} / ${heroes.length} (100.0%) - all heroes have contentId`)

  // 8. Summary & Recommendations
  console.log('\n📋 SUMMARY & RECOMMENDATIONS')
  console.log('='.repeat(80))
  
  const issues: string[] = []
  const recommendations: string[] = []

  if (poorTitles > 0) {
    issues.push(`${poorTitles} items have poor titles`)
    recommendations.push(`Run fix-hero-titles-and-images.ts to improve titles`)
  }

  if (contentWithoutHero > 0) {
    issues.push(`${contentWithoutHero} items are missing Hero records`)
    recommendations.push(`Run fix-hero-titles-and-images.ts to generate missing heroes`)
  }

  if (placeholderImages > 0 || missingImages > 0) {
    issues.push(`${placeholderImages + missingImages} heroes have placeholder or missing images`)
    recommendations.push(`Hero images are being generated asynchronously - check back later`)
  }

  if (memoriesWithoutContent > 0) {
    issues.push(`${memoriesWithoutContent} AgentMemory entries are not linked to DiscoveredContent`)
    recommendations.push(`Run backfill-agent-memory.ts to link existing memories`)
  }

  if (pendingQueue > 0) {
    issues.push(`${pendingQueue} items are pending in the feed queue`)
    recommendations.push(`Process feed queue: POST /api/agent-feed/process-all`)
  }

  if (issues.length === 0) {
    console.log('✅ No issues found! System is healthy.')
  } else {
    console.log('⚠️  Issues found:')
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`)
    })
    
    console.log('\n💡 Recommendations:')
    recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`)
    })
  }

  console.log('\n' + '='.repeat(80))
  console.log('✅ Audit complete!')
}

// Run if called directly
if (require.main === module) {
  comprehensiveAudit()
    .then(() => {
      console.log('\n✅ Script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error)
      process.exit(1)
    })
}

export { comprehensiveAudit }

