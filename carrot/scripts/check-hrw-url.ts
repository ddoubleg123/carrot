/**
 * Check if we found the HRW URL and analyze the data
 * Run with: npx tsx scripts/check-hrw-url.ts
 */

import { prisma } from '../src/lib/prisma'

async function checkHRWUrl() {
  const targetUrl = 'https://www.hrw.org/news/2020/05/12/israel-discriminatory-land-policies-hem-palestinians'
  
  try {
    const patch = await prisma.patch.findUnique({
      where: { handle: 'israel' },
      select: { id: true, title: true }
    })

    if (!patch) {
      console.log('Patch "israel" not found')
      return
    }

    console.log(`\n🔍 Searching for URL: ${targetUrl}\n`)

    // 1. Check in Wikipedia Citations
    console.log('1️⃣ Checking Wikipedia Citations...')
    const citations = await prisma.wikipediaCitation.findMany({
      where: {
        monitoring: { patchId: patch.id },
        citationUrl: { contains: 'hrw.org' }
      },
      select: {
        id: true,
        citationTitle: true,
        citationUrl: true,
        citationContext: true,
        scanStatus: true,
        relevanceDecision: true,
        aiPriorityScore: true,
        savedContentId: true,
        savedMemoryId: true,
        contentText: true,
        errorMessage: true,
        verificationStatus: true,
        lastScannedAt: true,
        monitoring: {
          select: {
            wikipediaTitle: true,
            wikipediaUrl: true
          }
        }
      }
    })

    console.log(`   Found ${citations.length} HRW citations`)
    
    const exactMatch = citations.find(c => 
      c.citationUrl.includes('israel-discriminatory-land-policies-hem-palestinians') ||
      c.citationUrl === targetUrl
    )

    if (exactMatch) {
      console.log(`\n✅ FOUND IN CITATIONS!\n`)
      console.log(`   Citation ID: ${exactMatch.id}`)
      console.log(`   Title: ${exactMatch.citationTitle || 'N/A'}`)
      console.log(`   URL: ${exactMatch.citationUrl}`)
      console.log(`   Context: ${exactMatch.citationContext?.substring(0, 200) || 'N/A'}`)
      console.log(`   From Wikipedia Page: ${exactMatch.monitoring.wikipediaTitle}`)
      console.log(`   Scan Status: ${exactMatch.scanStatus}`)
      console.log(`   Verification Status: ${exactMatch.verificationStatus}`)
      console.log(`   Relevance Decision: ${exactMatch.relevanceDecision || 'N/A'}`)
      console.log(`   AI Priority Score: ${exactMatch.aiPriorityScore ?? 'N/A'}`)
      console.log(`   Saved Content ID: ${exactMatch.savedContentId || 'N/A'}`)
      console.log(`   Saved Memory ID: ${exactMatch.savedMemoryId || 'N/A'}`)
      console.log(`   Content Length: ${exactMatch.contentText?.length || 0} chars`)
      console.log(`   Last Scanned: ${exactMatch.lastScannedAt?.toISOString() || 'Never'}`)
      if (exactMatch.errorMessage) {
        console.log(`   Error: ${exactMatch.errorMessage}`)
      }
      
      if (exactMatch.contentText) {
        console.log(`\n   Content Preview (first 500 chars):`)
        console.log(`   ${exactMatch.contentText.substring(0, 500)}...`)
      }
    } else {
      console.log(`   ❌ Not found in citations`)
      if (citations.length > 0) {
        console.log(`   Found ${citations.length} other HRW URLs:`)
        citations.slice(0, 5).forEach(c => {
          console.log(`     - ${c.citationUrl}`)
        })
      }
    }

    // 2. Check in DiscoveredContent
    console.log(`\n2️⃣ Checking DiscoveredContent...`)
    const discoveredContent = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id,
        OR: [
          { canonicalUrl: { contains: 'hrw.org' } },
          { sourceUrl: { contains: 'hrw.org' } }
        ]
      },
      select: {
        id: true,
        title: true,
        canonicalUrl: true,
        sourceUrl: true,
        relevanceScore: true,
        qualityScore: true,
        summary: true,
        content: true,
        createdAt: true
      }
    })

    console.log(`   Found ${discoveredContent.length} HRW items in DiscoveredContent`)
    
    const exactContent = discoveredContent.find(c => 
      c.canonicalUrl?.includes('israel-discriminatory-land-policies-hem-palestinians') ||
      c.sourceUrl?.includes('israel-discriminatory-land-policies-hem-palestinians')
    )

    if (exactContent) {
      console.log(`\n✅ FOUND IN DISCOVERED CONTENT!\n`)
      console.log(`   Content ID: ${exactContent.id}`)
      console.log(`   Title: ${exactContent.title}`)
      console.log(`   Canonical URL: ${exactContent.canonicalUrl}`)
      console.log(`   Source URL: ${exactContent.sourceUrl}`)
      console.log(`   Relevance Score: ${exactContent.relevanceScore}`)
      console.log(`   Quality Score: ${exactContent.qualityScore}`)
      console.log(`   Created: ${exactContent.createdAt.toISOString()}`)
      if (exactContent.summary) {
        console.log(`   Summary: ${exactContent.summary.substring(0, 200)}...`)
      }
    } else {
      console.log(`   ❌ Not found in DiscoveredContent`)
    }

    // 3. Check in AgentMemory
    console.log(`\n3️⃣ Checking AgentMemory...`)
    const agentMemories = await prisma.agentMemory.findMany({
      where: {
        sourceUrl: { contains: 'hrw.org' }
      },
      select: {
        id: true,
        sourceTitle: true,
        sourceUrl: true,
        content: true,
        createdAt: true
      },
      take: 10
    })

    console.log(`   Found ${agentMemories.length} HRW items in AgentMemory`)
    
    const exactMemory = agentMemories.find(m => 
      m.sourceUrl?.includes('israel-discriminatory-land-policies-hem-palestinians')
    )

    if (exactMemory) {
      console.log(`\n✅ FOUND IN AGENT MEMORY!\n`)
      console.log(`   Memory ID: ${exactMemory.id}`)
      console.log(`   Title: ${exactMemory.sourceTitle}`)
      console.log(`   URL: ${exactMemory.sourceUrl}`)
      console.log(`   Content Length: ${exactMemory.content?.length || 0} chars`)
      console.log(`   Created: ${exactMemory.createdAt.toISOString()}`)
    } else {
      console.log(`   ❌ Not found in AgentMemory`)
    }

    // 4. Analysis
    console.log(`\n📊 ANALYSIS:\n`)
    
    if (exactMatch) {
      console.log(`✅ URL WAS EXTRACTED from Wikipedia`)
      console.log(`   Source: ${exactMatch.monitoring.wikipediaTitle}`)
      
      if (exactMatch.scanStatus === 'scanned') {
        console.log(`✅ URL WAS PROCESSED`)
        
        if (exactMatch.relevanceDecision === 'approved' || exactMatch.savedContentId) {
          console.log(`✅ URL WAS APPROVED AND SAVED`)
          console.log(`   AI Score: ${exactMatch.aiPriorityScore}`)
          console.log(`   Content ID: ${exactMatch.savedContentId}`)
        } else {
          console.log(`❌ URL WAS REJECTED`)
          console.log(`   Reason: ${exactMatch.relevanceDecision || 'N/A'}`)
          console.log(`   AI Score: ${exactMatch.aiPriorityScore ?? 'N/A'}`)
          if (exactMatch.aiPriorityScore !== null && exactMatch.aiPriorityScore < 60) {
            console.log(`   ⚠️  Score below 60 threshold (${exactMatch.aiPriorityScore} < 60)`)
          }
        }
      } else if (exactMatch.scanStatus === 'not_scanned') {
        console.log(`⏳ URL IS PENDING PROCESSING`)
        console.log(`   Status: ${exactMatch.scanStatus}`)
      } else if (exactMatch.verificationStatus === 'failed') {
        console.log(`❌ URL VERIFICATION FAILED`)
        console.log(`   Error: ${exactMatch.errorMessage || 'Unknown'}`)
      }
    } else {
      console.log(`❌ URL WAS NOT EXTRACTED from Wikipedia`)
      console.log(`   This could mean:`)
      console.log(`   - It's not in the References/Further reading/External links sections`)
      console.log(`   - The Wikipedia pages we're monitoring don't link to it`)
      console.log(`   - It was filtered out during extraction`)
    }

  } catch (error: any) {
    console.error('Error:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

checkHRWUrl().catch(console.error)

