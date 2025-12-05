/**
 * Test script to verify that discovery is actually saving content
 * This simulates a real discovery run and checks if items are saved
 */

import { prisma } from '../src/lib/prisma'
import { processNextCitation } from '../src/lib/discovery/wikipediaProcessor'
import { getNextCitationToProcess } from '../src/lib/discovery/wikipediaCitation'

async function testDiscoverySave() {
  console.log('🧪 Testing Discovery Content Saving...\n')
  
  // Find a patch with Wikipedia citations
  const patch = await prisma.patch.findFirst({
    where: {
      handle: 'israel' // Use the Israel patch
    },
    select: {
      id: true,
      handle: true,
      title: true
    }
  })
  
  if (!patch) {
    console.error('❌ No patch found. Please create a patch first.')
    return
  }
  
  console.log(`📋 Testing with patch: ${patch.title} (${patch.handle})`)
  console.log(`   Patch ID: ${patch.id}\n`)
  
  // Check how many citations are available
  const citationCount = await prisma.wikipediaCitation.count({
    where: {
      monitoring: {
        patchId: patch.id
      },
      scanStatus: { not: 'scanned' },
      verificationStatus: { not: 'failed' }
    }
  })
  
  console.log(`📊 Available citations to process: ${citationCount}`)
  
  if (citationCount === 0) {
    console.log('⚠️  No citations available to process. All citations may already be processed.')
    return
  }
  
  // Get initial count of DiscoveredContent
  const initialContentCount = await prisma.discoveredContent.count({
    where: {
      patchId: patch.id
    }
  })
  
  console.log(`📦 Initial DiscoveredContent count: ${initialContentCount}\n`)
  
  // Process a few citations
  console.log('🔄 Processing citations...\n')
  
  let processed = 0
  let saved = 0
  const maxToProcess = 5 // Process up to 5 citations
  
  // Create saveAsContent function
  const saveAsContent = async (
    url: string,
    title: string,
    content: string,
    relevanceData?: { aiScore?: number; relevanceScore?: number; isRelevant?: boolean }
  ): Promise<string | null> => {
    try {
      const { canonicalizeUrlFast } = await import('../src/lib/discovery/canonicalize')
      const { getDomainFromUrl } = await import('../src/lib/discovery/canonicalize')
      const { createHash } = await import('crypto')
      
      const canonicalUrl = canonicalizeUrlFast(url) || url
      const domain = getDomainFromUrl(canonicalUrl) || null
      
      // Check for duplicate
      const existing = await prisma.discoveredContent.findUnique({
        where: {
          patchId_canonicalUrl: {
            patchId: patch.id,
            canonicalUrl
          }
        },
        select: { id: true }
      })
      
      if (existing) {
        console.log(`   ⏭️  Already exists: ${title}`)
        return existing.id
      }
      
      // Compute content hash
      const cleanedText = content.trim()
      const contentHash = createHash('sha256').update(cleanedText).digest('hex')
      
      // Calculate final relevance score
      const aiScore = relevanceData?.aiScore ?? 50
      const relevanceEngineScore = relevanceData?.relevanceScore ?? 0
      const finalRelevanceScore = (aiScore / 100) * 0.6 + relevanceEngineScore * 0.4
      
      // Create DiscoveredContent entry
      const savedItem = await prisma.discoveredContent.create({
        data: {
          patchId: patch.id,
          canonicalUrl,
          title,
          sourceUrl: url,
          domain,
          sourceDomain: domain,
          type: 'article',
          category: 'wikipedia_citation',
          relevanceScore: finalRelevanceScore,
          qualityScore: 0.6,
          importanceScore: aiScore / 100,
          whyItMatters: `Source cited on Wikipedia page related to ${patch.title}`,
          summary: cleanedText.substring(0, 500),
          facts: [] as any,
          quotes: [] as any,
          provenance: [url] as any,
          hero: null,
          contentHash,
          textContent: cleanedText,
          content: cleanedText,
          lastCrawledAt: new Date(),
          isUseful: relevanceData?.isRelevant ?? false,
          metadata: {
            source: 'wikipedia_citation',
            processedAt: new Date().toISOString(),
            aiPriorityScore: aiScore,
            relevanceEngineScore: relevanceEngineScore
          } as any
        } as any
      })
      
      console.log(`   ✅ Saved: ${title} (score: ${aiScore}, relevance: ${finalRelevanceScore.toFixed(2)})`)
      return savedItem.id
    } catch (error: any) {
      console.error(`   ❌ Error saving: ${error.message}`)
      if (error?.code === 'P2002') {
        // Duplicate - try to find existing
        const { canonicalizeUrlFast } = await import('../src/lib/discovery/canonicalize')
        const canonicalUrl = canonicalizeUrlFast(url) || url
        const existing = await prisma.discoveredContent.findUnique({
          where: {
            patchId_canonicalUrl: {
              patchId: patch.id,
              canonicalUrl
            }
          },
          select: { id: true }
        })
        return existing?.id || null
      }
      return null
    }
  }
  
  for (let i = 0; i < maxToProcess; i++) {
    try {
      const result = await processNextCitation(patch.id, {
        patchName: patch.title,
        patchHandle: patch.handle,
        saveAsContent: saveAsContent
      })
      
      if (result.processed) {
        processed++
        if (result.saved) {
          saved++
        }
        console.log(`   Processed ${i + 1}/${maxToProcess}: ${result.saved ? '✅ SAVED' : '❌ Rejected'}`)
      } else {
        console.log(`   No more citations to process (stopped at ${i + 1})`)
        break
      }
    } catch (error: any) {
      console.error(`   ❌ Error processing citation ${i + 1}: ${error.message}`)
    }
  }
  
  // Check final count
  const finalContentCount = await prisma.discoveredContent.count({
    where: {
      patchId: patch.id
    }
  })
  
  const newContentCount = finalContentCount - initialContentCount
  
  console.log(`\n📊 Results:`)
  console.log(`   Citations processed: ${processed}`)
  console.log(`   Citations saved: ${saved}`)
  console.log(`   New DiscoveredContent items: ${newContentCount}`)
  console.log(`   Total DiscoveredContent: ${finalContentCount}`)
  
  if (newContentCount > 0) {
    console.log(`\n✅ SUCCESS: Discovery is saving content!`)
  } else if (saved > 0) {
    console.log(`\n⚠️  Citations were marked as saved but no new DiscoveredContent was created (may be duplicates)`)
  } else {
    console.log(`\n❌ ISSUE: No content was saved. Citations may be getting rejected.`)
    console.log(`   Check AI scoring - citations may be getting score < 60`)
  }
}

testDiscoverySave().catch(console.error)

