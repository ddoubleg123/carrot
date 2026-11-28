/**
 * Full Audit of Citation Saving Process
 * 
 * Investigates why only 7.5% of citations are being saved
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const PATCH_HANDLE = 'israel'

interface SavingAudit {
  // Score distribution
  scoreDistribution: {
    range: string
    count: number
    saved: number
    denied: number
    saveRate: number
  }[]
  
  // High score analysis
  highScoreUnsaved: {
    count: number
    examples: Array<{
      id: string
      url: string
      score: number
      decision: string | null
      scanStatus: string
    }>
  }
  
  // Threshold analysis
  thresholdAnalysis: {
    threshold50: {
      total: number
      saved: number
      denied: number
      saveRate: number
    }
    threshold60: {
      total: number
      saved: number
      denied: number
      saveRate: number
    }
    threshold70: {
      total: number
      saved: number
      denied: number
      saveRate: number
    }
  }
  
  // Decision breakdown
  decisions: {
    saved: number
    denied: number
    noDecision: number
  }
  
  // Score analysis
  scores: {
    withScore: number
    withoutScore: number
    avgScore: number | null
    medianScore: number | null
    minScore: number | null
    maxScore: number | null
  }
  
  // Saved content matching
  savedContent: {
    total: number
    matchedToCitations: number
    unmatched: number
  }
}

async function auditSaving() {
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, title: true }
  })

  if (!patch) {
    throw new Error(`Patch "${PATCH_HANDLE}" not found`)
  }

  // Get all citations
  const allCitationsRaw = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: {
        patchId: patch.id
      }
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      aiPriorityScore: true,
      relevanceDecision: true,
      scanStatus: true,
      savedContentId: true,
      lastScannedAt: true
    }
  })
  
  // Filter out null URLs
  const citations = allCitationsRaw.filter(c => c.citationUrl !== null)
  const scanned = citations.filter(c => c.scanStatus === 'scanned')

  // Score distribution
  const scoreRanges = [
    { label: '90-100', min: 90, max: 100 },
    { label: '80-89', min: 80, max: 89 },
    { label: '70-79', min: 70, max: 79 },
    { label: '60-69', min: 60, max: 69 },
    { label: '50-59', min: 50, max: 59 },
    { label: '40-49', min: 40, max: 49 },
    { label: '30-39', min: 30, max: 39 },
    { label: '20-29', min: 20, max: 29 },
    { label: '10-19', min: 10, max: 19 },
    { label: '0-9', min: 0, max: 9 },
    { label: 'No Score', min: null, max: null }
  ]

  const scoreDistribution = scoreRanges.map(range => {
    const inRange = citations.filter(c => {
      if (range.min === null) return c.aiPriorityScore === null
      return c.aiPriorityScore !== null && c.aiPriorityScore >= range.min && c.aiPriorityScore <= range.max
    })
    const saved = inRange.filter(c => c.relevanceDecision === 'saved').length
    const denied = inRange.filter(c => c.relevanceDecision === 'denied').length
    return {
      range: range.label,
      count: inRange.length,
      saved,
      denied,
      saveRate: inRange.length > 0 ? (saved / inRange.length) * 100 : 0
    }
  })

  // High score unsaved analysis
  const highScoreUnsaved = citations.filter(c => {
    return c.aiPriorityScore !== null && 
           c.aiPriorityScore >= 50 && 
           c.relevanceDecision !== 'saved' &&
           c.scanStatus === 'scanned'
  }).slice(0, 20).map(c => ({
    id: c.id,
    url: c.citationUrl || '',
    score: c.aiPriorityScore!,
    decision: c.relevanceDecision,
    scanStatus: c.scanStatus
  }))

  // Threshold analysis
  const threshold50 = scanned.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore >= 50)
  const threshold60 = scanned.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore >= 60)
  const threshold70 = scanned.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore >= 70)

  const thresholdAnalysis = {
    threshold50: {
      total: threshold50.length,
      saved: threshold50.filter(c => c.relevanceDecision === 'saved').length,
      denied: threshold50.filter(c => c.relevanceDecision === 'denied').length,
      saveRate: threshold50.length > 0 
        ? (threshold50.filter(c => c.relevanceDecision === 'saved').length / threshold50.length) * 100 
        : 0
    },
    threshold60: {
      total: threshold60.length,
      saved: threshold60.filter(c => c.relevanceDecision === 'saved').length,
      denied: threshold60.filter(c => c.relevanceDecision === 'denied').length,
      saveRate: threshold60.length > 0 
        ? (threshold60.filter(c => c.relevanceDecision === 'saved').length / threshold60.length) * 100 
        : 0
    },
    threshold70: {
      total: threshold70.length,
      saved: threshold70.filter(c => c.relevanceDecision === 'saved').length,
      denied: threshold70.filter(c => c.relevanceDecision === 'denied').length,
      saveRate: threshold70.length > 0 
        ? (threshold70.filter(c => c.relevanceDecision === 'saved').length / threshold70.length) * 100 
        : 0
    }
  }

  // Decisions
  const decisions = {
    saved: citations.filter(c => c.relevanceDecision === 'saved').length,
    denied: citations.filter(c => c.relevanceDecision === 'denied').length,
    noDecision: citations.filter(c => c.relevanceDecision === null && c.scanStatus === 'scanned').length
  }

  // Score statistics
  const scores = citations.filter(c => c.aiPriorityScore !== null).map(c => c.aiPriorityScore!)
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const sortedScores = [...scores].sort((a, b) => a - b)
  const medianScore = sortedScores.length > 0 
    ? sortedScores[Math.floor(sortedScores.length / 2)] 
    : null
  const minScore = scores.length > 0 ? Math.min(...scores) : null
  const maxScore = scores.length > 0 ? Math.max(...scores) : null

  // Saved content matching
  const savedContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      category: 'wikipedia_citation'
    },
    select: {
      id: true,
      canonicalUrl: true
    }
  })

  const savedUrls = new Set(savedContent.map(s => s.canonicalUrl?.toLowerCase()).filter(Boolean))
  const matchedCitations = citations.filter(c => {
    if (!c.citationUrl) return false
    return savedUrls.has(c.citationUrl.toLowerCase())
  })

  return {
    scoreDistribution,
    highScoreUnsaved: {
      count: citations.filter(c => 
        c.aiPriorityScore !== null && 
        c.aiPriorityScore >= 50 && 
        c.relevanceDecision !== 'saved' &&
        c.scanStatus === 'scanned'
      ).length,
      examples: highScoreUnsaved
    },
    thresholdAnalysis,
    decisions,
    scores: {
      withScore: citations.filter(c => c.aiPriorityScore !== null).length,
      withoutScore: citations.filter(c => c.aiPriorityScore === null).length,
      avgScore,
      medianScore,
      minScore,
      maxScore
    },
    savedContent: {
      total: savedContent.length,
      matchedToCitations: matchedCitations.length,
      unmatched: savedContent.length - matchedCitations.length
    }
  }
}

async function main() {
  console.log('\n🔍 FULL SAVING PROCESS AUDIT\n')
  console.log(`Patch: ${PATCH_HANDLE}\n`)

  const audit = await auditSaving()

  console.log('='.repeat(80))
  console.log('SCORE DISTRIBUTION & SAVE RATES\n')
  
  audit.scoreDistribution.forEach(dist => {
    if (dist.count > 0) {
      console.log(`${dist.range.padEnd(12)} | Total: ${dist.count.toString().padStart(5)} | Saved: ${dist.saved.toString().padStart(4)} | Denied: ${dist.denied.toString().padStart(4)} | Rate: ${dist.saveRate.toFixed(1)}%`)
    }
  })

  console.log('\n' + '='.repeat(80))
  console.log('THRESHOLD ANALYSIS\n')
  
  console.log(`Threshold >= 50:`)
  console.log(`  Total: ${audit.thresholdAnalysis.threshold50.total}`)
  console.log(`  Saved: ${audit.thresholdAnalysis.threshold50.saved} (${audit.thresholdAnalysis.threshold50.saveRate.toFixed(1)}%)`)
  console.log(`  Denied: ${audit.thresholdAnalysis.threshold50.denied}`)
  
  console.log(`\nThreshold >= 60:`)
  console.log(`  Total: ${audit.thresholdAnalysis.threshold60.total}`)
  console.log(`  Saved: ${audit.thresholdAnalysis.threshold60.saved} (${audit.thresholdAnalysis.threshold60.saveRate.toFixed(1)}%)`)
  console.log(`  Denied: ${audit.thresholdAnalysis.threshold60.denied}`)
  
  console.log(`\nThreshold >= 70:`)
  console.log(`  Total: ${audit.thresholdAnalysis.threshold70.total}`)
  console.log(`  Saved: ${audit.thresholdAnalysis.threshold70.saved} (${audit.thresholdAnalysis.threshold70.saveRate.toFixed(1)}%)`)
  console.log(`  Denied: ${audit.thresholdAnalysis.threshold70.denied}`)

  console.log('\n' + '='.repeat(80))
  console.log('HIGH SCORE UNSAVED CITATIONS\n')
  
  console.log(`Found ${audit.highScoreUnsaved.count} citations with score >= 50 that were NOT saved:\n`)
  
  if (audit.highScoreUnsaved.examples.length > 0) {
    console.log('Examples (first 20):')
    audit.highScoreUnsaved.examples.forEach((c, i) => {
      console.log(`  ${i + 1}. Score: ${c.score.toFixed(1)}, Decision: ${c.decision || 'null'}, Status: ${c.scanStatus}`)
      console.log(`     URL: ${c.url.substring(0, 80)}...`)
    })
  } else {
    console.log('✅ No high-score unsaved citations found')
  }

  console.log('\n' + '='.repeat(80))
  console.log('SCORE STATISTICS\n')
  
  console.log(`With Score: ${audit.scores.withScore}`)
  console.log(`Without Score: ${audit.scores.withoutScore}`)
  if (audit.scores.avgScore !== null) {
    console.log(`Average Score: ${audit.scores.avgScore.toFixed(2)}`)
  }
  if (audit.scores.medianScore !== null) {
    console.log(`Median Score: ${audit.scores.medianScore.toFixed(2)}`)
  }
  if (audit.scores.minScore !== null) {
    console.log(`Min Score: ${audit.scores.minScore.toFixed(2)}`)
  }
  if (audit.scores.maxScore !== null) {
    console.log(`Max Score: ${audit.scores.maxScore.toFixed(2)}`)
  }

  console.log('\n' + '='.repeat(80))
  console.log('DECISION BREAKDOWN\n')
  
  console.log(`Saved: ${audit.decisions.saved}`)
  console.log(`Denied: ${audit.decisions.denied}`)
  console.log(`No Decision: ${audit.decisions.noDecision}`)
  
  const totalScanned = audit.decisions.saved + audit.decisions.denied + audit.decisions.noDecision
  console.log(`Total Scanned: ${totalScanned}`)
  console.log(`Save Rate: ${totalScanned > 0 ? ((audit.decisions.saved / totalScanned) * 100).toFixed(1) : 0}%`)

  console.log('\n' + '='.repeat(80))
  console.log('SAVED CONTENT ANALYSIS\n')
  
  console.log(`Total Saved Content: ${audit.savedContent.total}`)
  console.log(`Matched to Citations: ${audit.savedContent.matchedToCitations}`)
  console.log(`Unmatched: ${audit.savedContent.unmatched}`)

  console.log('\n' + '='.repeat(80))
  console.log('ANALYSIS SUMMARY\n')
  
  // Key findings
  const highScoreDenied = audit.thresholdAnalysis.threshold70.denied
  const midScoreDenied = audit.thresholdAnalysis.threshold50.denied - audit.thresholdAnalysis.threshold70.denied
  
  console.log('🔍 Key Findings:')
  console.log(`\n1. Save Rate by Threshold:`)
  console.log(`   - Score >= 70: ${audit.thresholdAnalysis.threshold70.saveRate.toFixed(1)}% saved`)
  console.log(`   - Score >= 60: ${audit.thresholdAnalysis.threshold60.saveRate.toFixed(1)}% saved`)
  console.log(`   - Score >= 50: ${audit.thresholdAnalysis.threshold50.saveRate.toFixed(1)}% saved`)
  
  console.log(`\n2. High Score Citations (>= 50) NOT Saved:`)
  console.log(`   - Total: ${audit.highScoreUnsaved.count}`)
  console.log(`   - Score >= 70 denied: ${highScoreDenied}`)
  console.log(`   - Score 50-69 denied: ${midScoreDenied}`)
  
  if (audit.highScoreUnsaved.count > 0) {
    console.log(`\n⚠️  ISSUE: ${audit.highScoreUnsaved.count} citations with score >= 50 were NOT saved`)
    console.log(`   This suggests the save logic may not be working correctly, or`)
    console.log(`   there are additional criteria beyond just the score threshold.`)
  }
  
  console.log(`\n3. Score Distribution:`)
  const lowScoreCount = audit.scoreDistribution.filter(d => 
    d.range === '0-9' || d.range === '10-19' || d.range === '20-29' || d.range === '30-39' || d.range === '40-49'
  ).reduce((sum, d) => sum + d.count, 0)
  const highScoreCount = audit.scoreDistribution.filter(d => 
    d.range === '50-59' || d.range === '60-69' || d.range === '70-79' || d.range === '80-89' || d.range === '90-100'
  ).reduce((sum, d) => sum + d.count, 0)
  
  console.log(`   - Low scores (< 50): ${lowScoreCount}`)
  console.log(`   - High scores (>= 50): ${highScoreCount}`)
  console.log(`   - This explains why save rate is low if most citations have low scores`)

  console.log('\n' + '='.repeat(80))
  console.log('\n✅ Audit Complete\n')
}

main().catch((error) => {
  console.error('❌ Error:', error)
  process.exit(1)
})

