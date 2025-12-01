/**
 * Find all external (non-Wikipedia) citations and their status
 * Run with: npx tsx scripts/find-external-citations.ts chicago-bulls
 */

import { prisma } from '../src/lib/prisma'

async function findExternalCitations(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, handle: true, title: true }
  })

  if (!patch) {
    console.error(`Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`\n🔍 Finding External Citations for: ${patch.title}\n`)

  // Get all citations
  const allCitations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id }
    },
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      verificationStatus: true,
      scanStatus: true,
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
    }
  })

  // Filter for external (non-Wikipedia) links
  const externalCitations = allCitations.filter(c => {
    const url = c.citationUrl.toLowerCase()
    return !url.startsWith('./') && 
           !url.startsWith('../') && 
           !url.includes('wikipedia.org') &&
           !url.startsWith('wikipedia:') &&
           (url.startsWith('http://') || url.startsWith('https://'))
  })

  console.log(`Total citations: ${allCitations.length}`)
  console.log(`External (non-Wikipedia) citations: ${externalCitations.length}\n`)

  // Separate by status
  const failed = externalCitations.filter(c => c.verificationStatus === 'failed')
  const verified = externalCitations.filter(c => c.verificationStatus === 'verified')
  const pending = externalCitations.filter(c => c.verificationStatus === 'pending')

  console.log(`Status breakdown:`)
  console.log(`  Failed: ${failed.length}`)
  console.log(`  Verified: ${verified.length}`)
  console.log(`  Pending: ${pending.length}\n`)

  if (failed.length > 0) {
    console.log('🔗 Last 10 Failed External Citation URLs:\n')
    failed.slice(0, 10).forEach((c, i) => {
      console.log(`${i + 1}. ${c.citationTitle || 'Untitled'}`)
      console.log(`   URL: ${c.citationUrl}`)
      console.log(`   Error: ${c.errorMessage || 'No error message'}`)
      console.log(`   From Wikipedia page: ${c.monitoring.wikipediaTitle}`)
      console.log(`   Failed at: ${c.updatedAt.toISOString()}\n`)
    })
  } else {
    console.log('✅ No external failures found\n')
  }

  // Show some verified external URLs too
  if (verified.length > 0) {
    console.log(`\n✅ Sample Verified External Citations (${verified.length} total):\n`)
    verified.slice(0, 5).forEach((c, i) => {
      console.log(`${i + 1}. ${c.citationTitle || 'Untitled'}`)
      console.log(`   URL: ${c.citationUrl}`)
      console.log(`   Status: ${c.verificationStatus}/${c.scanStatus}`)
      console.log(`   From Wikipedia page: ${c.monitoring.wikipediaTitle}\n`)
    })
  }

  // Analyze error patterns for external failures
  if (failed.length > 0) {
    const errorPatterns: Record<string, number> = {}
    failed.forEach(c => {
      const error = c.errorMessage || 'Unknown error'
      const pattern = error.toLowerCase()
        .replace(/\d+/g, 'N')
        .replace(/https?:\/\/[^\s]+/g, 'URL')
        .substring(0, 100)
      
      errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1
    })

    console.log('\n📊 External Failure Error Patterns:')
    Object.entries(errorPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([pattern, count]) => {
        console.log(`  ${count}x: ${pattern.substring(0, 80)}...`)
      })

    // Analyze by domain
    const domainPatterns: Record<string, number> = {}
    failed.forEach(c => {
      try {
        const url = new URL(c.citationUrl)
        const domain = url.hostname.replace('www.', '')
        domainPatterns[domain] = (domainPatterns[domain] || 0) + 1
      } catch {
        domainPatterns['invalid_url'] = (domainPatterns['invalid_url'] || 0) + 1
      }
    })

    console.log('\n🌐 Top Failing External Domains:')
    Object.entries(domainPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([domain, count]) => {
        console.log(`  ${domain}: ${count} failures`)
      })
  }

  await prisma.$disconnect()
}

const patchHandle = process.argv[2]
if (!patchHandle) {
  console.error('Usage: npx tsx scripts/find-external-citations.ts [patchHandle]')
  process.exit(1)
}

findExternalCitations(patchHandle).catch(console.error)

