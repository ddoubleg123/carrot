#!/usr/bin/env tsx
/**
 * Discovery Citation Processing Audit
 * 
 * This script runs discovery in audit mode to track:
 * - How many citations are being processed
 * - How many are extracting content successfully
 * - How many are being saved
 * - Content extraction quality
 * - API scoring success rate
 * - Detailed metrics on each step
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { processNextCitation } from '../src/lib/discovery/wikipediaProcessor'
import { getNextCitationToProcess } from '../src/lib/discovery/wikipediaCitation'

const prisma = new PrismaClient()

interface AuditMetrics {
  totalProcessed: number
  verified: number
  verificationFailed: number
  contentExtracted: number
  contentExtractionFailed: number
  apiScored: number
  apiScoringFailed: number
  saved: number
  denied: number
  contentLengths: number[]
  scores: number[]
  errors: Array<{ url: string; error: string; step: string }>
  extractionMethods: Record<string, number>
  denialReasons: Record<string, number>
  saveReasons: Record<string, number>
}

async function auditCitationProcessing(
  patchHandle: string,
  options: {
    limit?: number
    batchSize?: number
    verbose?: boolean
  } = {}
) {
  const { limit = 50, batchSize = 10, verbose = false } = options

  console.log('🔍 Discovery Citation Processing Audit\n')
  console.log(`Patch: ${patchHandle}`)
  console.log(`Limit: ${limit} citations`)
  console.log(`Batch size: ${batchSize}\n`)

  // Get patch info
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true, handle: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`✅ Found patch: ${patch.title} (${patch.id})\n`)

  // Get initial stats
  const initialStats = await prisma.wikipediaCitation.groupBy({
    by: ['scanStatus', 'relevanceDecision', 'verificationStatus'],
    where: {
      monitoring: { patchId: patch.id }
    },
    _count: true
  })

  console.log('📊 Initial Citation Statistics:')
  console.log(JSON.stringify(initialStats, null, 2))
  console.log()

  // Initialize metrics
  const metrics: AuditMetrics = {
    totalProcessed: 0,
    verified: 0,
    verificationFailed: 0,
    contentExtracted: 0,
    contentExtractionFailed: 0,
    apiScored: 0,
    apiScoringFailed: 0,
    saved: 0,
    denied: 0,
    contentLengths: [],
    scores: [],
    errors: [],
    extractionMethods: {},
    denialReasons: {},
    saveReasons: {}
  }

  // Mock save functions to track metrics
  let savedContentCount = 0
  const saveAsContent = async (
    url: string,
    title: string,
    content: string,
    relevanceData?: { aiScore?: number; relevanceScore?: number; isRelevant?: boolean }
  ): Promise<string | null> => {
    savedContentCount++
    metrics.saved++
    const reason = relevanceData?.aiScore
      ? `score_${relevanceData.aiScore >= 70 ? 'high' : relevanceData.aiScore >= 60 ? 'medium' : 'low'}`
      : 'unknown'
    metrics.saveReasons[reason] = (metrics.saveReasons[reason] || 0) + 1
    
    if (verbose) {
      console.log(`   ✅ SAVED: ${title}`)
      console.log(`      URL: ${url}`)
      console.log(`      Content: ${content.length} chars`)
      console.log(`      Score: ${relevanceData?.aiScore || 'N/A'}`)
    }
    
    // Actually save to database
    const { canonicalizeUrlFast } = await import('../src/lib/discovery/canonicalize')
    const canonicalUrl = canonicalizeUrlFast(url) || url
    
    const saved = await prisma.discoveredContent.create({
      data: {
        patchId: patch.id,
        title,
        summary: content.substring(0, 500),
        sourceUrl: url,
        canonicalUrl,
        domain: new URL(url).hostname,
        metadata: {
          source: 'wikipedia-citation',
          aiScore: relevanceData?.aiScore,
          relevanceScore: relevanceData?.relevanceScore,
          isRelevant: relevanceData?.isRelevant
        }
      }
    })
    
    return saved.id
  }

  const saveAsMemory = async (
    url: string,
    title: string,
    content: string,
    patchHandle: string,
    wikipediaPageTitle?: string
  ): Promise<string | null> => {
    // Track but don't actually save to agent memory in audit mode
    return null
  }

  // Process citations
  console.log('🚀 Starting citation processing audit...\n')

  let processed = 0
  let batchCount = 0

  while (processed < limit) {
    const remaining = limit - processed
    const batchLimit = Math.min(batchSize, remaining)

    console.log(`\n📦 Processing batch ${batchCount + 1} (${batchLimit} citations)...`)

    for (let i = 0; i < batchLimit; i++) {
      try {
        // Get next citation
        const citation = await getNextCitationToProcess(patch.id)
        
        if (!citation) {
          console.log('\n⚠️  No more citations available to process')
          break
        }

        metrics.totalProcessed++
        processed++

        if (verbose) {
          console.log(`\n[${processed}/${limit}] Processing: ${citation.citationUrl}`)
        } else {
          process.stdout.write(`\r   Processing ${processed}/${limit}...`)
        }

        // Process citation
        const result = await processNextCitation(patch.id, {
          patchName: patch.title,
          patchHandle: patch.handle,
          saveAsContent,
          saveAsMemory
        })

        // Track metrics based on result
        // Note: We'll need to enhance processNextCitation to return more detailed metrics
        // For now, we'll check the database state after processing

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error: any) {
        const citation = await getNextCitationToProcess(patch.id)
        metrics.errors.push({
          url: citation?.citationUrl || 'unknown',
          error: error.message,
          step: 'processing'
        })
        console.error(`\n❌ Error processing citation: ${error.message}`)
      }
    }

    batchCount++

    // Check if we should continue
    const nextCitation = await getNextCitationToProcess(patch.id)
    if (!nextCitation) {
      console.log('\n⚠️  No more citations available')
      break
    }

    // Brief pause between batches
    if (processed < limit) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }

  console.log('\n\n📊 Final Audit Results:\n')

  // Get final stats from database
  const finalStats = await prisma.wikipediaCitation.groupBy({
    by: ['scanStatus', 'relevanceDecision', 'verificationStatus'],
    where: {
      monitoring: { patchId: patch.id }
    },
    _count: true
  })

  // Calculate metrics from database
  const newlyScanned = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: 'scanned',
      updatedAt: { gte: new Date(Date.now() - 60000) } // Last minute
    }
  })

  const newlySaved = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'saved',
      updatedAt: { gte: new Date(Date.now() - 60000) } // Last minute
    }
  })

  const newlyDenied = await prisma.wikipediaCitation.count({
    where: {
      monitoring: { patchId: patch.id },
      relevanceDecision: 'denied',
      updatedAt: { gte: new Date(Date.now() - 60000) } // Last minute
    }
  })

  // Get content extraction stats
  const citationsWithContent = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: 'scanned',
      updatedAt: { gte: new Date(Date.now() - 60000) },
      contentText: { not: null }
    },
    select: {
      contentText: true,
      aiPriorityScore: true,
      relevanceDecision: true
    },
    take: 100
  })

  // Calculate content metrics
  const contentLengths = citationsWithContent
    .map(c => c.contentText?.length || 0)
    .filter(len => len > 0)
  
  const scores = citationsWithContent
    .map(c => c.aiPriorityScore)
    .filter((score): score is number => score !== null)

  // Print results
  console.log('📈 Processing Metrics:')
  console.log(`   Total Processed: ${metrics.totalProcessed}`)
  console.log(`   Newly Scanned: ${newlyScanned}`)
  console.log(`   Newly Saved: ${newlySaved}`)
  console.log(`   Newly Denied: ${newlyDenied}`)
  console.log(`   Save Rate: ${newlyScanned > 0 ? ((newlySaved / newlyScanned) * 100).toFixed(1) : 0}%`)
  console.log()

  console.log('📄 Content Extraction:')
  console.log(`   Citations with Content: ${contentLengths.length}`)
  if (contentLengths.length > 0) {
    const avgLength = contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length
    const minLength = Math.min(...contentLengths)
    const maxLength = Math.max(...contentLengths)
    console.log(`   Average Length: ${avgLength.toFixed(0)} chars`)
    console.log(`   Min Length: ${minLength} chars`)
    console.log(`   Max Length: ${maxLength} chars`)
  }
  console.log()

  console.log('🎯 AI Scoring:')
  console.log(`   Citations with Scores: ${scores.length}`)
  if (scores.length > 0) {
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const minScore = Math.min(...scores)
    const maxScore = Math.max(...scores)
    console.log(`   Average Score: ${avgScore.toFixed(1)}`)
    console.log(`   Min Score: ${minScore}`)
    console.log(`   Max Score: ${maxScore}`)
    
    const highScores = scores.filter(s => s >= 70).length
    const mediumScores = scores.filter(s => s >= 60 && s < 70).length
    const lowScores = scores.filter(s => s < 60).length
    console.log(`   High (>=70): ${highScores}`)
    console.log(`   Medium (60-69): ${mediumScores}`)
    console.log(`   Low (<60): ${lowScores}`)
  }
  console.log()

  console.log('💾 DiscoveredContent Created:')
  console.log(`   Total Saved: ${savedContentCount}`)
  console.log()

  if (metrics.errors.length > 0) {
    console.log('❌ Errors:')
    metrics.errors.forEach(err => {
      console.log(`   ${err.step}: ${err.url}`)
      console.log(`      ${err.error}`)
    })
    console.log()
  }

  // Save audit report
  const report = {
    timestamp: new Date().toISOString(),
    patch: {
      id: patch.id,
      handle: patch.handle,
      title: patch.title
    },
    metrics: {
      totalProcessed: metrics.totalProcessed,
      newlyScanned,
      newlySaved,
      newlyDenied,
      saveRate: newlyScanned > 0 ? (newlySaved / newlyScanned) * 100 : 0,
      contentExtraction: {
        citationsWithContent: contentLengths.length,
        averageLength: contentLengths.length > 0 
          ? contentLengths.reduce((a, b) => a + b, 0) / contentLengths.length 
          : 0,
        minLength: contentLengths.length > 0 ? Math.min(...contentLengths) : 0,
        maxLength: contentLengths.length > 0 ? Math.max(...contentLengths) : 0
      },
      aiScoring: {
        citationsWithScores: scores.length,
        averageScore: scores.length > 0 
          ? scores.reduce((a, b) => a + b, 0) / scores.length 
          : 0,
        minScore: scores.length > 0 ? Math.min(...scores) : 0,
        maxScore: scores.length > 0 ? Math.max(...scores) : 0,
        highScores: scores.filter(s => s >= 70).length,
        mediumScores: scores.filter(s => s >= 60 && s < 70).length,
        lowScores: scores.filter(s => s < 60).length
      },
      discoveredContentCreated: savedContentCount
    },
    errors: metrics.errors
  }

  const reportPath = `reports/discovery-audit-${patch.handle}-${Date.now()}.json`
  const fs = await import('fs')
  const path = await import('path')
  
  // Ensure reports directory exists
  const reportsDir = path.join(process.cwd(), 'reports')
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true })
  }

  fs.writeFileSync(
    path.join(process.cwd(), reportPath),
    JSON.stringify(report, null, 2)
  )

  console.log(`📄 Audit report saved: ${reportPath}`)
  console.log('\n✅ Audit complete!')
}

// Parse command line arguments
const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'
const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '50')
const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '10')
const verbose = args.includes('--verbose') || args.includes('-v')

auditCitationProcessing(patchHandle, { limit, batchSize, verbose })
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

