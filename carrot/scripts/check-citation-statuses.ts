/**
 * Check citation statuses to understand why they're not being processed
 */

import { prisma } from '../src/lib/prisma'

async function main() {
  const patchHandle = 'israel'
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`Patch with handle "${patchHandle}" not found.`)
    return
  }

  console.log(`\n=== Citation Status Breakdown for "${patch.title}" ===\n`)

  // Check scanStatus distribution
  const scanStatusCounts = await prisma.wikipediaCitation.groupBy({
    by: ['scanStatus'],
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { not: { contains: 'wikipedia.org' } }
    },
    _count: true
  })

  console.log('=== Scan Status Distribution ===')
  scanStatusCounts.forEach(({ scanStatus, _count }) => {
    console.log(`${scanStatus || 'NULL'}: ${_count}`)
  })
  console.log('')

  // Check verificationStatus distribution
  const verificationStatusCounts = await prisma.wikipediaCitation.groupBy({
    by: ['verificationStatus'],
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { not: { contains: 'wikipedia.org' } }
    },
    _count: true
  })

  console.log('=== Verification Status Distribution ===')
  verificationStatusCounts.forEach(({ verificationStatus, _count }) => {
    console.log(`${verificationStatus || 'NULL'}: ${_count}`)
  })
  console.log('')

  // Check relevanceDecision distribution
  const relevanceDecisionCounts = await prisma.wikipediaCitation.groupBy({
    by: ['relevanceDecision'],
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { not: { contains: 'wikipedia.org' } }
    },
    _count: true
  })

  console.log('=== Relevance Decision Distribution ===')
  relevanceDecisionCounts.forEach(({ relevanceDecision, _count }) => {
    console.log(`${relevanceDecision || 'NULL (Pending)'}: ${_count}`)
  })
  console.log('')

  // Get sample of citations that should be processable
  const sampleProcessable = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      citationUrl: { not: { contains: 'wikipedia.org' } },
      relevanceDecision: null
    },
    take: 5,
    select: {
      id: true,
      citationUrl: true,
      scanStatus: true,
      verificationStatus: true,
      relevanceDecision: true,
      sourceNumber: true,
      monitoring: {
        select: {
          wikipediaTitle: true
        }
      }
    }
  })

  console.log('=== Sample of Pending Citations (first 5) ===')
  sampleProcessable.forEach((citation, index) => {
    console.log(`${index + 1}. ${citation.citationUrl}`)
    console.log(`   Scan Status: ${citation.scanStatus}`)
    console.log(`   Verification Status: ${citation.verificationStatus}`)
    console.log(`   Relevance Decision: ${citation.relevanceDecision || 'NULL'}`)
    console.log(`   From: ${citation.monitoring?.wikipediaTitle || 'N/A'}, Reference #${citation.sourceNumber}`)
    console.log('')
  })

  await prisma.$disconnect()
}

main().catch(console.error)

