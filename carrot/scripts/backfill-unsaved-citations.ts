/**
 * Backfill Script: Save Citations That Should Have Been Saved
 * 
 * Finds citations with score >= 50 that were denied or not saved,
 * and re-processes them with the fixed save logic.
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { enqueueDiscoveredContent } from '../src/lib/agent/feedWorker'

const PATCH_HANDLE = process.argv[2] || 'israel'
const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = parseInt(process.argv.find(arg => arg.startsWith('--batch='))?.split('=')[1] || '10')
const LIMIT = process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] ? parseInt(process.argv.find(arg => arg.startsWith('--limit='))!.split('=')[1]) : undefined

interface CitationToProcess {
  id: string
  citationUrl: string
  citationTitle: string | null
  aiPriorityScore: number | null
  relevanceDecision: string | null
  savedContentId: string | null
  monitoringId: string
}

async function getUnsavedCitations(patchId: string): Promise<CitationToProcess[]> {
  console.log('🔍 Finding citations that should have been saved...')
  
  // Find citations with score >= 50 that weren't saved
  const citations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId },
      aiPriorityScore: { gte: 50 },
      OR: [
        { relevanceDecision: { not: 'saved' } },
        { savedContentId: null },
        { relevanceDecision: null }
      ]
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      aiPriorityScore: true,
      relevanceDecision: true,
      savedContentId: true,
      monitoring: {
        select: { id: true }
      }
    },
    orderBy: {
      aiPriorityScore: 'desc' // Process high scores first
    },
    take: LIMIT
  })

  console.log(`   Found ${citations.length} citations with score >= 50 that weren't saved`)

  return citations.map(c => ({
    id: c.id,
    citationUrl: c.citationUrl!,
    citationTitle: c.citationTitle,
    aiPriorityScore: c.aiPriorityScore,
    relevanceDecision: c.relevanceDecision,
    savedContentId: c.savedContentId,
    monitoringId: c.monitoring.id
  }))
}

async function reprocessCitation(
  citation: CitationToProcess,
  patchId: string,
  patchHandle: string,
  patchTitle: string
): Promise<{ saved: boolean; error?: string }> {
  try {
    const { canonicalize } = await import('../src/lib/discovery/canonicalization')
    
    // Canonicalize URL
    const canonicalResult = await canonicalize(citation.citationUrl)
    const canonicalUrl = canonicalResult.canonicalUrl

    // Check for duplicates
    const existing = await prisma.discoveredContent.findUnique({
      where: {
        patchId_canonicalUrl: {
          patchId,
          canonicalUrl
        }
      },
      select: { id: true }
    })

    if (existing) {
      // Link citation to existing content
      await prisma.wikipediaCitation.update({
        where: { id: citation.id },
        data: {
          savedContentId: existing.id,
          relevanceDecision: 'saved',
          scanStatus: 'scanned'
        }
      })
      return { saved: true }
    }

    // Extract content from citation URL
    let meaningfulContent = ''
    let extractedTitle = citation.citationTitle || citation.citationUrl

    // Try to fetch and extract content
    try {
      const { ContentExtractor } = await import('../src/lib/ai-agents/contentExtractor')
      const extractionResult = await ContentExtractor.extractFromUrl(citation.citationUrl)

      if (extractionResult.content && extractionResult.content.length > 0) {
        meaningfulContent = extractionResult.content
        if (extractionResult.title) {
          extractedTitle = extractionResult.title
        }
      } else {
        // Fallback: use citation title as content
        meaningfulContent = citation.citationTitle || citation.citationUrl
      }
    } catch (extractionError) {
      console.warn(`   ⚠️  Failed to extract content: ${extractionError instanceof Error ? extractionError.message : String(extractionError)}`)
      meaningfulContent = citation.citationTitle || citation.citationUrl
    }

    // Ensure we have some content
    if (!meaningfulContent || meaningfulContent.trim().length === 0) {
      meaningfulContent = citation.citationTitle || citation.citationUrl || 'Untitled'
    }

    // Calculate scores
    const aiScore = citation.aiPriorityScore || 50
    const relevanceEngineScore = 0.5 // Default
    const finalRelevanceScore = (aiScore / 100) * 0.6 + relevanceEngineScore * 0.4

    // Clean text content
    const cleanedText = meaningfulContent.trim().replace(/\s+/g, ' ')

    // Calculate content hash
    const { createHash } = await import('crypto')
    const contentHash = createHash('sha256')
      .update(canonicalUrl + cleanedText)
      .digest('hex')

    // Get domain
    const domain = canonicalResult.finalDomain || canonicalResult.canonicalHost || null

    // Save to DiscoveredContent
    const savedItem = await prisma.discoveredContent.create({
      data: {
        patchId,
        canonicalUrl,
        title: extractedTitle || 'Untitled',
        sourceUrl: citation.citationUrl,
        domain,
        sourceDomain: domain,
        type: 'article',
        category: 'wikipedia_citation',
        publishDate: null,
        relevanceScore: finalRelevanceScore,
        qualityScore: 0.6,
        importanceScore: aiScore / 100,
        whyItMatters: `Source cited on Wikipedia page related to ${patchTitle}`,
        summary: cleanedText.substring(0, 500),
        facts: [] as any,
        quotes: [] as any,
        provenance: [citation.citationUrl] as any,
        hero: null,
        contentHash,
        textContent: cleanedText,
        content: cleanedText,
        lastCrawledAt: new Date(),
        isUseful: true, // Always useful if score >= 50
        metadata: {
          source: 'wikipedia_citation',
          processedAt: new Date().toISOString(),
          aiPriorityScore: aiScore,
          relevanceEngineScore: relevanceEngineScore,
          backfilled: true
        } as any
      } as any
    })

    // Update citation
    await prisma.wikipediaCitation.update({
      where: { id: citation.id },
      data: {
        savedContentId: savedItem.id,
        relevanceDecision: 'saved',
        scanStatus: 'scanned'
      }
    })

    // Enqueue for agent feeding
    try {
      await enqueueDiscoveredContent(savedItem.id, patchId, contentHash, 0)
    } catch (error) {
      console.warn(`   ⚠️  Failed to enqueue for agent:`, error)
    }

    return { saved: true }
  } catch (error) {
    return {
      saved: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function main() {
  console.log(`\n🔄 Backfill: Saving Citations That Should Have Been Saved\n`)
  console.log(`Patch: ${PATCH_HANDLE}`)
  console.log(`Dry Run: ${DRY_RUN ? 'YES (no changes will be made)' : 'NO (will save citations)'}`)
  console.log(`Batch Size: ${BATCH_SIZE}`)
  if (LIMIT) console.log(`Limit: ${LIMIT}`)
  console.log('')

  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${PATCH_HANDLE}" not found`)
    process.exit(1)
  }

  const citations = await getUnsavedCitations(patch.id)

  if (citations.length === 0) {
    console.log('✅ No citations need backfilling - all citations with score >= 50 are already saved!')
    process.exit(0)
  }

  console.log(`\n📊 Found ${citations.length} citations to backfill`)
  console.log(`   Score distribution:`)
  const byScore = {
    '90-100': citations.filter(c => (c.aiPriorityScore || 0) >= 90).length,
    '80-89': citations.filter(c => (c.aiPriorityScore || 0) >= 80 && (c.aiPriorityScore || 0) < 90).length,
    '70-79': citations.filter(c => (c.aiPriorityScore || 0) >= 70 && (c.aiPriorityScore || 0) < 80).length,
    '60-69': citations.filter(c => (c.aiPriorityScore || 0) >= 60 && (c.aiPriorityScore || 0) < 70).length,
    '50-59': citations.filter(c => (c.aiPriorityScore || 0) >= 50 && (c.aiPriorityScore || 0) < 60).length,
  }
  Object.entries(byScore).forEach(([range, count]) => {
    if (count > 0) console.log(`     ${range}: ${count}`)
  })

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN - No changes will be made')
    console.log(`   Would process ${citations.length} citations`)
    process.exit(0)
  }

  console.log(`\n🚀 Processing citations in batches of ${BATCH_SIZE}...\n`)

  let processed = 0
  let saved = 0
  let failed = 0

  for (let i = 0; i < citations.length; i += BATCH_SIZE) {
    const batch = citations.slice(i, i + BATCH_SIZE)
    console.log(`\n📦 Batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} citations)`)

    for (const citation of batch) {
      processed++
      const score = citation.aiPriorityScore || 0
      const title = citation.citationTitle || citation.citationUrl.substring(0, 50)
      
      console.log(`\n[${processed}/${citations.length}] Processing: ${title}`)
      console.log(`   Score: ${score.toFixed(1)}, URL: ${citation.citationUrl.substring(0, 80)}...`)

      const result = await reprocessCitation(citation, patch.id, PATCH_HANDLE, patch.title)

      if (result.saved) {
        saved++
        console.log(`   ✅ Saved successfully`)
      } else {
        failed++
        console.log(`   ❌ Failed: ${result.error || 'Unknown error'}`)
      }

      // Small delay between citations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Longer delay between batches
    if (i + BATCH_SIZE < citations.length) {
      console.log(`\n⏸️  Pausing 2 seconds before next batch...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 BACKFILL SUMMARY`)
  console.log(`${'='.repeat(60)}`)
  console.log(`Total processed: ${processed}`)
  console.log(`✅ Saved: ${saved}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`Success rate: ${((saved / processed) * 100).toFixed(1)}%`)
  console.log(`${'='.repeat(60)}\n`)

  if (failed > 0) {
    console.log(`⚠️  ${failed} citations failed to save. Check logs for details.`)
    process.exit(1)
  } else {
    console.log(`✅ All citations processed successfully!`)
    process.exit(0)
  }
}

main().catch(error => {
  console.error('\n❌ Backfill script failed:', error)
  process.exit(1)
})
