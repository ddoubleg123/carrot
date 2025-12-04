/**
 * Comprehensive diagnosis of discovery issues
 * Checks all stages of the pipeline to identify where things are failing
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  const args = process.argv.slice(2)
  const patchHandle = args.find(a => a.startsWith('--patch='))?.split('=')[1] || 'israel'

  console.log(`\n=== Discovery Process Diagnosis ===\n`)
  console.log(`Patch: ${patchHandle}\n`)

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  // 1. Check Wikipedia pages
  console.log(`=== 1. Wikipedia Pages Status ===\n`)
  const wikiPages = await prisma.wikipediaMonitoring.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      wikipediaTitle: true,
      status: true,
      lastScannedAt: true,
      _count: {
        select: {
          citations: true
        }
      }
    }
  })

  console.log(`Total Wikipedia pages: ${wikiPages.length}`)
  wikiPages.slice(0, 5).forEach(page => {
    console.log(`  - ${page.wikipediaTitle}: ${page._count.citations} citations, status: ${page.status}`)
  })

  // 2. Check citations by status
  console.log(`\n=== 2. Citations Status Breakdown ===\n`)
  
  const citationStats = await prisma.wikipediaCitation.groupBy({
    by: ['verificationStatus', 'scanStatus', 'relevanceDecision'],
    where: {
      monitoring: {
        patchId: patch.id
      }
    },
    _count: true
  })

  console.log(`Total citations: ${citationStats.reduce((sum, s) => sum + s._count, 0)}`)
  console.log(`\nBreakdown:`)
  citationStats.forEach(stat => {
    console.log(`  ${stat.verificationStatus} / ${stat.scanStatus} / ${stat.relevanceDecision || 'null'}: ${stat._count}`)
  })

  // 3. Check citations ready to process
  console.log(`\n=== 3. Citations Ready to Process ===\n`)
  
  const readyToProcess = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: {
        patchId: patch.id
      },
      verificationStatus: { in: ['pending', 'verified', 'failed'] },
      scanStatus: 'not_scanned',
      relevanceDecision: null
    },
    take: 10,
    select: {
      id: true,
      citationUrl: true,
      verificationStatus: true,
      scanStatus: true,
      errorMessage: true
    }
  })

  console.log(`Citations ready to process: ${readyToProcess.length} (showing first 10)`)
  readyToProcess.forEach(c => {
    console.log(`  - ${c.citationUrl.substring(0, 80)}...`)
    console.log(`    Status: ${c.verificationStatus} / ${c.scanStatus}`)
    if (c.errorMessage) {
      console.log(`    Error: ${c.errorMessage.substring(0, 100)}`)
    }
  })

  // 4. Check processed citations (what happened to them)
  console.log(`\n=== 4. Processed Citations Analysis ===\n`)
  
  const processed = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: {
        patchId: patch.id
      },
      scanStatus: { in: ['scanning', 'scanned', 'scanned_denied'] }
    },
    take: 20,
    select: {
      id: true,
      citationUrl: true,
      verificationStatus: true,
      scanStatus: true,
      relevanceDecision: true,
      aiPriorityScore: true,
      contentText: true,
      errorMessage: true,
      savedContentId: true,
      savedMemoryId: true
    }
  })

  console.log(`Processed citations: ${processed.length} (showing first 20)`)
  
  const withContent = processed.filter(c => c.contentText && c.contentText.length > 0)
  const withScore = processed.filter(c => c.aiPriorityScore !== null)
  const saved = processed.filter(c => c.savedContentId !== null || c.savedMemoryId !== null)
  const denied = processed.filter(c => c.relevanceDecision === 'denied')
  const errors = processed.filter(c => c.errorMessage !== null)

  console.log(`\n  With content extracted: ${withContent.length}`)
  console.log(`  With AI score: ${withScore.length}`)
  console.log(`  Saved: ${saved.length}`)
  console.log(`  Denied: ${denied.length}`)
  console.log(`  With errors: ${errors.length}`)

  if (errors.length > 0) {
    console.log(`\n  Sample errors:`)
    errors.slice(0, 5).forEach(c => {
      console.log(`    - ${c.citationUrl.substring(0, 60)}...`)
      console.log(`      ${c.errorMessage?.substring(0, 150)}`)
    })
  }

  // 5. Check DiscoveredContent
  console.log(`\n=== 5. DiscoveredContent Status ===\n`)
  
  const discoveredContent = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    take: 10,
    select: {
      id: true,
      title: true,
      canonicalUrl: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  })

  console.log(`Total DiscoveredContent items: ${await prisma.discoveredContent.count({ where: { patchId: patch.id } })}`)
  console.log(`Recent items (last 10):`)
  discoveredContent.forEach(item => {
    console.log(`  - ${item.title?.substring(0, 60)}...`)
    console.log(`    ${item.canonicalUrl?.substring(0, 80)}...`)
    console.log(`    Created: ${item.createdAt}`)
  })

  // 6. Check discovery runs
  console.log(`\n=== 6. Discovery Runs Status ===\n`)
  
  const runs = await prisma.discoveryRun.findMany({
    where: { patchId: patch.id },
    take: 5,
    select: {
      id: true,
      status: true,
      startedAt: true,
      endedAt: true
    },
    orderBy: { startedAt: 'desc' }
  })

  console.log(`Recent runs: ${runs.length}`)
  runs.forEach(run => {
    console.log(`  - ${run.id}: ${run.status}`)
    console.log(`    Started: ${run.startedAt}`)
    console.log(`    Ended: ${run.endedAt || 'N/A'}`)
  })

  // 7. Check for common issues
  console.log(`\n=== 7. Common Issues Check ===\n`)
  
  // Issue 1: Citations stuck in not_scanned
  const stuckNotScanned = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: 'not_scanned',
      verificationStatus: { in: ['pending', 'verified'] }
    }
  })
  console.log(`Citations stuck in not_scanned: ${stuckNotScanned}`)

  // Issue 2: Citations with failed verification but not marked as denied
  const failedButNotDenied = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      verificationStatus: 'failed',
      relevanceDecision: null,
      scanStatus: 'not_scanned'
    }
  })
  console.log(`Failed verification but not denied: ${failedButNotDenied}`)

  // Issue 3: Citations with content but no score
  const contentNoScore = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      contentText: { not: null },
      aiPriorityScore: null,
      scanStatus: 'not_scanned'
    }
  })
  console.log(`Content extracted but no AI score: ${contentNoScore}`)

  // Issue 4: Citations with score >= 60 but not saved
  const highScoreNotSaved = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      aiPriorityScore: { gte: 60 },
      savedContentId: null,
      savedMemoryId: null,
      relevanceDecision: { not: 'saved' }
    },
    take: 10,
    select: {
      id: true,
      citationUrl: true,
      aiPriorityScore: true,
      relevanceDecision: true
    }
  })
  console.log(`High score (>=60) but not saved: ${highScoreNotSaved.length}`)
  if (highScoreNotSaved.length > 0) {
    console.log(`  Sample:`)
    highScoreNotSaved.slice(0, 5).forEach(c => {
      console.log(`    - Score: ${c.aiPriorityScore}, Decision: ${c.relevanceDecision || 'null'}`)
      console.log(`      ${c.citationUrl.substring(0, 80)}...`)
    })
  }

  console.log(`\n=== Diagnosis Complete ===\n`)

  process.exit(0)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

