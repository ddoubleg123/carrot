#!/usr/bin/env tsx
/**
 * Comprehensive Citation Audit
 * 
 * Processes ALL unsaved/unprocessed citations and identifies issues in the flow
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { processNextCitation } from '../src/lib/discovery/wikipediaProcessor'
import { canonicalizeUrlFast } from '../src/lib/discovery/canonicalize'

const prisma = new PrismaClient()

interface AuditMetrics {
  total: number
  processed: number
  saved: number
  denied: number
  failed: number
  
  // Verification issues
  verificationFailed: number
  verificationErrors: Record<string, number>
  
  // Content extraction issues
  noContent: number
  shortContent: number
  contentExtractionErrors: number
  
  // AI scoring issues
  noAIScore: number
  lowAIScore: number
  highAIScore: number
  
  // Save issues
  saveErrors: number
  saveErrorTypes: Record<string, number>
  
  // URL quality issues
  lowQualityUrls: number
  lowQualityUrlTypes: Record<string, number>
  
  // Other issues
  otherErrors: number
  errorDetails: Array<{ url: string; error: string }>
}

async function comprehensiveAudit(patchHandle: string, options: {
  limit?: number
  batchSize?: number
  verbose?: boolean
} = {}) {
  const { limit = 1000, batchSize = 50, verbose = false } = options

  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true, handle: true }
  })

  if (!patch) {
    console.error(`❌ Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`🔍 Comprehensive Citation Audit for: ${patch.title}\n`)
  console.log(`   Limit: ${limit}`)
  console.log(`   Batch Size: ${batchSize}\n`)

  // Find all unsaved/unprocessed citations
  const unsavedCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      OR: [
        { relevanceDecision: null }, // Not decided yet
        { relevanceDecision: 'denied' }, // Denied but might need reprocessing
        { scanStatus: { in: ['not_scanned', 'scanning'] } } // Not scanned yet
      ],
      citationUrl: {
        startsWith: 'http'
      },
      NOT: [
        { citationUrl: { contains: 'wikipedia.org' } },
        { citationUrl: { contains: 'wikimedia.org' } },
        { citationUrl: { contains: 'wikidata.org' } }
      ]
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      verificationStatus: true,
      scanStatus: true,
      relevanceDecision: true,
      aiPriorityScore: true,
      contentText: true,
      errorMessage: true
    },
    take: limit
  })

  console.log(`Found ${unsavedCitations.length} unsaved/unprocessed citations\n`)

  if (unsavedCitations.length === 0) {
    console.log('✅ No citations to audit')
    await prisma.$disconnect()
    return
  }

  const metrics: AuditMetrics = {
    total: unsavedCitations.length,
    processed: 0,
    saved: 0,
    denied: 0,
    failed: 0,
    verificationFailed: 0,
    verificationErrors: {},
    noContent: 0,
    shortContent: 0,
    contentExtractionErrors: 0,
    noAIScore: 0,
    lowAIScore: 0,
    highAIScore: 0,
    saveErrors: 0,
    saveErrorTypes: {},
    lowQualityUrls: 0,
    lowQualityUrlTypes: {},
    otherErrors: 0,
    errorDetails: []
  }

  // Save function
  const saveAsContent = async (
    url: string,
    title: string,
    content: string,
    relevanceData?: { aiScore?: number; relevanceScore?: number; isRelevant?: boolean }
  ): Promise<string | null> => {
    try {
      const canonicalUrl = canonicalizeUrlFast(url) || url
      
      // Check for duplicates
      const existing = await prisma.discoveredContent.findFirst({
        where: {
          patchId: patch.id,
          OR: [
            { canonicalUrl },
            { sourceUrl: url }
          ]
        },
        select: { id: true }
      })

      if (existing) {
        return existing.id
      }

      const saved = await prisma.discoveredContent.create({
        data: {
          patchId: patch.id,
          title,
          summary: content.substring(0, 500),
          sourceUrl: url,
          canonicalUrl,
          domain: new URL(url).hostname,
          type: 'article',
          content: content, // Required by database (legacy field)
          textContent: content, // New field for full text
          metadata: {
            source: 'wikipedia-citation',
            aiScore: relevanceData?.aiScore,
            relevanceScore: relevanceData?.relevanceScore,
            isRelevant: relevanceData?.isRelevant
          }
        }
      })

      return saved.id
    } catch (error: any) {
      metrics.saveErrors++
      const errorType = error.code || error.message?.substring(0, 50) || 'unknown'
      metrics.saveErrorTypes[errorType] = (metrics.saveErrorTypes[errorType] || 0) + 1
      metrics.errorDetails.push({ url, error: error.message || String(error) })
      if (verbose) {
        console.error(`   ❌ Save error: ${error.message}`)
      }
      return null
    }
  }

  const saveAsMemory = async (
    url: string,
    title: string,
    content: string,
    patchHandle: string,
    wikipediaPageTitle?: string
  ): Promise<string | null> => {
    return null // Don't save to agent memory in audit
  }

  // Process citations in batches
  console.log('🚀 Processing citations...\n')

  for (let i = 0; i < unsavedCitations.length; i++) {
    const citation = unsavedCitations[i]
    
    if (i > 0 && i % batchSize === 0) {
      const progress = ((i / unsavedCitations.length) * 100).toFixed(1)
      console.log(`\n📊 Progress: ${i}/${unsavedCitations.length} (${progress}%)`)
      console.log(`   Saved: ${metrics.saved}, Denied: ${metrics.denied}, Failed: ${metrics.failed}`)
    }

    try {
      if (verbose && i < 10) {
        console.log(`\n[${i + 1}] Processing: ${citation.citationUrl.substring(0, 80)}...`)
      }

      // Check if it's a low-quality URL before processing
      const isLowQuality = isLowQualityUrl(citation.citationUrl)
      if (isLowQuality) {
        metrics.lowQualityUrls++
        const urlType = getLowQualityUrlType(citation.citationUrl)
        metrics.lowQualityUrlTypes[urlType] = (metrics.lowQualityUrlTypes[urlType] || 0) + 1
        metrics.denied++
        metrics.processed++
        continue
      }

      const result = await processNextCitation(patch.id, {
        patchName: patch.title,
        patchHandle: patch.handle,
        saveAsContent,
        saveAsMemory
      })

      metrics.processed++

      if (result.saved) {
        metrics.saved++
      } else {
        metrics.denied++
      }

      // Get updated citation to check for issues
      const updated = await prisma.wikipediaCitation.findUnique({
        where: { id: citation.id },
        select: {
          verificationStatus: true,
          scanStatus: true,
          relevanceDecision: true,
          aiPriorityScore: true,
          contentText: true,
          errorMessage: true
        }
      })

      if (updated) {
        // Track verification issues
        if (updated.verificationStatus === 'failed') {
          metrics.verificationFailed++
          const error = updated.errorMessage || 'unknown'
          const errorType = error.split(':')[0] || error.substring(0, 50)
          metrics.verificationErrors[errorType] = (metrics.verificationErrors[errorType] || 0) + 1
        }

        // Track content extraction issues
        if (updated.scanStatus === 'scanned' || updated.scanStatus === 'scanned_denied') {
          if (!updated.contentText || updated.contentText.length === 0) {
            metrics.noContent++
          } else if (updated.contentText.length < 500) {
            metrics.shortContent++
          }
        }

        // Track AI scoring issues
        if (updated.aiPriorityScore === null) {
          metrics.noAIScore++
        } else if (updated.aiPriorityScore < 60) {
          metrics.lowAIScore++
        } else if (updated.aiPriorityScore >= 70) {
          metrics.highAIScore++
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))

    } catch (error: any) {
      metrics.failed++
      metrics.otherErrors++
      metrics.errorDetails.push({
        url: citation.citationUrl,
        error: error.message || String(error)
      })
      
      if (verbose) {
        console.error(`   ❌ Error processing ${citation.citationUrl}: ${error.message}`)
      }
    }
  }

  // Print comprehensive report
  console.log(`\n\n📊 COMPREHENSIVE AUDIT RESULTS\n`)
  console.log(`═`.repeat(60))
  
  console.log(`\n📈 Processing Summary:`)
  console.log(`   Total Citations: ${metrics.total}`)
  console.log(`   Processed: ${metrics.processed} (${(metrics.processed / metrics.total * 100).toFixed(1)}%)`)
  console.log(`   Saved: ${metrics.saved} (${(metrics.saved / metrics.total * 100).toFixed(1)}%)`)
  console.log(`   Denied: ${metrics.denied} (${(metrics.denied / metrics.total * 100).toFixed(1)}%)`)
  console.log(`   Failed: ${metrics.failed} (${(metrics.failed / metrics.total * 100).toFixed(1)}%)`)
  console.log(`   Save Rate: ${metrics.processed > 0 ? (metrics.saved / metrics.processed * 100).toFixed(1) : 0}%`)

  console.log(`\n🔍 Verification Issues:`)
  console.log(`   Failed Verifications: ${metrics.verificationFailed}`)
  if (Object.keys(metrics.verificationErrors).length > 0) {
    console.log(`   Error Types:`)
    Object.entries(metrics.verificationErrors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([error, count]) => {
        console.log(`      ${error}: ${count}`)
      })
  }

  console.log(`\n📄 Content Extraction Issues:`)
  console.log(`   No Content: ${metrics.noContent}`)
  console.log(`   Short Content (<500 chars): ${metrics.shortContent}`)
  console.log(`   Content Extraction Errors: ${metrics.contentExtractionErrors}`)

  console.log(`\n🤖 AI Scoring Issues:`)
  console.log(`   No AI Score: ${metrics.noAIScore}`)
  console.log(`   Low Score (<60): ${metrics.lowAIScore}`)
  console.log(`   High Score (>=70): ${metrics.highAIScore}`)

  console.log(`\n💾 Save Issues:`)
  console.log(`   Save Errors: ${metrics.saveErrors}`)
  if (Object.keys(metrics.saveErrorTypes).length > 0) {
    console.log(`   Error Types:`)
    Object.entries(metrics.saveErrorTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([error, count]) => {
        console.log(`      ${error}: ${count}`)
      })
  }

  console.log(`\n🚫 Low-Quality URLs:`)
  console.log(`   Total Filtered: ${metrics.lowQualityUrls}`)
  if (Object.keys(metrics.lowQualityUrlTypes).length > 0) {
    console.log(`   URL Types:`)
    Object.entries(metrics.lowQualityUrlTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`      ${type}: ${count}`)
      })
  }

  console.log(`\n❌ Other Errors:`)
  console.log(`   Total: ${metrics.otherErrors}`)
  if (metrics.errorDetails.length > 0 && verbose) {
    console.log(`   Sample Errors:`)
    metrics.errorDetails.slice(0, 10).forEach(({ url, error }) => {
      console.log(`      ${url.substring(0, 60)}...: ${error.substring(0, 100)}`)
    })
  }

  // Identify issues
  console.log(`\n\n🔧 IDENTIFIED ISSUES\n`)
  console.log(`═`.repeat(60))

  const issues: string[] = []

  if (metrics.verificationFailed > metrics.total * 0.3) {
    issues.push(`⚠️  HIGH: ${metrics.verificationFailed} citations failed verification (${(metrics.verificationFailed / metrics.total * 100).toFixed(1)}%)`)
  }

  if (metrics.noContent > metrics.total * 0.2) {
    issues.push(`⚠️  HIGH: ${metrics.noContent} citations have no content extracted (${(metrics.noContent / metrics.total * 100).toFixed(1)}%)`)
  }

  if (metrics.noAIScore > metrics.total * 0.2) {
    issues.push(`⚠️  HIGH: ${metrics.noAIScore} citations have no AI score (${(metrics.noAIScore / metrics.total * 100).toFixed(1)}%)`)
  }

  if (metrics.saveErrors > 0) {
    issues.push(`⚠️  MEDIUM: ${metrics.saveErrors} citations failed to save to DiscoveredContent`)
  }

  if (metrics.lowQualityUrls > metrics.total * 0.5) {
    issues.push(`ℹ️  INFO: ${metrics.lowQualityUrls} citations filtered as low-quality URLs (${(metrics.lowQualityUrls / metrics.total * 100).toFixed(1)}%)`)
  }

  if (metrics.saved / metrics.processed < 0.1 && metrics.processed > 10) {
    issues.push(`⚠️  HIGH: Save rate is very low (${(metrics.saved / metrics.processed * 100).toFixed(1)}%) - investigate relevance logic`)
  }

  if (issues.length === 0) {
    console.log(`✅ No major issues identified`)
  } else {
    issues.forEach(issue => console.log(issue))
  }

  await prisma.$disconnect()
}

function isLowQualityUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.replace(/^www\./, '')
    const pathname = urlObj.pathname.toLowerCase()

    const lowQualityDomains = [
      'viaf.org',
      'id.loc.gov',
      'id.ndl.go.jp',
      'nli.org.il',
      'collections.yale.edu',
      'web.archive.org',
      'commons.wikimedia.org',
      'upload.wikimedia.org',
      'wikidata.org',
    ]

    if (lowQualityDomains.some(domain => hostname.includes(domain))) {
      return true
    }

    const lowQualityPatterns = [
      /\/authorities\//,
      /\/viaf\//,
      /\/auth\//,
      /\/catalog\//,
      /\/authority\//,
      /\/authority-control/,
      /\/bibliographic/,
      /\/metadata/,
      /\/record\//,
      /\/item\//,
    ]

    if (lowQualityPatterns.some(pattern => pattern.test(pathname))) {
      return true
    }

    return false
  } catch (error) {
    return false
  }
}

function getLowQualityUrlType(url: string): string {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.replace(/^www\./, '')
    const pathname = urlObj.pathname.toLowerCase()

    if (hostname.includes('viaf.org')) return 'VIAF'
    if (hostname.includes('id.loc.gov')) return 'Library of Congress'
    if (hostname.includes('nli.org.il')) return 'National Library of Israel'
    if (hostname.includes('collections.yale.edu')) return 'Yale Collections'
    if (pathname.includes('/authorities/')) return 'Authority File'
    if (pathname.includes('/catalog/')) return 'Catalog'
    if (pathname.includes('/metadata/')) return 'Metadata'
    
    return 'Other'
  } catch (error) {
    return 'Unknown'
  }
}

const args = process.argv.slice(2)
const patchHandle = args.find(arg => arg.startsWith('--patch='))?.split('=')[1] || 'israel'
const limit = parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '1000')
const batchSize = parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '50')
const verbose = args.includes('--verbose')

comprehensiveAudit(patchHandle, { limit, batchSize, verbose })
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

