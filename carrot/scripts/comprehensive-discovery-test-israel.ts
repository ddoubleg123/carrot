/**
 * Comprehensive Discovery Test for Israel Patch
 * 
 * Tests the entire discovery process end-to-end and generates a full report
 * with KPIs, analysis of what's working and not working.
 * 
 * Run with: npx tsx scripts/comprehensive-discovery-test-israel.ts
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { runOpenEvidenceEngine } from '../src/lib/discovery/engine'
import { seedFrontierFromPlan, generateGuideSnapshot } from '../src/lib/discovery/planner'
import { clearFrontier, storeDiscoveryPlan } from '../src/lib/redis/discovery'
import { MultiSourceOrchestrator } from '../src/lib/discovery/multiSourceOrchestrator'
import { AgentRegistry } from '../src/lib/ai-agents/agentRegistry'

interface TestKPIs {
  // Discovery Process
  discoveryStartTime: Date
  discoveryEndTime?: Date
  discoveryDuration?: number
  
  // Sources Discovered
  wikipediaPages: number
  wikipediaCitations: number
  newsArticles: number
  annasArchiveBooks: number
  totalSources: number
  
  // Data Extraction
  citationsExtracted: number
  citationsWithContent: number
  contentExtractionRate: number
  
  // Storage
  discoveredContentSaved: number
  agentMemoriesCreated: number
  heroesCreated: number
  
  // Wikipedia Deep Links
  deepLinksFound: number
  deepLinksProcessed: number
  deepLinkProcessingRate: number
  
  // Images
  wikimediaImagesFound: number
  wikimediaImagesWorking: number
  imageSuccessRate: number
  
  // Agent Learning
  agentExists: boolean
  agentMemoriesBefore: number
  agentMemoriesAfter: number
  memoriesAdded: number
  
  // Errors
  errors: string[]
  warnings: string[]
}

interface TestReport {
  kpis: TestKPIs
  wikipediaAnalysis: {
    pagesMonitored: number
    citationsExtracted: number
    deepLinksProcessed: number
    sampleDeepLinks: string[]
  }
  sourceAnalysis: {
    wikipedia: { found: number; saved: number }
    news: { found: number; saved: number }
    annasArchive: { found: number; saved: number }
  }
  storageAnalysis: {
    discoveredContentCount: number
    agentMemoryCount: number
    heroCount: number
    sampleContent: Array<{ id: string; title: string; source: string }>
  }
  imageAnalysis: {
    totalImages: number
    wikimediaImages: number
    workingImages: number
    brokenImages: number
    sampleImages: string[]
  }
  agentAnalysis: {
    agentExists: boolean
    memoriesBefore: number
    memoriesAfter: number
    feedQueueStatus: any
    recentMemories: any[]
  }
  issues: {
    critical: string[]
    warnings: string[]
    recommendations: string[]
  }
}

async function runComprehensiveTest(): Promise<TestReport> {
  const patchHandle = 'israel'
  const kpis: TestKPIs = {
    discoveryStartTime: new Date(),
    wikipediaPages: 0,
    wikipediaCitations: 0,
    newsArticles: 0,
    annasArchiveBooks: 0,
    totalSources: 0,
    citationsExtracted: 0,
    citationsWithContent: 0,
    contentExtractionRate: 0,
    discoveredContentSaved: 0,
    agentMemoriesCreated: 0,
    heroesCreated: 0,
    deepLinksFound: 0,
    deepLinksProcessed: 0,
    deepLinkProcessingRate: 0,
    wikimediaImagesFound: 0,
    wikimediaImagesWorking: 0,
    imageSuccessRate: 0,
    agentExists: false,
    agentMemoriesBefore: 0,
    agentMemoriesAfter: 0,
    memoriesAdded: 0,
    errors: [],
    warnings: []
  }

  console.log('\n' + '='.repeat(80))
  console.log('COMPREHENSIVE DISCOVERY TEST - ISRAEL PATCH')
  console.log('='.repeat(80) + '\n')

  // Step 1: Get Patch Info
  console.log('📋 Step 1: Getting patch information...')
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: {
      id: true,
      title: true,
      description: true,
      tags: true,
      entity: true,
      guide: true,
      createdAt: true
    }
  })

  if (!patch) {
    throw new Error(`Patch "${patchHandle}" not found`)
  }

  console.log(`✅ Patch found: ${patch.title}`)
  console.log(`   ID: ${patch.id}`)
  console.log(`   Description: ${patch.description?.substring(0, 100)}...`)
  console.log(`   Tags: ${patch.tags.join(', ')}\n`)

  // Step 2: Check Agent Status Before
  console.log('🤖 Step 2: Checking agent status (before discovery)...')
  const agents = await AgentRegistry.getAgentsByPatches([patch.id])
  const agent = agents.length > 0 ? agents[0] : null
  kpis.agentExists = !!agent

  if (agent) {
    kpis.agentMemoriesBefore = await prisma.agentMemory.count({
      where: { agentId: agent.id }
    })
    console.log(`✅ Agent found: ${agent.name}`)
    console.log(`   Memories before: ${kpis.agentMemoriesBefore}\n`)
  } else {
    console.log(`⚠️  No agent found for this patch\n`)
    kpis.warnings.push('No agent exists for this patch')
  }

  // Step 3: Test MultiSourceOrchestrator
  console.log('🔍 Step 3: Testing MultiSourceOrchestrator...')
  try {
    const orchestrator = new MultiSourceOrchestrator()
    const discoveryResult = await orchestrator.discover(
      patch.title,
      patch.description || '',
      patch.tags.filter((t): t is string => typeof t === 'string')
    )

    kpis.wikipediaPages = discoveryResult.stats.wikipediaPages
    kpis.wikipediaCitations = discoveryResult.stats.wikipediaCitations
    kpis.newsArticles = discoveryResult.stats.newsArticles
    kpis.annasArchiveBooks = discoveryResult.stats.annasArchiveBooks
    kpis.totalSources = discoveryResult.stats.totalSources

    console.log(`✅ MultiSourceOrchestrator Results:`)
    console.log(`   Wikipedia pages: ${kpis.wikipediaPages}`)
    console.log(`   Wikipedia citations: ${kpis.wikipediaCitations}`)
    console.log(`   News articles: ${kpis.newsArticles}`)
    console.log(`   Anna's Archive books: ${kpis.annasArchiveBooks}`)
    console.log(`   Total sources: ${kpis.totalSources}`)
    console.log(`   Duplicates removed: ${discoveryResult.stats.duplicatesRemoved}\n`)
  } catch (error: any) {
    console.error(`❌ MultiSourceOrchestrator failed: ${error.message}\n`)
    kpis.errors.push(`MultiSourceOrchestrator: ${error.message}`)
  }

  // Step 4: Start Full Discovery Process
  console.log('🚀 Step 4: Starting full discovery process...')
  try {
    // Create discovery run
    const run = await (prisma as any).discoveryRun.create({
      data: {
        patchId: patch.id,
        status: 'queued'
      }
    })

    // Generate or get guide
    let guide = patch.guide as any
    if (!guide || !guide.seedCandidates) {
      console.log('   Generating discovery plan...')
      const entity = (patch.entity ?? {}) as { name?: string; aliases?: string[] }
      const topic = entity?.name && entity.name.trim().length ? entity.name.trim() : patch.title
      const aliases = Array.isArray(entity?.aliases) && entity.aliases.length
        ? entity.aliases.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : patch.tags.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

      guide = await generateGuideSnapshot(topic, aliases)
      await prisma.patch.update({
        where: { id: patch.id },
        data: { guide: guide as any }
      })
      console.log(`   ✅ Generated plan with ${guide.seedCandidates?.length || 0} seed candidates`)
    }

    // Clear frontier and seed (skip if Redis not available)
    if (process.env.REDIS_URL) {
      await clearFrontier(patch.id).catch(() => undefined)
      await storeDiscoveryPlan(run.id, guide).catch(() => undefined)
    } else {
      console.log('   ⚠️  REDIS_URL not set - skipping frontier operations')
      kpis.warnings.push('REDIS_URL not set - frontier operations skipped')
    }
    await seedFrontierFromPlan(patch.id, guide)

    // Mark run as live
    await (prisma as any).discoveryRun.update({
      where: { id: run.id },
      data: { status: 'live', startedAt: new Date() }
    })

    console.log(`   ✅ Discovery run created: ${run.id}`)
    console.log(`   ⏳ Starting engine (this will run in background)...\n`)

    // Start engine (non-blocking)
    runOpenEvidenceEngine({
      patchId: patch.id,
      patchHandle: patchHandle,
      patchName: patch.title,
      runId: run.id
    }).catch((error) => {
      console.error(`   ❌ Engine failed: ${error.message}`)
      kpis.errors.push(`Discovery engine: ${error.message}`)
    })

    // Wait a bit for initial processing
    console.log('   ⏳ Waiting 30 seconds for initial processing...')
    await new Promise(resolve => setTimeout(resolve, 30000))
  } catch (error: any) {
    console.error(`❌ Failed to start discovery: ${error.message}\n`)
    kpis.errors.push(`Discovery start: ${error.message}`)
  }

  // Step 5: Analyze Wikipedia Deep Links
  console.log('📚 Step 5: Analyzing Wikipedia deep links...')
  const wikipediaPages = await prisma.wikipediaMonitoring.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      wikipediaTitle: true,
      wikipediaUrl: true,
      citationsExtracted: true,
      citationCount: true,
      status: true
    }
  })

  kpis.wikipediaPages = wikipediaPages.length
  kpis.citationsExtracted = wikipediaPages.reduce((sum, page) => sum + (page.citationCount || 0), 0)

  // Get citations from monitored pages
  const monitoredPageIds = wikipediaPages.map(p => p.id)
  const allCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoringId: { in: monitoredPageIds }
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      verificationStatus: true,
      savedContentId: true
    },
    take: 1000 // Get more and filter manually
  })

  // Filter out null URLs
  const wikipediaCitations = allCitations.filter(c => c.citationUrl !== null)
  
  kpis.deepLinksFound = wikipediaCitations.length
  kpis.deepLinksProcessed = wikipediaCitations.filter(c => c.verificationStatus === 'verified' || c.savedContentId).length
  kpis.deepLinkProcessingRate = kpis.deepLinksFound > 0 
    ? (kpis.deepLinksProcessed / kpis.deepLinksFound) * 100 
    : 0

  console.log(`   Wikipedia pages monitored: ${kpis.wikipediaPages}`)
  console.log(`   Citations found: ${kpis.citationsExtracted}`)
  console.log(`   Deep links found: ${kpis.deepLinksFound}`)
  console.log(`   Deep links processed: ${kpis.deepLinksProcessed} (${kpis.deepLinkProcessingRate.toFixed(1)}%)\n`)

  // Step 6: Analyze Data Extraction
  console.log('📊 Step 6: Analyzing data extraction...')
  const discoveredContent = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      title: true,
      canonicalUrl: true,
      sourceDomain: true,
      sourceUrl: true,
      textContent: true,
      summary: true
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  })

  kpis.discoveredContentSaved = await prisma.discoveredContent.count({
    where: { patchId: patch.id }
  })

  kpis.citationsWithContent = discoveredContent.filter(c => 
    c.textContent && c.textContent.length > 0
  ).length

  kpis.contentExtractionRate = discoveredContent.length > 0
    ? (kpis.citationsWithContent / discoveredContent.length) * 100
    : 0

  console.log(`   Total discovered content saved: ${kpis.discoveredContentSaved}`)
  console.log(`   Content with text extracted: ${kpis.citationsWithContent}`)
  console.log(`   Content extraction rate: ${kpis.contentExtractionRate.toFixed(1)}%\n`)

  // Step 7: Analyze Sources
  console.log('🔗 Step 7: Analyzing sources...')
  const sourceBreakdown = {
    wikipedia: { found: 0, saved: 0 },
    news: { found: 0, saved: 0 },
    annasArchive: { found: 0, saved: 0 }
  }

  sourceBreakdown.wikipedia.saved = await prisma.discoveredContent.count({
    where: {
      patchId: patch.id,
      sourceDomain: { contains: 'wikipedia.org' }
    }
  })

  sourceBreakdown.news.saved = await prisma.discoveredContent.count({
    where: {
      patchId: patch.id,
      OR: [
        { sourceDomain: { contains: 'news' } },
        { sourceDomain: { contains: 'bbc' } },
        { sourceDomain: { contains: 'reuters' } },
        { sourceDomain: { contains: 'ap.org' } }
      ]
    }
  })

  // Check for Anna's Archive sources - may be in sourceDomain, sourceUrl, or metadata
  sourceBreakdown.annasArchive.saved = await prisma.discoveredContent.count({
    where: {
      patchId: patch.id,
      OR: [
        { sourceDomain: { contains: 'annas-archive.org' } },
        { sourceUrl: { contains: 'annas-archive.org' } },
        { canonicalUrl: { contains: 'annas-archive.org' } },
        { category: { equals: 'book' } },
        { metadata: { path: ['source'], equals: 'annas-archive' } }
      ]
    }
  })

  console.log(`   Wikipedia: ${sourceBreakdown.wikipedia.saved} saved`)
  console.log(`   News: ${sourceBreakdown.news.saved} saved`)
  console.log(`   Anna's Archive: ${sourceBreakdown.annasArchive.saved} saved\n`)

  // Step 8: Analyze Images
  console.log('🖼️  Step 8: Analyzing Wikimedia images...')
  const heroes = await prisma.hero.findMany({
    where: { 
      content: {
        patchId: patch.id
      }
    },
    select: {
      id: true,
      imageUrl: true,
      status: true
    },
    take: 50
  })

  kpis.heroesCreated = await prisma.hero.count({
    where: { 
      content: {
        patchId: patch.id
      }
    }
  })

  const wikimediaImages = heroes.filter(h => 
    h.imageUrl && (h.imageUrl.includes('wikimedia.org') || h.imageUrl.includes('wikipedia.org'))
  )
  kpis.wikimediaImagesFound = wikimediaImages.length

  // Test image URLs (sample)
  let workingImages = 0
  const imageSamples: string[] = []
  for (const hero of wikimediaImages.slice(0, 10)) {
    if (hero.imageUrl) {
      imageSamples.push(hero.imageUrl)
      try {
        const response = await fetch(hero.imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
        if (response.ok) {
          workingImages++
        }
      } catch {
        // Image failed
      }
    }
  }

  kpis.wikimediaImagesWorking = workingImages
  kpis.imageSuccessRate = wikimediaImages.length > 0
    ? (workingImages / Math.min(wikimediaImages.length, 10)) * 100
    : 0

  console.log(`   Total heroes: ${kpis.heroesCreated}`)
  console.log(`   Wikimedia images: ${kpis.wikimediaImagesFound}`)
  console.log(`   Working images (sample): ${workingImages}/10`)
  console.log(`   Image success rate: ${kpis.imageSuccessRate.toFixed(1)}%\n`)

  // Step 9: Check Agent Learning After
  console.log('🧠 Step 9: Checking agent learning (after discovery)...')
  if (agent) {
    kpis.agentMemoriesAfter = await prisma.agentMemory.count({
      where: { agentId: agent.id }
    })
    kpis.memoriesAdded = kpis.agentMemoriesAfter - kpis.agentMemoriesBefore

    const feedQueue = await (prisma as any).agentMemoryFeedQueue.findMany({
      where: { patchId: patch.id },
      select: { id: true, status: true, enqueuedAt: true },
      take: 20
    })

    console.log(`   Memories after: ${kpis.agentMemoriesAfter}`)
    console.log(`   Memories added: ${kpis.memoriesAdded}`)
    console.log(`   Feed queue items: ${feedQueue.length}\n`)
  }

  // Step 10: Generate Report
  kpis.discoveryEndTime = new Date()
  kpis.discoveryDuration = kpis.discoveryEndTime.getTime() - kpis.discoveryStartTime.getTime()

  const report: TestReport = {
    kpis,
    wikipediaAnalysis: {
      pagesMonitored: kpis.wikipediaPages,
      citationsExtracted: kpis.citationsExtracted,
      deepLinksProcessed: kpis.deepLinksProcessed,
      sampleDeepLinks: wikipediaCitations.slice(0, 5).map(c => c.citationUrl || '').filter(Boolean)
    },
    sourceAnalysis: sourceBreakdown,
    storageAnalysis: {
      discoveredContentCount: kpis.discoveredContentSaved,
      agentMemoryCount: kpis.agentMemoriesAfter,
      heroCount: kpis.heroesCreated,
      sampleContent: discoveredContent.slice(0, 10).map(c => ({
        id: c.id,
        title: c.title || 'Untitled',
        source: c.sourceDomain || 'unknown'
      }))
    },
    imageAnalysis: {
      totalImages: kpis.heroesCreated,
      wikimediaImages: kpis.wikimediaImagesFound,
      workingImages: kpis.wikimediaImagesWorking,
      brokenImages: kpis.wikimediaImagesFound - kpis.wikimediaImagesWorking,
      sampleImages: imageSamples.slice(0, 5)
    },
    agentAnalysis: {
      agentExists: kpis.agentExists,
      memoriesBefore: kpis.agentMemoriesBefore,
      memoriesAfter: kpis.agentMemoriesAfter,
      feedQueueStatus: agent ? await (prisma as any).agentMemoryFeedQueue.groupBy({
        by: ['status'],
        where: { patchId: patch.id },
        _count: true
      }) : [],
      recentMemories: agent ? await prisma.agentMemory.findMany({
        where: { agentId: agent.id },
        select: { id: true, sourceTitle: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5
      }) : []
    },
    issues: {
      critical: kpis.errors,
      warnings: kpis.warnings,
      recommendations: []
    }
  }

  // Generate recommendations
  if (kpis.contentExtractionRate < 50) {
    report.issues.recommendations.push('Content extraction rate is low - review extraction process')
  }
  if (kpis.deepLinkProcessingRate < 70) {
    report.issues.recommendations.push('Deep link processing rate is low - investigate processing pipeline')
  }
  if (kpis.imageSuccessRate < 80) {
    report.issues.recommendations.push('Image success rate is low - check Wikimedia image URLs')
  }
  if (!kpis.agentExists) {
    report.issues.recommendations.push('No agent exists - create agent for this patch')
  }
  if (kpis.memoriesAdded === 0 && kpis.discoveredContentSaved > 0) {
    report.issues.recommendations.push('Agent not learning from discovered content - check feed pipeline')
  }

  return report
}

function printReport(report: TestReport) {
  console.log('\n' + '='.repeat(80))
  console.log('COMPREHENSIVE DISCOVERY TEST REPORT - ISRAEL PATCH')
  console.log('='.repeat(80) + '\n')

  // KPIs
  console.log('📊 KEY PERFORMANCE INDICATORS\n')
  console.log(`Discovery Duration: ${(report.kpis.discoveryDuration || 0) / 1000}s`)
  console.log(`Total Sources Discovered: ${report.kpis.totalSources}`)
  console.log(`  - Wikipedia Pages: ${report.kpis.wikipediaPages}`)
  console.log(`  - Wikipedia Citations: ${report.kpis.wikipediaCitations}`)
  console.log(`  - News Articles: ${report.kpis.newsArticles}`)
  console.log(`  - Anna's Archive Books: ${report.kpis.annasArchiveBooks}`)
  console.log(`\nContent Saved: ${report.kpis.discoveredContentSaved}`)
  console.log(`Content Extraction Rate: ${report.kpis.contentExtractionRate.toFixed(1)}%`)
  console.log(`Deep Links Processed: ${report.kpis.deepLinksProcessed}/${report.kpis.deepLinksFound} (${report.kpis.deepLinkProcessingRate.toFixed(1)}%)`)
  console.log(`Heroes Created: ${report.kpis.heroesCreated}`)
  console.log(`Wikimedia Images Working: ${report.kpis.wikimediaImagesWorking}/${report.kpis.wikimediaImagesFound} (${report.kpis.imageSuccessRate.toFixed(1)}%)`)
  console.log(`Agent Memories: ${report.kpis.agentMemoriesBefore} → ${report.kpis.agentMemoriesAfter} (+${report.kpis.memoriesAdded})\n`)

  // Wikipedia Analysis
  console.log('📚 WIKIPEDIA ANALYSIS\n')
  console.log(`Pages Monitored: ${report.wikipediaAnalysis.pagesMonitored}`)
  console.log(`Citations Extracted: ${report.wikipediaAnalysis.citationsExtracted}`)
  console.log(`Deep Links Processed: ${report.wikipediaAnalysis.deepLinksProcessed}`)
  console.log(`Sample Deep Links:`)
  report.wikipediaAnalysis.sampleDeepLinks.forEach((link, i) => {
    console.log(`  ${i + 1}. ${link}`)
  })
  console.log()

  // Source Analysis
  console.log('🔗 SOURCE ANALYSIS\n')
  console.log(`Wikipedia: ${report.sourceAnalysis.wikipedia.saved} saved`)
  console.log(`News: ${report.sourceAnalysis.news.saved} saved`)
  console.log(`Anna's Archive: ${report.sourceAnalysis.annasArchive.saved} saved\n`)

  // Storage Analysis
  console.log('💾 STORAGE ANALYSIS\n')
  console.log(`Discovered Content: ${report.storageAnalysis.discoveredContentCount}`)
  console.log(`Agent Memories: ${report.storageAnalysis.agentMemoryCount}`)
  console.log(`Heroes: ${report.storageAnalysis.heroCount}`)
  console.log(`Sample Content:`)
  report.storageAnalysis.sampleContent.forEach((content, i) => {
    console.log(`  ${i + 1}. ${content.title} (${content.source})`)
  })
  console.log()

  // Image Analysis
  console.log('🖼️  IMAGE ANALYSIS\n')
  console.log(`Total Images: ${report.imageAnalysis.totalImages}`)
  console.log(`Wikimedia Images: ${report.imageAnalysis.wikimediaImages}`)
  console.log(`Working Images: ${report.imageAnalysis.workingImages}`)
  console.log(`Broken Images: ${report.imageAnalysis.brokenImages}`)
  console.log(`Sample Images:`)
  report.imageAnalysis.sampleImages.forEach((img, i) => {
    console.log(`  ${i + 1}. ${img}`)
  })
  console.log()

  // Agent Analysis
  console.log('🤖 AGENT ANALYSIS\n')
  console.log(`Agent Exists: ${report.agentAnalysis.agentExists ? '✅' : '❌'}`)
  console.log(`Memories: ${report.agentAnalysis.memoriesBefore} → ${report.agentAnalysis.memoriesAfter}`)
  console.log(`Feed Queue Status:`)
  report.agentAnalysis.feedQueueStatus.forEach((status: any) => {
    console.log(`  - ${status.status}: ${status._count}`)
  })
  console.log(`Recent Memories:`)
  report.agentAnalysis.recentMemories.forEach((memory, i) => {
    console.log(`  ${i + 1}. ${memory.sourceTitle || 'Untitled'} (${memory.createdAt.toISOString()})`)
  })
  console.log()

  // Issues
  console.log('⚠️  ISSUES & RECOMMENDATIONS\n')
  if (report.issues.critical.length > 0) {
    console.log('Critical Issues:')
    report.issues.critical.forEach((issue, i) => {
      console.log(`  ${i + 1}. ❌ ${issue}`)
    })
    console.log()
  }
  if (report.issues.warnings.length > 0) {
    console.log('Warnings:')
    report.issues.warnings.forEach((warning, i) => {
      console.log(`  ${i + 1}. ⚠️  ${warning}`)
    })
    console.log()
  }
  if (report.issues.recommendations.length > 0) {
    console.log('Recommendations:')
    report.issues.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. 💡 ${rec}`)
    })
    console.log()
  }

  console.log('='.repeat(80) + '\n')
}

async function main() {
  try {
    const report = await runComprehensiveTest()
    printReport(report)
    
    // Save report to file
    const fs = await import('fs/promises')
    const reportJson = JSON.stringify(report, null, 2)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportFile = `carrot/reports/discovery-test-israel-${timestamp}.json`
    await fs.mkdir('carrot/reports', { recursive: true })
    await fs.writeFile(reportFile, reportJson)
    console.log(`\n📄 Full report saved to: ${reportFile}\n`)
    
  } catch (error) {
    console.error('Test failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

