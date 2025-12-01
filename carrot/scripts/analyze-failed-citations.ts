/**
 * Analyze failed citation verifications
 * Run with: npx tsx scripts/analyze-failed-citations.ts chicago-bulls
 */

import { prisma } from '../src/lib/prisma'

async function analyzeFailedCitations(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, handle: true, title: true }
  })

  if (!patch) {
    console.error(`Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`\n🔍 Analyzing Failed Citations for: ${patch.title}\n`)

  // Get failed citations with error messages
  const failedCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      verificationStatus: 'failed'
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      errorMessage: true,
      updatedAt: true,
      monitoring: {
        select: {
          wikipediaTitle: true
        }
      }
    },
    orderBy: {
      updatedAt: 'desc'
    },
    take: 100 // Get more to analyze patterns
  })

  console.log(`Total failed citations: ${failedCitations.length}\n`)

  // Analyze error messages
  const errorPatterns: Record<string, number> = {}
  failedCitations.forEach(c => {
    const error = c.errorMessage || 'Unknown error'
    const pattern = error.toLowerCase()
      .replace(/\d+/g, 'N')
      .replace(/https?:\/\/[^\s]+/g, 'URL')
      .substring(0, 100)
    
    errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1
  })

  console.log('📊 Error Pattern Analysis:')
  const sortedPatterns = Object.entries(errorPatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
  
  sortedPatterns.forEach(([pattern, count]) => {
    console.log(`  ${count}x: ${pattern.substring(0, 80)}...`)
  })

  // Get last 10 failed URLs
  console.log(`\n🔗 Last 10 Failed Citation URLs:`)
  failedCitations.slice(0, 10).forEach((c, i) => {
    console.log(`\n${i + 1}. ${c.citationTitle || 'Untitled'}`)
    console.log(`   URL: ${c.citationUrl}`)
    console.log(`   Error: ${c.errorMessage || 'No error message'}`)
    console.log(`   From page: ${c.monitoring.wikipediaTitle}`)
    console.log(`   Failed at: ${c.updatedAt.toISOString()}`)
  })

  // Analyze by error type
  const httpErrors: Record<string, number> = {}
  const timeoutErrors = failedCitations.filter(c => 
    c.errorMessage?.toLowerCase().includes('timeout') || 
    c.errorMessage?.toLowerCase().includes('aborted')
  ).length
  
  const networkErrors = failedCitations.filter(c => 
    c.errorMessage?.toLowerCase().includes('network') ||
    c.errorMessage?.toLowerCase().includes('fetch') ||
    c.errorMessage?.toLowerCase().includes('connection')
  ).length

  failedCitations.forEach(c => {
    const error = c.errorMessage || ''
    const httpMatch = error.match(/HTTP (\d+)/i) || error.match(/(\d{3})/i)
    if (httpMatch) {
      const code = httpMatch[1]
      httpErrors[code] = (httpErrors[code] || 0) + 1
    }
  })

  console.log(`\n📈 Error Breakdown:`)
  console.log(`  Timeout errors: ${timeoutErrors}`)
  console.log(`  Network errors: ${networkErrors}`)
  console.log(`  HTTP status errors:`)
  Object.entries(httpErrors)
    .sort((a, b) => b[1] - a[1])
    .forEach(([code, count]) => {
      console.log(`    ${code}: ${count}`)
    })

  // Check URL patterns
  const urlPatterns: Record<string, number> = {}
  failedCitations.forEach(c => {
    try {
      const url = new URL(c.citationUrl.startsWith('http') ? c.citationUrl : `https://${c.citationUrl}`)
      const domain = url.hostname.replace('www.', '')
      urlPatterns[domain] = (urlPatterns[domain] || 0) + 1
    } catch {
      urlPatterns['invalid_url'] = (urlPatterns['invalid_url'] || 0) + 1
    }
  })

  console.log(`\n🌐 Top Failing Domains:`)
  Object.entries(urlPatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([domain, count]) => {
      console.log(`  ${domain}: ${count} failures`)
    })

  await prisma.$disconnect()
}

const patchHandle = process.argv[2]
if (!patchHandle) {
  console.error('Usage: npx tsx scripts/analyze-failed-citations.ts [patchHandle]')
  process.exit(1)
}

analyzeFailedCitations(patchHandle).catch(console.error)

