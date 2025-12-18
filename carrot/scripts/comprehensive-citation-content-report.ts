#!/usr/bin/env tsx
/**
 * Comprehensive Citation and Content Report
 * 
 * Provides detailed statistics on:
 * - Citation extraction and storage
 * - Content extraction and saving
 * - Total data/text saved
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function generateComprehensiveReport(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`📊 COMPREHENSIVE CITATION & CONTENT REPORT`)
  console.log(`   Patch: ${patch.title}\n`)
  console.log('═'.repeat(80))

  // ============================================
  // CITATION EXTRACTION STATISTICS
  // ============================================
  console.log(`\n📥 CITATION EXTRACTION STATISTICS\n`)
  console.log('─'.repeat(80))

  const monitoredPages = await prisma.wikipediaMonitoring.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      wikipediaTitle: true,
      citationCount: true,
      citationsExtracted: true,
      lastExtractedAt: true
    }
  })

  const totalPages = monitoredPages.length
  const pagesWithCitations = monitoredPages.filter(p => p.citationsExtracted).length
  const totalCitationsExtracted = monitoredPages.reduce((sum, p) => sum + (p.citationCount || 0), 0)

  console.log(`   Wikipedia Pages Monitored: ${totalPages}`)
  console.log(`   Pages with Citations Extracted: ${pagesWithCitations}`)
  console.log(`   Total Citations Extracted: ${totalCitationsExtracted.toLocaleString()}`)
  console.log(`   Average Citations per Page: ${totalPages > 0 ? (totalCitationsExtracted / totalPages).toFixed(1) : 0}`)

  // ============================================
  // CITATION STORAGE STATISTICS
  // ============================================
  console.log(`\n\n💾 CITATION STORAGE STATISTICS\n`)
  console.log('─'.repeat(80))

  const allCitations = await prisma.wikipediaCitation.findMany({
    where: { monitoring: { patchId: patch.id } },
    select: {
      id: true,
      citationUrl: true,
      verificationStatus: true,
      scanStatus: true,
      relevanceDecision: true,
      contentText: true,
      aiPriorityScore: true
    }
  })

  const totalStored = allCitations.length
  const externalUrls = allCitations.filter(c => {
    const url = c.citationUrl
    return url.startsWith('http://') || url.startsWith('https://')
  }).length

  const wikipediaLinks = allCitations.filter(c => {
    const url = c.citationUrl
    return url.startsWith('./') || 
           url.startsWith('/wiki/') ||
           url.includes('wikipedia.org') ||
           url.includes('wikimedia.org')
  }).length

  console.log(`   Total Citations Stored: ${totalStored.toLocaleString()}`)
  console.log(`   External URLs: ${externalUrls.toLocaleString()} (${((externalUrls / totalStored) * 100).toFixed(1)}%)`)
  console.log(`   Wikipedia Links: ${wikipediaLinks.toLocaleString()} (${((wikipediaLinks / totalStored) * 100).toFixed(1)}%)`)

  // Processing status
  const notScanned = allCitations.filter(c => !c.scanStatus || c.scanStatus === 'pending').length
  const scanned = allCitations.filter(c => c.scanStatus === 'completed' || c.contentText !== null).length
  const currentlyScanning = allCitations.filter(c => c.scanStatus === 'scanning').length

  console.log(`\n   Processing Status:`)
  console.log(`      Not Scanned: ${notScanned.toLocaleString()} (${((notScanned / totalStored) * 100).toFixed(1)}%)`)
  console.log(`      Currently Scanning: ${currentlyScanning.toLocaleString()}`)
  console.log(`      Scanned: ${scanned.toLocaleString()} (${((scanned / totalStored) * 100).toFixed(1)}%)`)

  // Save/Deny breakdown
  const saved = allCitations.filter(c => c.relevanceDecision === 'saved').length
  const denied = allCitations.filter(c => c.relevanceDecision === 'denied').length
  const noDecision = allCitations.filter(c => c.relevanceDecision === null).length
  const processed = saved + denied

  console.log(`\n   Save/Deny Breakdown:`)
  console.log(`      Saved: ${saved.toLocaleString()} (${processed > 0 ? ((saved / processed) * 100).toFixed(1) : 0}% of processed)`)
  console.log(`      Denied: ${denied.toLocaleString()} (${processed > 0 ? ((denied / processed) * 100).toFixed(1) : 0}% of processed)`)
  console.log(`      No Decision: ${noDecision.toLocaleString()}`)
  console.log(`      Total Processed: ${processed.toLocaleString()}`)

  // ============================================
  // CONTENT EXTRACTION STATISTICS
  // ============================================
  console.log(`\n\n📄 CONTENT EXTRACTION STATISTICS\n`)
  console.log('─'.repeat(80))

  const citationsWithContent = allCitations.filter(c => c.contentText && c.contentText.length > 0)
  const citationsWithoutContent = allCitations.filter(c => !c.contentText || c.contentText.length === 0)
  const extractionSuccessRate = scanned > 0 ? ((citationsWithContent.length / scanned) * 100) : 0

  console.log(`   Extraction Success Rate: ${extractionSuccessRate.toFixed(1)}%`)
  console.log(`   Citations with Content: ${citationsWithContent.length.toLocaleString()}`)
  console.log(`   Citations without Content: ${citationsWithoutContent.length.toLocaleString()}`)

  if (citationsWithContent.length > 0) {
    const contentLengths = citationsWithContent.map(c => c.contentText?.length || 0)
    const totalContentChars = contentLengths.reduce((sum, len) => sum + len, 0)
    const avgContentLength = totalContentChars / citationsWithContent.length
    const minContentLength = Math.min(...contentLengths)
    const maxContentLength = Math.max(...contentLengths)

    const shortContent = contentLengths.filter(len => len < 500).length
    const mediumContent = contentLengths.filter(len => len >= 500 && len < 2000).length
    const longContent = contentLengths.filter(len => len >= 2000).length

    console.log(`\n   Content Length Statistics:`)
    console.log(`      Total Characters: ${totalContentChars.toLocaleString()}`)
    console.log(`      Average: ${avgContentLength.toFixed(0)} chars`)
    console.log(`      Min: ${minContentLength.toLocaleString()} chars`)
    console.log(`      Max: ${maxContentLength.toLocaleString()} chars`)

    console.log(`\n   Content Length Distribution:`)
    console.log(`      Short (<500 chars): ${shortContent.toLocaleString()}`)
    console.log(`      Medium (500-1999 chars): ${mediumContent.toLocaleString()}`)
    console.log(`      Long (>=2000 chars): ${longContent.toLocaleString()}`)

    // Convert to more readable units
    const totalKB = totalContentChars / 1024
    const totalMB = totalKB / 1024
    const avgWords = Math.round(totalContentChars / 5) // Rough estimate: 5 chars per word

    console.log(`\n   Content Size:`)
    console.log(`      Total: ${totalMB.toFixed(2)} MB (${totalKB.toFixed(0)} KB)`)
    console.log(`      Estimated Words: ~${avgWords.toLocaleString()}`)
  }

  // ============================================
  // SAVED CONTENT STATISTICS
  // ============================================
  console.log(`\n\n✅ SAVED CONTENT STATISTICS\n`)
  console.log('─'.repeat(80))

  const savedCitations = allCitations.filter(c => c.relevanceDecision === 'saved')
  const savedContentLengths = savedCitations
    .map(c => c.contentText?.length || 0)
    .filter(len => len > 0)

  const totalSavedChars = savedContentLengths.reduce((sum, len) => sum + len, 0)
  const avgSavedLength = savedContentLengths.length > 0 ? totalSavedChars / savedContentLengths.length : 0

  console.log(`   Saved Citations: ${savedCitations.length.toLocaleString()}`)
  console.log(`   Citations with Saved Content: ${savedContentLengths.length.toLocaleString()}`)
  console.log(`   Average Saved Content Length: ${avgSavedLength.toFixed(0)} chars`)

  if (totalSavedChars > 0) {
    const savedKB = totalSavedChars / 1024
    const savedMB = savedKB / 1024
    const savedWords = Math.round(totalSavedChars / 5)

    console.log(`   Total Saved Content: ${totalSavedChars.toLocaleString()} chars`)
    console.log(`   Total Saved: ${savedMB.toFixed(2)} MB (${savedKB.toFixed(0)} KB)`)
    console.log(`   Estimated Words Saved: ~${savedWords.toLocaleString()}`)
  }

  // Check DiscoveredContent entries
  const discoveredContent = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      title: true,
      content: true,
      textContent: true,
      sourceUrl: true,
      metadata: true
    }
  })

  const fromWikipediaCitations = discoveredContent.filter(dc => {
    const metadata = dc.metadata as any
    return metadata?.source === 'wikipedia-citation'
  })

  const discoveredContentLengths = fromWikipediaCitations.map(dc => {
    const content = dc.content || dc.textContent || ''
    return content.length
  }).filter(len => len > 0)

  const totalDiscoveredChars = discoveredContentLengths.reduce((sum, len) => sum + len, 0)
  const avgDiscoveredLength = discoveredContentLengths.length > 0 ? totalDiscoveredChars / discoveredContentLengths.length : 0

  console.log(`\n   DiscoveredContent Entries: ${fromWikipediaCitations.length.toLocaleString()}`)
  console.log(`   Entries with Content: ${discoveredContentLengths.length.toLocaleString()}`)
  console.log(`   Average Entry Length: ${avgDiscoveredLength.toFixed(0)} chars`)

  if (totalDiscoveredChars > 0) {
    const discoveredKB = totalDiscoveredChars / 1024
    const discoveredMB = discoveredKB / 1024
    const discoveredWords = Math.round(totalDiscoveredChars / 5)

    console.log(`   Total DiscoveredContent: ${totalDiscoveredChars.toLocaleString()} chars`)
    console.log(`   Total DiscoveredContent: ${discoveredMB.toFixed(2)} MB (${discoveredKB.toFixed(0)} KB)`)
    console.log(`   Estimated Words in DiscoveredContent: ~${discoveredWords.toLocaleString()}`)
  }

  // ============================================
  // AI SCORING STATISTICS
  // ============================================
  console.log(`\n\n🤖 AI SCORING STATISTICS\n`)
  console.log('─'.repeat(80))

  const citationsWithScore = allCitations.filter(c => c.aiPriorityScore !== null && c.aiPriorityScore !== undefined)
  const citationsWithoutScore = allCitations.filter(c => c.aiPriorityScore === null || c.aiPriorityScore === undefined)
  // Scoring happens during scanning, so use scanned count as denominator
  const scoringSuccessRate = scanned > 0 ? ((citationsWithScore.filter(c => c.contentText !== null).length / scanned) * 100) : 0

  console.log(`   Scoring Success Rate: ${scoringSuccessRate.toFixed(1)}%`)
  console.log(`   Citations with Score: ${citationsWithScore.length.toLocaleString()}`)
  console.log(`   Citations without Score: ${citationsWithoutScore.length.toLocaleString()}`)

  if (citationsWithScore.length > 0) {
    const scores = citationsWithScore.map(c => c.aiPriorityScore || 0)
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)

    const highScores = scores.filter(s => s >= 70).length
    const mediumScores = scores.filter(s => s >= 60 && s < 70).length
    const lowScores = scores.filter(s => s < 60).length

    console.log(`\n   Score Statistics:`)
    console.log(`      Average: ${avgScore.toFixed(1)}`)
    console.log(`      Min: ${minScore}`)
    console.log(`      Max: ${maxScore}`)

    console.log(`\n   Score Distribution:`)
    console.log(`      High (>=70): ${highScores.toLocaleString()}`)
    console.log(`      Medium (60-69): ${mediumScores.toLocaleString()}`)
    console.log(`      Low (<60): ${lowScores.toLocaleString()}`)
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log(`\n\n📋 EXECUTIVE SUMMARY\n`)
  console.log('═'.repeat(80))

  const totalExtractedContent = citationsWithContent.reduce((sum, c) => sum + (c.contentText?.length || 0), 0)
  const totalKB = totalExtractedContent / 1024
  const totalMB = totalKB / 1024
  const totalWords = Math.round(totalExtractedContent / 5)

  const savedKB = totalSavedChars / 1024
  const savedMB = savedKB / 1024
  const savedWords = Math.round(totalSavedChars / 5)

  console.log(`\n   📥 EXTRACTION:`)
  console.log(`      Pages Monitored: ${totalPages}`)
  console.log(`      Citations Extracted: ${totalCitationsExtracted.toLocaleString()}`)
  console.log(`      Citations Stored: ${totalStored.toLocaleString()}`)

  console.log(`\n   💾 PROCESSING:`)
  console.log(`      Processed: ${processed.toLocaleString()} (${((processed / totalStored) * 100).toFixed(1)}%)`)
  console.log(`      Save Rate: ${processed > 0 ? ((saved / processed) * 100).toFixed(1) : 0}%`)
  console.log(`      Content Extraction: ${extractionSuccessRate.toFixed(1)}%`)
  console.log(`      AI Scoring: ${scoringSuccessRate.toFixed(1)}%`)

  console.log(`\n   📄 CONTENT:`)
  console.log(`      Total Content Extracted: ${totalMB.toFixed(2)} MB (${totalWords.toLocaleString()} words)`)
  console.log(`      Total Content Saved: ${savedMB.toFixed(2)} MB (${savedWords.toLocaleString()} words)`)
  console.log(`      DiscoveredContent Entries: ${fromWikipediaCitations.length.toLocaleString()}`)

  console.log(`\n   ✅ STATUS:`)
  console.log(`      ${externalUrls === totalStored ? '✅' : '⚠️ '} All citations are external URLs`)
  console.log(`      ${wikipediaLinks === 0 ? '✅' : '⚠️ '} No Wikipedia links stored`)
  console.log(`      ${fromWikipediaCitations.length > 0 ? '✅' : '⚠️ '} Content being saved to DiscoveredContent`)

  await prisma.$disconnect()
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'

generateComprehensiveReport(patchHandle)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

