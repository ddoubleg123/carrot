/**
 * Test the citation audit system
 */

import { PrismaClient } from '@prisma/client'
import { auditCitationForReprocessing, getAuditCriteria } from '../src/lib/discovery/citationAudit'

const prisma = new PrismaClient()

async function testCitationAudit() {
  console.log('🔍 Testing Citation Audit System\n')
  
  // Show audit criteria
  const criteria = getAuditCriteria()
  console.log('📋 Audit Criteria:')
  console.log(`   Threshold: ${criteria.threshold}\n`)
  criteria.criteria.forEach((criterion, index) => {
    console.log(`   ${index + 1}. ${criterion.name}`)
    console.log(`      ${criterion.description}`)
    console.log(`      Weight: ${criterion.weight}\n`)
  })

  // Test the specific citation
  const citationId = 'cmip9so2u0561ox1t56gue2ye'
  console.log(`\n🧪 Testing Citation: ${citationId}\n`)

  const citation = await prisma.wikipediaCitation.findUnique({
    where: { id: citationId },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      aiPriorityScore: true,
      relevanceDecision: true,
      verificationStatus: true,
      scanStatus: true,
      contentText: true,
      lastScannedAt: true,
      createdAt: true
    }
  })

  if (!citation) {
    console.error('❌ Citation not found')
    return
  }

  console.log('📊 Citation Details:')
  console.log(`   AI Score: ${citation.aiPriorityScore}`)
  console.log(`   Relevance Decision: ${citation.relevanceDecision}`)
  console.log(`   Verification Status: ${citation.verificationStatus}`)
  console.log(`   Content Length: ${citation.contentText?.length || 0} chars`)
  console.log(`   Last Scanned: ${citation.lastScannedAt?.toISOString() || 'Never'}`)

  // Run audit
  const auditResult = auditCitationForReprocessing(citation)

  console.log(`\n📋 Audit Result:`)
  console.log(`   Should Reprocess: ${auditResult.shouldReprocess ? '✅ YES' : '❌ NO'}`)
  console.log(`   Audit Score: ${auditResult.auditScore.toFixed(1)}/100`)
  console.log(`   Priority: ${auditResult.priority.toUpperCase()}`)
  console.log(`   Reasons:`)
  auditResult.reasons.forEach((reason, index) => {
    console.log(`      ${index + 1}. ${reason}`)
  })

  // Test a few more high-scoring denied citations
  console.log(`\n\n🔍 Testing Other High-Scoring Denied Citations:\n`)

  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })

  if (patch) {
    const deniedCandidates = await prisma.wikipediaCitation.findMany({
      where: {
        monitoring: { patchId: patch.id },
        relevanceDecision: 'denied',
        aiPriorityScore: { gte: 60 },
        verificationStatus: { in: ['pending', 'verified'] }
      },
      select: {
        id: true,
        citationUrl: true,
        citationTitle: true,
        aiPriorityScore: true,
        relevanceDecision: true,
        verificationStatus: true,
        scanStatus: true,
        contentText: true,
        lastScannedAt: true,
        createdAt: true
      },
      orderBy: { aiPriorityScore: { sort: 'desc', nulls: 'last' } },
      take: 5
    })

    console.log(`Found ${deniedCandidates.length} high-scoring denied citations to audit:\n`)

    deniedCandidates.forEach((candidate, index) => {
      const audit = auditCitationForReprocessing(candidate)
      console.log(`${index + 1}. ${candidate.citationTitle || candidate.citationUrl.substring(0, 50)}...`)
      console.log(`   AI Score: ${candidate.aiPriorityScore}`)
      console.log(`   Audit Score: ${audit.auditScore.toFixed(1)}/100`)
      console.log(`   Should Reprocess: ${audit.shouldReprocess ? '✅ YES' : '❌ NO'}`)
      console.log(`   Priority: ${audit.priority}`)
      if (audit.reasons.length > 0) {
        console.log(`   Top Reason: ${audit.reasons[0]}`)
      }
      console.log('')
    })
  }

  await prisma.$disconnect()
}

testCitationAudit()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })

