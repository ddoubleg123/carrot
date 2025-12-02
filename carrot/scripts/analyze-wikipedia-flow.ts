/**
 * Comprehensive Analysis of Wikipedia Processing Flow
 * 
 * This script analyzes:
 * 1. Whether Wikipedia processing is being triggered
 * 2. Whether citations are being processed
 * 3. Whether content is being saved to DiscoveredContent
 * 4. Whether content is being saved to AgentMemory
 * 5. What's working and what's not
 * 
 * Usage: npx tsx scripts/analyze-wikipedia-flow.ts [patchHandle]
 */

import { prisma } from '../src/lib/prisma'

async function analyzeWikipediaFlow(patchHandle: string) {
  console.log('='.repeat(80))
  console.log(`Wikipedia Processing Flow Analysis: ${patchHandle}`)
  console.log('='.repeat(80))
  console.log('')

  try {
    // 1. Get patch info
    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle },
      select: { id: true, title: true, handle: true }
    })

    if (!patch) {
      console.error(`❌ Patch "${patchHandle}" not found`)
      process.exit(1)
    }

    console.log(`📋 Patch: ${patch.title} (${patch.handle})`)
    console.log(`   ID: ${patch.id}`)
    console.log('')

    // 2. Check Wikipedia Monitoring Status
    console.log('1️⃣  WIKIPEDIA MONITORING STATUS')
    console.log('-'.repeat(80))
    const monitoringPages = await prisma.wikipediaMonitoring.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        wikipediaTitle: true,
        status: true,
        contentScanned: true,
        citationsExtracted: true,
        citationCount: true,
        lastScannedAt: true,
        lastExtractedAt: true
      }
    })

    const totalPages = monitoringPages.length
    const scannedPages = monitoringPages.filter(p => p.contentScanned).length
    const pagesWithCitations = monitoringPages.filter(p => p.citationsExtracted).length
    const completedPages = monitoringPages.filter(p => p.status === 'completed').length

    console.log(`   Total pages monitored: ${totalPages}`)
    console.log(`   Pages scanned: ${scannedPages}`)
    console.log(`   Pages with citations extracted: ${pagesWithCitations}`)
    console.log(`   Completed pages: ${completedPages}`)
    console.log('')

    // 3. Check Citations Status
    console.log('2️⃣  CITATIONS STATUS')
    console.log('-'.repeat(80))
    const allCitations = await prisma.wikipediaCitation.findMany({
      where: { monitoring: { patchId: patch.id } },
      select: {
        id: true,
        citationTitle: true,
        citationUrl: true,
        aiPriorityScore: true,
        verificationStatus: true,
        scanStatus: true,
        relevanceDecision: true,
        savedContentId: true,
        savedMemoryId: true,
        lastScannedAt: true
      }
    })

    const totalCitations = allCitations.length
    // Note: contentText field exists in DB but Prisma client may need regeneration
    // Check via raw query if needed
    const citationsWithContentResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM wikipedia_citations 
       WHERE monitoring_id IN (
         SELECT id FROM wikipedia_monitoring WHERE patch_id = $1
       ) AND content_text IS NOT NULL AND LENGTH(content_text) > 0`,
      patch.id
    )
    const citationsWithContent = Number(citationsWithContentResult[0]?.count || 0)
    const citationsWithScore = allCitations.filter(c => c.aiPriorityScore !== null).length
    const verifiedCitations = allCitations.filter(c => c.verificationStatus === 'verified').length
    const scannedCitations = allCitations.filter(c => c.scanStatus === 'scanned').length
    const savedCitations = allCitations.filter(c => c.savedContentId !== null).length
    const deniedCitations = allCitations.filter(c => c.relevanceDecision === 'denied').length
    const citationsInMemory = allCitations.filter(c => c.savedMemoryId !== null).length

    console.log(`   Total citations: ${totalCitations}`)
    console.log(`   Citations with content extracted: ${citationsWithContent}`)
    console.log(`   Citations with AI score: ${citationsWithScore}`)
    console.log(`   Verified citations: ${verifiedCitations}`)
    console.log(`   Scanned citations: ${scannedCitations}`)
    console.log(`   Saved to DiscoveredContent: ${savedCitations}`)
    console.log(`   Denied (not relevant): ${deniedCitations}`)
    console.log(`   Saved to AgentMemory: ${citationsInMemory}`)
    console.log('')

    // 4. Check DiscoveredContent
    console.log('3️⃣  DISCOVERED CONTENT STATUS')
    console.log('-'.repeat(80))
    const discoveredContent = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id,
        category: 'wikipedia_citation'
      },
        select: {
          id: true,
          title: true,
          canonicalUrl: true,
          isUseful: true,
          relevanceScore: true,
          metadata: true,
          createdAt: true,
          textContent: true
        },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    const totalDiscovered = await prisma.discoveredContent.count({
      where: {
        patchId: patch.id,
        category: 'wikipedia_citation'
      }
    })

    const usefulDiscovered = discoveredContent.filter(c => c.isUseful === true).length
    const totalUseful = await prisma.discoveredContent.count({
      where: {
        patchId: patch.id,
        category: 'wikipedia_citation',
        isUseful: true
      }
    })

    console.log(`   Total Wikipedia citations in DiscoveredContent: ${totalDiscovered}`)
    console.log(`   Useful (published) citations: ${totalUseful}`)
    console.log(`   Recent items (last 20):`)
    discoveredContent.slice(0, 10).forEach((item, i) => {
      const metadata = item.metadata as any
      const aiScore = metadata?.aiPriorityScore || 'N/A'
      console.log(`     ${i + 1}. "${item.title?.substring(0, 50)}"`)
      console.log(`        URL: ${item.canonicalUrl?.substring(0, 60)}...`)
      console.log(`        isUseful: ${item.isUseful}, relevanceScore: ${item.relevanceScore?.toFixed(2)}, aiScore: ${aiScore}`)
      console.log(`        Created: ${item.createdAt.toISOString()}`)
      console.log(`        Has content: ${item.textContent ? `${item.textContent.length} chars` : 'NO'}`)
    })
    console.log('')

    // 5. Check AgentMemory
    console.log('4️⃣  AGENT MEMORY STATUS')
    console.log('-'.repeat(80))
    const agentMemories = await prisma.agentMemory.findMany({
      where: {
        sourceType: 'wikipedia_citation',
        tags: { has: patchHandle }
      },
      select: {
        id: true,
        sourceTitle: true,
        sourceUrl: true,
        content: true,
        createdAt: true,
        tags: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    const totalMemories = await prisma.agentMemory.count({
      where: {
        sourceType: 'wikipedia_citation',
        tags: { has: patchHandle }
      }
    })

    console.log(`   Total Wikipedia citations in AgentMemory: ${totalMemories}`)
    console.log(`   Recent memories (last 10):`)
    agentMemories.forEach((memory, i) => {
      console.log(`     ${i + 1}. "${memory.sourceTitle?.substring(0, 50)}"`)
      console.log(`        URL: ${memory.sourceUrl?.substring(0, 60)}...`)
      console.log(`        Content length: ${memory.content?.length || 0} chars`)
      console.log(`        Tags: ${JSON.stringify(memory.tags)}`)
      console.log(`        Created: ${memory.createdAt.toISOString()}`)
    })
    console.log('')

    // 6. Check Recent Activity
    console.log('5️⃣  RECENT PROCESSING ACTIVITY')
    console.log('-'.repeat(80))
    const recentCitations = await prisma.wikipediaCitation.findMany({
      where: { monitoring: { patchId: patch.id } },
      orderBy: { lastScannedAt: 'desc' },
      take: 10,
      select: {
        citationTitle: true,
        aiPriorityScore: true,
        verificationStatus: true,
        scanStatus: true,
        relevanceDecision: true,
        savedContentId: true,
        savedMemoryId: true,
        lastScannedAt: true,
      }
    })

    console.log(`   Last 10 processed citations:`)
    recentCitations.forEach((citation, i) => {
      console.log(`     ${i + 1}. "${citation.citationTitle?.substring(0, 50)}"`)
      console.log(`        Score: ${citation.aiPriorityScore ?? 'N/A'}`)
      console.log(`        Status: ${citation.verificationStatus}/${citation.scanStatus}`)
      console.log(`        Decision: ${citation.relevanceDecision ?? 'pending'}`)
      console.log(`        Saved to Content: ${citation.savedContentId ? 'YES' : 'NO'}`)
      console.log(`        Saved to Memory: ${citation.savedMemoryId ? 'YES' : 'NO'}`)
      console.log(`        Content stored: CHECK DB`)
      console.log(`        Last scanned: ${citation.lastScannedAt?.toISOString() ?? 'never'}`)
    })
    console.log('')

    // 7. Analysis Summary
    console.log('6️⃣  ANALYSIS SUMMARY')
    console.log('='.repeat(80))
    console.log('')

    const issues: string[] = []
    const working: string[] = []

    // Check if processing is happening
    if (totalPages === 0) {
      issues.push('❌ No Wikipedia pages are being monitored')
    } else {
      working.push('✅ Wikipedia pages are being monitored')
    }

    if (totalCitations === 0) {
      issues.push('❌ No citations have been extracted')
    } else {
      working.push(`✅ ${totalCitations} citations extracted`)
    }

    if (citationsWithContent === 0 && totalCitations > 0) {
      issues.push('❌ Citations extracted but no content has been fetched yet')
    } else if (citationsWithContent > 0) {
      working.push(`✅ ${citationsWithContent} citations have content extracted`)
    }

    if (citationsWithScore === 0 && citationsWithContent > 0) {
      issues.push('❌ Content extracted but no citations have been scored by DeepSeek')
    } else if (citationsWithScore > 0) {
      working.push(`✅ ${citationsWithScore} citations have been scored by DeepSeek`)
    }

    if (savedCitations === 0 && scannedCitations > 0) {
      issues.push('❌ Citations scanned but none saved to DiscoveredContent (may be failing relevance check)')
    } else if (savedCitations > 0) {
      working.push(`✅ ${savedCitations} citations saved to DiscoveredContent`)
    }

    if (citationsInMemory === 0 && savedCitations > 0) {
      issues.push('❌ Citations saved to DiscoveredContent but not to AgentMemory')
    } else if (citationsInMemory > 0) {
      working.push(`✅ ${citationsInMemory} citations saved to AgentMemory`)
    }

    if (totalDiscovered === 0) {
      issues.push('❌ No Wikipedia citations in DiscoveredContent table')
    } else {
      working.push(`✅ ${totalDiscovered} Wikipedia citations in DiscoveredContent`)
    }

    if (totalUseful === 0 && totalDiscovered > 0) {
      issues.push('⚠️  Citations in DiscoveredContent but none marked as useful (isUseful=false)')
    } else if (totalUseful > 0) {
      working.push(`✅ ${totalUseful} citations marked as useful (isUseful=true)`)
    }

    if (totalMemories === 0 && savedCitations > 0) {
      issues.push('❌ Citations saved but none in AgentMemory')
    } else if (totalMemories > 0) {
      working.push(`✅ ${totalMemories} citations in AgentMemory`)
    }

    // Check score distribution
    if (citationsWithScore > 0) {
      const scores = allCitations
        .filter(c => c.aiPriorityScore !== null)
        .map(c => c.aiPriorityScore!)
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
      const below60 = scores.filter(s => s < 60).length
      const above60 = scores.filter(s => s >= 60).length

      console.log(`   Score Distribution:`)
      console.log(`     Average score: ${avgScore.toFixed(2)}`)
      console.log(`     Citations with score >= 60: ${above60}`)
      console.log(`     Citations with score < 60: ${below60}`)
      console.log('')

      if (below60 > above60) {
        issues.push(`⚠️  Most citations (${below60}) have scores below 60 threshold`)
      }
    }

    console.log('✅ WHAT\'S WORKING:')
    working.forEach(item => console.log(`   ${item}`))
    console.log('')

    if (issues.length > 0) {
      console.log('❌ ISSUES FOUND:')
      issues.forEach(item => console.log(`   ${item}`))
      console.log('')
    } else {
      console.log('✅ No issues found - everything appears to be working!')
      console.log('')
    }

    console.log('='.repeat(80))

  } catch (error: any) {
    console.error('❌ Analysis failed:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

const patchHandle = process.argv[2]
if (!patchHandle) {
  console.error('Usage: npx tsx scripts/analyze-wikipedia-flow.ts [patchHandle]')
  process.exit(1)
}

analyzeWikipediaFlow(patchHandle).catch(console.error)

