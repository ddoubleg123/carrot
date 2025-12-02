/**
 * Get examples of citations with scores between 50 and 60
 * Usage: npx tsx scripts/get-citations-50-60.ts [patchHandle]
 */

import { prisma } from '../src/lib/prisma'

async function getCitations50to60(patchHandle: string) {
  try {
    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle },
      select: { id: true, title: true }
    })

    if (!patch) {
      console.error(`Patch "${patchHandle}" not found`)
      process.exit(1)
    }

    console.log(`\n📊 Citations with scores between 50 and 60 for: ${patch.title}\n`)
    console.log('='.repeat(80))

    // Get citations with scores between 50 and 60, excluding Wikipedia internal links
    const citations = await prisma.wikipediaCitation.findMany({
      where: {
        monitoring: { patchId: patch.id },
        aiPriorityScore: {
          gte: 50,
          lt: 60
        },
        scanStatus: 'scanned', // Only show ones that have been processed
        citationUrl: {
          not: {
            startsWith: './'
          }
        },
        NOT: {
          citationUrl: {
            startsWith: '../'
          }
        }
      },
      select: {
        id: true,
        citationTitle: true,
        citationUrl: true,
        aiPriorityScore: true,
        relevanceDecision: true,
        savedContentId: true,
        citationContext: true
      },
      orderBy: {
        aiPriorityScore: 'desc'
      },
      take: 20
    })

    if (citations.length === 0) {
      console.log('No citations found with scores between 50 and 60 that have been scanned.')
      console.log('\nChecking for unscanned citations with scores in this range...\n')
      
      const unscanned = await prisma.wikipediaCitation.findMany({
        where: {
          monitoring: { patchId: patch.id },
          aiPriorityScore: {
            gte: 50,
            lt: 60
          }
        },
        select: {
          id: true,
          citationTitle: true,
          citationUrl: true,
          aiPriorityScore: true,
          scanStatus: true,
          verificationStatus: true
        },
        orderBy: {
          aiPriorityScore: 'desc'
        },
        take: 10
      })

      if (unscanned.length > 0) {
        console.log(`Found ${unscanned.length} unscanned citations with scores 50-60:\n`)
        unscanned.forEach((citation, i) => {
          console.log(`${i + 1}. "${citation.citationTitle || 'Untitled'}"`)
          console.log(`   URL: ${citation.citationUrl}`)
          console.log(`   Score: ${citation.aiPriorityScore}`)
          console.log(`   Status: ${citation.verificationStatus}/${citation.scanStatus}`)
          console.log('')
        })
      }
    } else {
      console.log(`Found ${citations.length} citations with scores between 50 and 60:\n`)
      
      citations.slice(0, 5).forEach((citation, i) => {
        console.log(`${i + 1}. "${citation.citationTitle || 'Untitled'}"`)
        console.log(`   URL: ${citation.citationUrl}`)
        console.log(`   Score: ${citation.aiPriorityScore}`)
        console.log(`   Decision: ${citation.relevanceDecision || 'pending'}`)
        console.log(`   Saved to Content: ${citation.savedContentId ? 'YES' : 'NO'}`)
        if (citation.citationContext) {
          console.log(`   Context: ${citation.citationContext.substring(0, 100)}...`)
        }
        console.log('')
      })

      // Also show some that were denied
      const denied = citations.filter(c => c.relevanceDecision === 'denied')
      if (denied.length > 0) {
        console.log('\n--- Examples of DENIED citations (score 50-60) ---\n')
        denied.slice(0, 3).forEach((citation, i) => {
          console.log(`${i + 1}. "${citation.citationTitle || 'Untitled'}"`)
          console.log(`   URL: ${citation.citationUrl}`)
          console.log(`   Score: ${citation.aiPriorityScore}`)
          console.log(`   Decision: ${citation.relevanceDecision}`)
          console.log('')
        })
      }
    }

    // Get statistics using raw query to avoid ambiguous column error
    const stats = await prisma.$queryRawUnsafe<Array<{ relevance_decision: string | null; count: bigint }>>(
      `SELECT relevance_decision, COUNT(*) as count
       FROM wikipedia_citations wc
       JOIN wikipedia_monitoring wm ON wc.monitoring_id = wm.id
       WHERE wm.patch_id = $1
         AND wc.ai_priority_score >= 50
         AND wc.ai_priority_score < 60
         AND wc.scan_status = 'scanned'
       GROUP BY relevance_decision`,
      patch.id
    )

    console.log('\n--- Statistics for citations with scores 50-60 (external URLs only) ---')
    stats.forEach(stat => {
      console.log(`   ${stat.relevance_decision || 'pending'}: ${stat.count}`)
    })

    await prisma.$disconnect()
  } catch (error: any) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

const patchHandle = process.argv[2] || 'chicago-bulls'
getCitations50to60(patchHandle).catch(console.error)

