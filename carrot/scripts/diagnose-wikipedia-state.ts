/**
 * Wikipedia State Diagnostic Script
 * 
 * This script provides a comprehensive real-time view of the Wikipedia
 * monitoring and citation processing state. It shows:
 * 1. Page status distribution
 * 2. Citation status distribution
 * 3. Why pages/citations aren't being found
 * 4. Query conditions that would match
 * 
 * Usage: npx tsx scripts/diagnose-wikipedia-state.ts [patchHandle]
 * Example: npx tsx scripts/diagnose-wikipedia-state.ts chicago-bulls
 */

import { prisma } from '../src/lib/prisma'

async function diagnoseWikipediaState(patchHandle: string) {
  console.log(`\n🔍 Wikipedia State Diagnostic: ${patchHandle}\n`)

  try {
    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle },
      select: { id: true, title: true }
    })

    if (!patch) {
      console.error(`❌ Error: Patch with handle "${patchHandle}" not found.`)
      process.exit(1)
    }

    console.log(`📋 Patch: ${patch.title} (${patch.id})\n`)
    console.log('=' .repeat(70))

    // 1. PAGE STATUS DISTRIBUTION
    console.log('\n1️⃣  PAGE STATUS DISTRIBUTION\n')
    
    const pageStatusCounts = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT status, COUNT(*) as count
      FROM wikipedia_monitoring
      WHERE patch_id = ${patch.id}
      GROUP BY status
      ORDER BY status
    `

    const totalPages = await prisma.wikipediaMonitoring.count({
      where: { patchId: patch.id }
    })

    console.log(`Total pages: ${totalPages}`)
    pageStatusCounts.forEach(({ status, count }) => {
      console.log(`  ${status}: ${count}`)
    })

    // Show pages by content/citation extraction status
    const pagesByExtraction = await prisma.wikipediaMonitoring.groupBy({
      by: ['contentScanned', 'citationsExtracted'],
      _count: { id: true },
      where: { patchId: patch.id }
    })

    console.log('\nPages by extraction status:')
    pagesByExtraction.forEach(({ contentScanned, citationsExtracted, _count }) => {
      console.log(`  contentScanned: ${contentScanned}, citationsExtracted: ${citationsExtracted} → ${_count.id} pages`)
    })

    // 2. CITATION STATUS DISTRIBUTION
    console.log('\n2️⃣  CITATION STATUS DISTRIBUTION\n')
    
    const totalCitations = await prisma.wikipediaCitation.count({
      where: { monitoring: { patchId: patch.id } }
    })

    const citationStatusCounts = await prisma.$queryRaw<Array<{ 
      verification_status: string
      scan_status: string
      relevance_decision: string | null
      count: bigint 
    }>>`
      SELECT 
        verification_status,
        scan_status,
        relevance_decision,
        COUNT(*) as count
      FROM wikipedia_citations wc
      JOIN wikipedia_monitoring wm ON wc.monitoring_id = wm.id
      WHERE wm.patch_id = ${patch.id}
      GROUP BY verification_status, scan_status, relevance_decision
      ORDER BY verification_status, scan_status, relevance_decision
    `

    console.log(`Total citations: ${totalCitations}`)
    citationStatusCounts.forEach(({ verification_status, scan_status, relevance_decision, count }) => {
      const decision = relevance_decision || 'null'
      console.log(`  ${verification_status}/${scan_status}/${decision}: ${count}`)
    })

    // 3. WHY PAGES AREN'T BEING FOUND
    console.log('\n3️⃣  WHY PAGES AREN'T BEING FOUND\n')
    
    // Check what getNextWikipediaPageToProcess would find
    const pagesThatShouldMatch = await prisma.wikipediaMonitoring.findMany({
      where: {
        patchId: patch.id,
        status: { in: ['pending', 'scanning', 'error'] },
        OR: [
          { contentScanned: false },
          { citationsExtracted: false }
        ]
      },
      select: {
        id: true,
        wikipediaTitle: true,
        status: true,
        contentScanned: true,
        citationsExtracted: true,
        priority: true
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ],
      take: 5
    })

    console.log(`Pages matching getNextWikipediaPageToProcess query: ${pagesThatShouldMatch.length}`)
    if (pagesThatShouldMatch.length > 0) {
      pagesThatShouldMatch.forEach((page, i) => {
        console.log(`  ${i + 1}. "${page.wikipediaTitle}"`)
        console.log(`     Status: ${page.status}, contentScanned: ${page.contentScanned}, citationsExtracted: ${page.citationsExtracted}, priority: ${page.priority}`)
      })
    } else {
      console.log('  ❌ No pages match the query conditions!')
      
      // Check for completed pages with unprocessed citations
      const completedPagesWithUnprocessedCitations = await prisma.wikipediaMonitoring.findMany({
        where: {
          patchId: patch.id,
          status: 'completed',
          citationsExtracted: true,
          citations: {
            some: {
              OR: [
                { scanStatus: { not: 'scanned' } },
                { relevanceDecision: null }
              ]
            }
          }
        },
        select: {
          id: true,
          wikipediaTitle: true,
          status: true,
          citationsExtracted: true,
          _count: {
            select: {
              citations: {
                where: {
                  OR: [
                    { scanStatus: { not: 'scanned' } },
                    { relevanceDecision: null }
                  ]
                }
              }
            }
          }
        },
        take: 5
      })

      if (completedPagesWithUnprocessedCitations.length > 0) {
        console.log(`\n  ⚠️  Found ${completedPagesWithUnprocessedCitations.length} 'completed' pages with unprocessed citations:`)
        completedPagesWithUnprocessedCitations.forEach((page, i) => {
          console.log(`  ${i + 1}. "${page.wikipediaTitle}"`)
          console.log(`     Unprocessed citations: ${page._count.citations}`)
        })
        console.log('  → These should be reset to "scanning" status by recovery logic')
      } else {
        console.log('  ℹ️  All pages are truly completed (no unprocessed citations)')
      }
    }

    // 4. WHY CITATIONS AREN'T BEING FOUND
    console.log('\n4️⃣  WHY CITATIONS AREN'T BEING FOUND\n')
    
    // Check what getNextCitationToProcess would find
    const citationsThatShouldMatch = await prisma.wikipediaCitation.findMany({
      where: {
        monitoring: { patchId: patch.id },
        verificationStatus: { in: ['pending', 'verified'] },
        scanStatus: { in: ['not_scanned', 'scanning'] },
        relevanceDecision: null
      },
      select: {
        id: true,
        citationTitle: true,
        verificationStatus: true,
        scanStatus: true,
        aiPriorityScore: true,
        monitoring: {
          select: {
            wikipediaTitle: true
          }
        }
      },
      orderBy: [
        { aiPriorityScore: 'desc' },
        { createdAt: 'asc' }
      ],
      take: 10
    })

    console.log(`Citations matching getNextCitationToProcess query: ${citationsThatShouldMatch.length}`)
    if (citationsThatShouldMatch.length > 0) {
      console.log('\nTop 10 citations that should be processed:')
      citationsThatShouldMatch.forEach((citation, i) => {
        console.log(`  ${i + 1}. "${citation.citationTitle || 'Untitled'}"`)
        console.log(`     From page: ${citation.monitoring.wikipediaTitle}`)
        console.log(`     Status: ${citation.verificationStatus}/${citation.scanStatus}`)
        console.log(`     AI Priority: ${citation.aiPriorityScore || 'N/A'}`)
      })
    } else {
      console.log('  ❌ No citations match the query conditions!')
      
      // Show breakdown of why they don't match
      const pendingButNotMatching = await prisma.wikipediaCitation.count({
        where: {
          monitoring: { patchId: patch.id },
          verificationStatus: 'pending',
          scanStatus: 'not_scanned'
        }
      })

      const verifiedButNotMatching = await prisma.wikipediaCitation.count({
        where: {
          monitoring: { patchId: patch.id },
          verificationStatus: 'verified',
          scanStatus: 'not_scanned'
        }
      })

      const withRelevanceDecision = await prisma.wikipediaCitation.count({
        where: {
          monitoring: { patchId: patch.id },
          relevanceDecision: { not: null }
        }
      })

      console.log(`\n  Citation breakdown:`)
      console.log(`    Pending + not_scanned: ${pendingButNotMatching}`)
      console.log(`    Verified + not_scanned: ${verifiedButNotMatching}`)
      console.log(`    Already have relevanceDecision: ${withRelevanceDecision}`)
      console.log(`    Total citations: ${totalCitations}`)
    }

    // 5. PROCESSING RECOMMENDATIONS
    console.log('\n5️⃣  PROCESSING RECOMMENDATIONS\n')
    
    const unprocessedCitations = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId: patch.id },
        OR: [
          { scanStatus: { not: 'scanned' } },
          { relevanceDecision: null }
        ]
      }
    })

    const processedCitations = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId: patch.id },
        scanStatus: 'scanned',
        relevanceDecision: { not: null }
      }
    })

    console.log(`Unprocessed citations: ${unprocessedCitations}`)
    console.log(`Processed citations: ${processedCitations}`)
    console.log(`Progress: ${totalCitations > 0 ? Math.round((processedCitations / totalCitations) * 100) : 0}%`)

    if (unprocessedCitations > 0) {
      console.log('\n💡 Recommendations:')
      
      if (pagesThatShouldMatch.length === 0 && completedPagesWithUnprocessedCitations.length > 0) {
        console.log('  1. Recovery logic should reset completed pages with unprocessed citations')
        console.log('  2. Ensure getNextWikipediaPageToProcess recovery logic is being called')
      }
      
      if (citationsThatShouldMatch.length === 0 && unprocessedCitations > 0) {
        console.log('  1. Citations exist but query conditions are too restrictive')
        console.log('  2. Consider processing citations regardless of page status')
        console.log('  3. Check if verificationStatus/scanStatus values are correct')
      }
      
      if (citationsThatShouldMatch.length > 0) {
        console.log('  1. Citations are available - processing should work')
        console.log('  2. Check if processNextCitation is being called')
        console.log('  3. Check for errors in citation processing')
      }
    } else {
      console.log('\n✅ All citations have been processed!')
    }

    console.log('\n' + '='.repeat(70) + '\n')

    process.exit(0)

  } catch (error: any) {
    console.error(`❌ Diagnostic failed:`, error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

const patchHandle = process.argv[2]
if (!patchHandle) {
  console.error('Usage: npx tsx scripts/diagnose-wikipedia-state.ts [patchHandle]')
  process.exit(1)
}

diagnoseWikipediaState(patchHandle).catch(console.error)

