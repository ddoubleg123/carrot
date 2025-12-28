/**
 * Audit Discovery Completion Status
 * 
 * Tracks:
 * 1. Citation processing status (scanned, saved, denied)
 * 2. Relevance scores and decisions
 * 3. Saved content extraction status
 * 4. Completion percentage
 * 5. What's remaining to process
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const PATCH_HANDLE = 'israel'

interface CompletionAudit {
  patchId: string
  patchTitle: string
  
  // Citation Statistics
  citations: {
    total: number
    notScanned: number
    scanning: number
    scanned: number
    
    // Relevance Decisions
    saved: number
    denied: number
    noDecision: number
    
    // Score Distribution
    withScore: number
    avgScore: number
    highScore: number // >= 70
    mediumScore: number // 50-69
    lowScore: number // < 50
    
    // Saved Status
    savedToContent: number // savedContentId is not null
    savedToMemory: number // savedMemoryId is not null
  }
  
  // Saved Content Status
  savedContent: {
    total: number
    withTextContent: number // Has textContent
    withoutTextContent: number // Missing textContent
    avgTextLength: number
    citations: number // From Wikipedia citations
    annasArchive: number
    newsAPI: number
    wikipedia: number
    other: number
  }
  
  // Extraction Status
  extraction: {
    relevantCitations: number // Citations marked as saved
    extractedCitations: number // Citations saved AND have textContent
    extractionRate: number // Percentage of relevant citations extracted
    missingExtraction: number // Saved but not extracted
  }
  
  // Completion Status
  completion: {
    citationsProcessed: number // Percentage of citations scanned
    relevantSaved: number // Percentage of relevant citations saved
    relevantExtracted: number // Percentage of relevant citations extracted
    overallCompletion: number // Weighted completion score
    isComplete: boolean // All relevant items saved and extracted
  }
  
  // Remaining Work
  remaining: {
    citationsToScan: number
    relevantToSave: number
    savedToExtract: number
  }
}

async function auditCompletion(patchId: string): Promise<CompletionAudit> {
  const patch = await prisma.patch.findUnique({
    where: { id: patchId },
    select: { id: true, title: true }
  })
  
  if (!patch) {
    throw new Error(`Patch not found: ${patchId}`)
  }
  
  // Get all citations for this patch
  const allCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: {
        patchId: patchId
      }
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      scanStatus: true,
      relevanceDecision: true,
      aiPriorityScore: true,
      savedContentId: true,
      savedMemoryId: true,
      contentText: true
    }
  })
  
  // Citation statistics
  const citationsNotScanned = allCitations.filter(c => c.scanStatus === 'not_scanned')
  const citationsScanning = allCitations.filter(c => c.scanStatus === 'scanning')
  const citationsScanned = allCitations.filter(c => c.scanStatus === 'scanned')
  const citationsSaved = allCitations.filter(c => c.relevanceDecision === 'saved')
  const citationsDenied = allCitations.filter(c => c.relevanceDecision === 'denied')
  const citationsNoDecision = allCitations.filter(c => c.relevanceDecision === null)
  
  const citationsWithScore = allCitations.filter(c => c.aiPriorityScore !== null)
  const scores = citationsWithScore.map(c => c.aiPriorityScore!).filter(s => s !== null)
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  const highScore = citationsWithScore.filter(c => (c.aiPriorityScore || 0) >= 70).length
  const mediumScore = citationsWithScore.filter(c => (c.aiPriorityScore || 0) >= 50 && (c.aiPriorityScore || 0) < 70).length
  const lowScore = citationsWithScore.filter(c => (c.aiPriorityScore || 0) < 50).length
  
  const citationsSavedToContent = allCitations.filter(c => c.savedContentId !== null)
  const citationsSavedToMemory = allCitations.filter(c => c.savedMemoryId !== null)
  
  // Get saved content for this patch
  const savedContent = await prisma.discoveredContent.findMany({
    where: {
      patchId: patchId
    },
    select: {
      id: true,
      title: true,
      textContent: true,
      category: true,
      type: true,
      sourceDomain: true,
      metadata: true,
      createdAt: true
    }
  })
  
  const contentWithText = savedContent.filter(c => c.textContent && c.textContent.length > 0)
  const contentWithoutText = savedContent.filter(c => !c.textContent || c.textContent.length === 0)
  const totalTextLength = contentWithText.reduce((sum, c) => sum + (c.textContent?.length || 0), 0)
  const avgTextLength = contentWithText.length > 0 ? totalTextLength / contentWithText.length : 0
  
  // Categorize saved content
  const contentFromCitations = savedContent.filter(c => c.category === 'wikipedia_citation')
  const contentAnnasArchive = savedContent.filter(c => 
    c.sourceDomain?.includes('annas-archive.org') || c.type === 'book'
  )
  const contentNewsAPI = savedContent.filter(c => 
    (c.metadata as any)?.source === 'NewsAPI' || (c.metadata as any)?.provider === 'newsapi'
  )
  const contentWikipedia = savedContent.filter(c => 
    (c.sourceDomain?.includes('wikipedia.org') || c.category === 'wikipedia') &&
    c.category !== 'wikipedia_citation'
  )
  const contentOther = savedContent.filter(c => 
    !contentFromCitations.includes(c) &&
    !contentAnnasArchive.includes(c) &&
    !contentNewsAPI.includes(c) &&
    !contentWikipedia.includes(c)
  )
  
  // Check which saved citations have extracted content
  const savedContentIds = new Set(citationsSavedToContent.map(c => c.savedContentId).filter((id): id is string => id !== null))
  const extractedContent = savedContent.filter(c => savedContentIds.has(c.id) && c.textContent && c.textContent.length > 0)
  
  // Calculate completion
  const citationsProcessed = allCitations.length > 0 
    ? (citationsScanned.length / allCitations.length) * 100 
    : 100
  
  // Relevant citations = those with high scores OR marked as saved
  const relevantCitations = allCitations.filter(c => 
    c.relevanceDecision === 'saved' || 
    (c.aiPriorityScore !== null && c.aiPriorityScore >= 50)
  )
  const relevantSaved = relevantCitations.length > 0
    ? (citationsSaved.length / relevantCitations.length) * 100
    : 100
  
  const relevantExtracted = citationsSaved.length > 0
    ? (extractedContent.length / citationsSaved.length) * 100
    : 100
  
  // Overall completion (weighted)
  const overallCompletion = (
    citationsProcessed * 0.3 + // 30% weight on processing citations
    relevantSaved * 0.4 + // 40% weight on saving relevant items
    relevantExtracted * 0.3 // 30% weight on extracting saved items
  )
  
  const isComplete = 
    citationsScanned.length === allCitations.length && // All citations scanned
    citationsSaved.length === relevantCitations.length && // All relevant saved
    extractedContent.length === citationsSaved.length // All saved extracted
  
  // Remaining work
  const citationsToScan = citationsNotScanned.length + citationsScanning.length
  const relevantToSave = relevantCitations.filter(c => c.relevanceDecision !== 'saved').length
  const savedToExtract = citationsSavedToContent.filter(c => {
    const content = savedContent.find(sc => sc.id === c.savedContentId)
    return !content || !content.textContent || content.textContent.length === 0
  }).length
  
  return {
    patchId: patch.id,
    patchTitle: patch.title,
    citations: {
      total: allCitations.length,
      notScanned: citationsNotScanned.length,
      scanning: citationsScanning.length,
      scanned: citationsScanned.length,
      saved: citationsSaved.length,
      denied: citationsDenied.length,
      noDecision: citationsNoDecision.length,
      withScore: citationsWithScore.length,
      avgScore: Math.round(avgScore * 100) / 100,
      highScore,
      mediumScore,
      lowScore,
      savedToContent: citationsSavedToContent.length,
      savedToMemory: citationsSavedToMemory.length
    },
    savedContent: {
      total: savedContent.length,
      withTextContent: contentWithText.length,
      withoutTextContent: contentWithoutText.length,
      avgTextLength: Math.round(avgTextLength),
      citations: contentFromCitations.length,
      annasArchive: contentAnnasArchive.length,
      newsAPI: contentNewsAPI.length,
      wikipedia: contentWikipedia.length,
      other: contentOther.length
    },
    extraction: {
      relevantCitations: relevantCitations.length,
      extractedCitations: extractedContent.length,
      extractionRate: citationsSaved.length > 0
        ? (extractedContent.length / citationsSaved.length) * 100
        : 0,
      missingExtraction: savedToExtract
    },
    completion: {
      citationsProcessed: Math.round(citationsProcessed * 100) / 100,
      relevantSaved: Math.round(relevantSaved * 100) / 100,
      relevantExtracted: Math.round(relevantExtracted * 100) / 100,
      overallCompletion: Math.round(overallCompletion * 100) / 100,
      isComplete
    },
    remaining: {
      citationsToScan,
      relevantToSave,
      savedToExtract
    }
  }
}

function printAudit(audit: CompletionAudit) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`📊 DISCOVERY COMPLETION AUDIT`)
  console.log(`${'='.repeat(80)}\n`)
  
  console.log(`🔍 Patch: ${audit.patchTitle} (${audit.patchId})\n`)
  
  console.log(`📚 CITATIONS (${audit.citations.total} total):`)
  console.log(`   Status:`)
  console.log(`      Not Scanned: ${audit.citations.notScanned}`)
  console.log(`      Scanning: ${audit.citations.scanning}`)
  console.log(`      Scanned: ${audit.citations.scanned} (${audit.completion.citationsProcessed.toFixed(1)}%)`)
  console.log(`   Decisions:`)
  console.log(`      Saved: ${audit.citations.saved}`)
  console.log(`      Denied: ${audit.citations.denied}`)
  console.log(`      No Decision: ${audit.citations.noDecision}`)
  console.log(`   Scores:`)
  console.log(`      With Score: ${audit.citations.withScore}`)
  console.log(`      Avg Score: ${audit.citations.avgScore}`)
  console.log(`      High (≥70): ${audit.citations.highScore}`)
  console.log(`      Medium (50-69): ${audit.citations.mediumScore}`)
  console.log(`      Low (<50): ${audit.citations.lowScore}`)
  console.log(`   Saved:`)
  console.log(`      To DiscoveredContent: ${audit.citations.savedToContent}`)
  console.log(`      To AgentMemory: ${audit.citations.savedToMemory}`)
  console.log()
  
  console.log(`💾 SAVED CONTENT (${audit.savedContent.total} total):`)
  console.log(`   With Text: ${audit.savedContent.withTextContent}`)
  console.log(`   Without Text: ${audit.savedContent.withoutTextContent}`)
  console.log(`   Avg Text Length: ${audit.savedContent.avgTextLength.toLocaleString()} chars`)
  console.log(`   By Source:`)
  console.log(`      Citations: ${audit.savedContent.citations}`)
  console.log(`      Anna's Archive: ${audit.savedContent.annasArchive}`)
  console.log(`      NewsAPI: ${audit.savedContent.newsAPI}`)
  console.log(`      Wikipedia Pages: ${audit.savedContent.wikipedia}`)
  console.log(`      Other: ${audit.savedContent.other}`)
  console.log()
  
  console.log(`📥 EXTRACTION STATUS:`)
  console.log(`   Relevant Citations: ${audit.extraction.relevantCitations}`)
  console.log(`   Extracted Citations: ${audit.extraction.extractedCitations}`)
  console.log(`   Extraction Rate: ${audit.extraction.extractionRate.toFixed(1)}%`)
  console.log(`   Missing Extraction: ${audit.extraction.missingExtraction}`)
  console.log()
  
  console.log(`✅ COMPLETION STATUS:`)
  console.log(`   Citations Processed: ${audit.completion.citationsProcessed.toFixed(1)}%`)
  console.log(`   Relevant Saved: ${audit.completion.relevantSaved.toFixed(1)}%`)
  console.log(`   Relevant Extracted: ${audit.completion.relevantExtracted.toFixed(1)}%`)
  console.log(`   Overall Completion: ${audit.completion.overallCompletion.toFixed(1)}%`)
  console.log(`   Is Complete: ${audit.completion.isComplete ? '✅ YES' : '❌ NO'}`)
  console.log()
  
  if (!audit.completion.isComplete) {
    console.log(`⏳ REMAINING WORK:`)
    console.log(`   Citations to Scan: ${audit.remaining.citationsToScan}`)
    console.log(`   Relevant to Save: ${audit.remaining.relevantToSave}`)
    console.log(`   Saved to Extract: ${audit.remaining.savedToExtract}`)
    console.log()
  }
  
  console.log(`${'='.repeat(80)}\n`)
}

async function main() {
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, title: true }
  })
  
  if (!patch) {
    console.error(`Patch "${PATCH_HANDLE}" not found`)
    process.exit(1)
  }
  
  console.log(`\n🔍 Auditing discovery completion for: ${patch.title}`)
  
  const audit = await auditCompletion(patch.id)
  printAudit(audit)
  
  // Save to file
  const fs = await import('fs/promises')
  const reportPath = `carrot/DISCOVERY_COMPLETION_AUDIT_${PATCH_HANDLE}_${new Date().toISOString().split('T')[0]}.json`
  await fs.writeFile(
    reportPath,
    JSON.stringify(audit, null, 2)
  )
  console.log(`💾 Full audit saved to: ${reportPath}\n`)
  
  await prisma.$disconnect()
}

main().catch(console.error)

