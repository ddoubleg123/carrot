/**
 * Find external (non-Wikipedia) failed citation URLs
 * Run with: npx tsx scripts/find-external-failures.ts chicago-bulls
 */

import { prisma } from '../src/lib/prisma'

async function findExternalFailures(patchHandle: string) {
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, handle: true, title: true }
  })

  if (!patch) {
    console.error(`Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  console.log(`\n🔍 Finding External Failed Citations for: ${patch.title}\n`)

  // Get failed citations
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
    take: 200 // Get more to filter out Wikipedia links
  })

  // Filter out Wikipedia links (relative or absolute)
  const externalFailures = failedCitations.filter(c => {
    const url = c.citationUrl.toLowerCase()
    return !url.startsWith('./') && 
           !url.startsWith('../') && 
           !url.includes('wikipedia.org') &&
           !url.startsWith('wikipedia:')
  })

  console.log(`Total failed citations: ${failedCitations.length}`)
  console.log(`External (non-Wikipedia) failures: ${externalFailures.length}\n`)

  if (externalFailures.length === 0) {
    console.log('✅ No external failures found - all failures are Wikipedia internal links')
    await prisma.$disconnect()
    return
  }

  console.log('🔗 Last 10 External Failed Citation URLs:\n')
  externalFailures.slice(0, 10).forEach((c, i) => {
    console.log(`${i + 1}. ${c.citationTitle || 'Untitled'}`)
    console.log(`   URL: ${c.citationUrl}`)
    console.log(`   Error: ${c.errorMessage || 'No error message'}`)
    console.log(`   From Wikipedia page: ${c.monitoring.wikipediaTitle}`)
    console.log(`   Failed at: ${c.updatedAt.toISOString()}\n`)
  })

  // Analyze error patterns for external URLs
  const errorPatterns: Record<string, number> = {}
  externalFailures.forEach(c => {
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
  externalFailures.forEach(c => {
    try {
      const url = new URL(c.citationUrl.startsWith('http') ? c.citationUrl : `https://${c.citationUrl}`)
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

  await prisma.$disconnect()
}

const patchHandle = process.argv[2]
if (!patchHandle) {
  console.error('Usage: npx tsx scripts/find-external-failures.ts [patchHandle]')
  process.exit(1)
}

findExternalFailures(patchHandle).catch(console.error)

