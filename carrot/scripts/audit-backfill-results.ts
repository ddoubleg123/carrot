/**
 * Audit Backfill Results
 * 
 * Verifies that backfills were successful and identifies any remaining issues
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const PATCH_HANDLE = process.argv[2] || 'israel'

interface AuditResults {
  citations: {
    totalWithHighScore: number
    totalSaved: number
    stillUnsaved: number
    saveRate: number
    scoreBreakdown: Record<string, { total: number; saved: number }>
  }
  heroes: {
    totalContent: number
    withHeroes: number
    withoutHeroes: number
    coverage: number
  }
  memories: {
    totalSavedContent: number
    withMemories: number
    inQueue: number
    missing: number
    coverage: number
  }
  deepLinks: {
    totalDeepLinks: number
    saved: number
    unsaved: number
    saveRate: number
  }
}

async function auditCitations(patchId: string): Promise<AuditResults['citations']> {
  console.log('\n📚 Auditing Citations...')

  // Get all citations with score >= 50
  const allHighScoreCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId },
      aiPriorityScore: { gte: 50 }
    },
    select: {
      id: true,
      aiPriorityScore: true,
      relevanceDecision: true,
      savedContentId: true
    }
  })

  const savedCitations = allHighScoreCitations.filter(c => 
    c.relevanceDecision === 'saved' && c.savedContentId !== null
  )

  const scoreBreakdown: Record<string, { total: number; saved: number }> = {
    '90-100': { total: 0, saved: 0 },
    '80-89': { total: 0, saved: 0 },
    '70-79': { total: 0, saved: 0 },
    '60-69': { total: 0, saved: 0 },
    '50-59': { total: 0, saved: 0 }
  }

  allHighScoreCitations.forEach(c => {
    const score = c.aiPriorityScore || 0
    let range: keyof typeof scoreBreakdown
    if (score >= 90) range = '90-100'
    else if (score >= 80) range = '80-89'
    else if (score >= 70) range = '70-79'
    else if (score >= 60) range = '60-69'
    else range = '50-59'

    scoreBreakdown[range].total++
    if (c.relevanceDecision === 'saved' && c.savedContentId !== null) {
      scoreBreakdown[range].saved++
    }
  })

  const stillUnsaved = allHighScoreCitations.length - savedCitations.length
  const saveRate = allHighScoreCitations.length > 0 
    ? (savedCitations.length / allHighScoreCitations.length) * 100 
    : 0

  return {
    totalWithHighScore: allHighScoreCitations.length,
    totalSaved: savedCitations.length,
    stillUnsaved,
    saveRate,
    scoreBreakdown
  }
}

async function auditHeroes(patchId: string): Promise<AuditResults['heroes']> {
  console.log('\n🎨 Auditing Hero Images...')

  const totalContent = await prisma.discoveredContent.count({
    where: { patchId }
  })

  const contentIds = await prisma.discoveredContent.findMany({
    where: { patchId },
    select: { id: true }
  })

  const withHeroes = await prisma.hero.count({
    where: {
      contentId: { in: contentIds.map(c => c.id) }
    }
  })

  const withoutHeroes = totalContent - withHeroes
  const coverage = totalContent > 0 ? (withHeroes / totalContent) * 100 : 0

  return {
    totalContent,
    withHeroes,
    withoutHeroes,
    coverage
  }
}

async function auditMemories(patchId: string): Promise<AuditResults['memories']> {
  console.log('\n🤖 Auditing Agent Memories...')

  const totalSavedContent = await prisma.discoveredContent.count({
    where: { patchId }
  })

  const contentIds = await prisma.discoveredContent.findMany({
    where: { patchId },
    select: { id: true }
  })

  const withMemories = await prisma.agentMemory.count({
    where: {
      discoveredContentId: { in: contentIds.map(c => c.id) }
    }
  })

  const inQueue = await (prisma as any).agentMemoryFeedQueue.count({
    where: {
      discoveredContentId: { in: contentIds.map(c => c.id) },
      patchId,
      status: { in: ['PENDING', 'PROCESSING'] }
    }
  })

  const missing = totalSavedContent - withMemories - inQueue
  const coverage = totalSavedContent > 0 
    ? ((withMemories + inQueue) / totalSavedContent) * 100 
    : 0

  return {
    totalSavedContent,
    withMemories,
    inQueue,
    missing,
    coverage
  }
}

async function auditDeepLinks(patchId: string): Promise<AuditResults['deepLinks']> {
  console.log('\n🔗 Auditing Deep Links...')

  // Deep links are Wikipedia citations that are external (not Wikipedia)
  const allDeepLinks = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId },
      citationUrl: { not: { contains: 'wikipedia.org' } },
      verificationStatus: { in: ['pending', 'verified'] }
    },
    select: {
      id: true,
      relevanceDecision: true,
      savedContentId: true
    }
  })

  const saved = allDeepLinks.filter(d => 
    d.relevanceDecision === 'saved' && d.savedContentId !== null
  ).length

  const unsaved = allDeepLinks.length - saved
  const saveRate = allDeepLinks.length > 0 ? (saved / allDeepLinks.length) * 100 : 0

  return {
    totalDeepLinks: allDeepLinks.length,
    saved,
    unsaved,
    saveRate
  }
}

async function main() {
  console.log(`\n🔍 Backfill Audit Report\n`)
  console.log(`Patch: ${PATCH_HANDLE}\n`)

  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${PATCH_HANDLE}" not found`)
    process.exit(1)
  }

  const results: AuditResults = {
    citations: await auditCitations(patch.id),
    heroes: await auditHeroes(patch.id),
    memories: await auditMemories(patch.id),
    deepLinks: await auditDeepLinks(patch.id)
  }

  // Print detailed report
  console.log(`\n${'='.repeat(70)}`)
  console.log(`📊 BACKFILL AUDIT REPORT`)
  console.log(`${'='.repeat(70)}\n`)

  // Citations
  console.log(`📚 CITATIONS (Score >= 50)`)
  console.log(`   Total with high score: ${results.citations.totalWithHighScore}`)
  console.log(`   ✅ Saved: ${results.citations.totalSaved}`)
  console.log(`   ❌ Still unsaved: ${results.citations.stillUnsaved}`)
  console.log(`   📈 Save rate: ${results.citations.saveRate.toFixed(1)}%`)
  console.log(`\n   Score breakdown:`)
  Object.entries(results.citations.scoreBreakdown).forEach(([range, stats]) => {
    if (stats.total > 0) {
      const rangeSaveRate = stats.total > 0 ? (stats.saved / stats.total) * 100 : 0
      console.log(`     ${range}: ${stats.saved}/${stats.total} saved (${rangeSaveRate.toFixed(1)}%)`)
    }
  })

  // Heroes
  console.log(`\n🎨 HERO IMAGES`)
  console.log(`   Total content: ${results.heroes.totalContent}`)
  console.log(`   ✅ With heroes: ${results.heroes.withHeroes}`)
  console.log(`   ❌ Without heroes: ${results.heroes.withoutHeroes}`)
  console.log(`   📈 Coverage: ${results.heroes.coverage.toFixed(1)}%`)

  // Memories
  console.log(`\n🤖 AGENT MEMORIES`)
  console.log(`   Total saved content: ${results.memories.totalSavedContent}`)
  console.log(`   ✅ With memories: ${results.memories.withMemories}`)
  console.log(`   ⏳ In queue: ${results.memories.inQueue}`)
  console.log(`   ❌ Missing: ${results.memories.missing}`)
  console.log(`   📈 Coverage: ${results.memories.coverage.toFixed(1)}%`)

  // Deep Links
  console.log(`\n🔗 DEEP LINKS`)
  console.log(`   Total deep links: ${results.deepLinks.totalDeepLinks}`)
  console.log(`   ✅ Saved: ${results.deepLinks.saved}`)
  console.log(`   ❌ Unsaved: ${results.deepLinks.unsaved}`)
  console.log(`   📈 Save rate: ${results.deepLinks.saveRate.toFixed(1)}%`)

  // Summary
  console.log(`\n${'='.repeat(70)}`)
  console.log(`📈 OVERALL SUMMARY`)
  console.log(`${'='.repeat(70)}`)

  const issues: string[] = []

  if (results.citations.stillUnsaved > 0) {
    issues.push(`${results.citations.stillUnsaved} citations with score >= 50 still unsaved`)
  }

  if (results.heroes.withoutHeroes > 0) {
    issues.push(`${results.heroes.withoutHeroes} content items missing hero images`)
  }

  if (results.memories.missing > 0) {
    issues.push(`${results.memories.missing} content items missing agent memories (not in queue)`)
  }

  if (results.deepLinks.unsaved > 0) {
    issues.push(`${results.deepLinks.unsaved} deep links still unsaved`)
  }

  if (issues.length === 0) {
    console.log(`\n✅ All backfills verified successfully! No remaining issues.`)
  } else {
    console.log(`\n⚠️  Remaining issues:`)
    issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`)
    })
  }

  console.log(`\n${'='.repeat(70)}\n`)

  // Recommendations
  if (issues.length > 0) {
    console.log(`💡 RECOMMENDATIONS:`)
    
    if (results.citations.stillUnsaved > 0) {
      console.log(`   • Run backfill script again: npx tsx scripts/comprehensive-backfill.ts ${PATCH_HANDLE} --types=citations`)
    }

    if (results.heroes.withoutHeroes > 0) {
      console.log(`   • Run hero backfill: npx tsx scripts/comprehensive-backfill.ts ${PATCH_HANDLE} --types=heroes`)
    }

    if (results.memories.missing > 0) {
      console.log(`   • Run memory backfill: npx tsx scripts/comprehensive-backfill.ts ${PATCH_HANDLE} --types=memories`)
      console.log(`   • Or check agent feed processor is running`)
    }

    if (results.deepLinks.unsaved > 0) {
      console.log(`   • Run deep link backfill: npx tsx scripts/comprehensive-backfill.ts ${PATCH_HANDLE} --types=deeplinks`)
    }
  }

  console.log('')
}

main().catch(error => {
  console.error('\n❌ Audit failed:', error)
  process.exit(1)
})

