/**
 * Full audit of Wikipedia discovery process
 * Checks each step to identify where the process is failing
 * Run with: npx tsx scripts/audit-wikipedia-discovery.ts [patch-handle]
 */

import { prisma } from '../src/lib/prisma'
import { getWikipediaMonitoringStatus } from '../src/lib/discovery/wikipediaMetrics'

interface AuditResult {
  step: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: any
}

async function auditWikipediaDiscovery(patchHandle?: string) {
  console.log('🔍 Wikipedia Discovery Audit\n')
  console.log('=' .repeat(60))

  const results: AuditResult[] = []

  try {
    // Find patch
    let patch
    if (patchHandle) {
      patch = await prisma.patch.findUnique({
        where: { handle: patchHandle },
        select: { id: true, handle: true, title: true, entity: true, tags: true, createdAt: true }
      })
    } else {
      patch = await prisma.patch.findFirst({
        select: { id: true, handle: true, title: true, entity: true, tags: true, createdAt: true }
      })
    }

    if (!patch) {
      console.error('❌ No patch found')
      process.exit(1)
    }

    console.log(`\n📋 Patch: ${patch.handle} (${patch.title})`)
    console.log(`   Created: ${patch.createdAt.toISOString()}\n`)

    // Step 1: Check if Wikipedia monitoring was initialized
    console.log('Step 1: Checking Wikipedia monitoring initialization...')
    const monitoringCount = await prisma.wikipediaMonitoring.count({
      where: { patchId: patch.id }
    })
    
    if (monitoringCount === 0) {
      results.push({
        step: 'Initialization',
        status: 'fail',
        message: 'No Wikipedia pages found in monitoring table',
        details: { patchId: patch.id }
      })
      console.log('   ❌ FAIL: No Wikipedia pages in database')
      console.log('   → Wikipedia monitoring was never initialized for this patch')
      console.log('   → Solution: Run trigger-wikipedia-init.ts or create a new patch')
    } else {
      results.push({
        step: 'Initialization',
        status: 'pass',
        message: `Found ${monitoringCount} Wikipedia pages`,
        details: { count: monitoringCount }
      })
      console.log(`   ✅ PASS: Found ${monitoringCount} Wikipedia pages\n`)
    }

    // Step 2: Check page statuses
    if (monitoringCount > 0) {
      console.log('Step 2: Checking page processing status...')
      const pageStatuses = await prisma.wikipediaMonitoring.groupBy({
        by: ['status'],
        where: { patchId: patch.id },
        _count: true
      })

      const statusMap = new Map(pageStatuses.map(s => [s.status, s._count]))
      const pending = statusMap.get('pending') || 0
      const scanning = statusMap.get('scanning') || 0
      const completed = statusMap.get('completed') || 0
      const error = statusMap.get('error') || 0

      console.log(`   Pending: ${pending}`)
      console.log(`   Scanning: ${scanning}`)
      console.log(`   Completed: ${completed}`)
      console.log(`   Error: ${error}`)

      if (pending === monitoringCount) {
        results.push({
          step: 'Page Processing',
          status: 'warning',
          message: 'All pages are still pending - processing has not started',
          details: { pending, total: monitoringCount }
        })
        console.log('   ⚠️  WARNING: No pages have been processed yet\n')
      } else if (completed === 0 && error === 0) {
        results.push({
          step: 'Page Processing',
          status: 'warning',
          message: 'Pages are being processed but none completed',
          details: { pending, scanning, completed }
        })
        console.log('   ⚠️  WARNING: Processing in progress but no completions\n')
      } else {
        results.push({
          step: 'Page Processing',
          status: 'pass',
          message: `Processing active: ${completed} completed, ${scanning} in progress`,
          details: { pending, scanning, completed, error }
        })
        console.log('   ✅ PASS: Pages are being processed\n')
      }
    }

    // Step 3: Check citations
    if (monitoringCount > 0) {
      console.log('Step 3: Checking citation extraction...')
      const citationCount = await prisma.wikipediaCitation.count({
        where: {
          monitoring: { patchId: patch.id }
        }
      })

      if (citationCount === 0) {
        results.push({
          step: 'Citation Extraction',
          status: 'fail',
          message: 'No citations extracted from Wikipedia pages',
          details: { pages: monitoringCount }
        })
        console.log('   ❌ FAIL: No citations found')
        console.log('   → Citations have not been extracted from Wikipedia pages')
        console.log('   → Check if pages have been scanned and citations extracted\n')
      } else {
        results.push({
          step: 'Citation Extraction',
          status: 'pass',
          message: `Found ${citationCount} citations`,
          details: { count: citationCount }
        })
        console.log(`   ✅ PASS: Found ${citationCount} citations\n`)

        // Check citation statuses
        const citationStatuses = await prisma.wikipediaCitation.groupBy({
          by: ['verificationStatus', 'scanStatus'],
          where: {
            monitoring: { patchId: patch.id }
          },
          _count: true
        })

        console.log('   Citation Status Breakdown:')
        citationStatuses.forEach(s => {
          console.log(`     ${s.verificationStatus}/${s.scanStatus}: ${s._count}`)
        })

        const pendingCitations = await prisma.wikipediaCitation.count({
          where: {
            monitoring: { patchId: patch.id },
            verificationStatus: 'pending',
            scanStatus: 'not_scanned'
          }
        })

        const savedCitations = await prisma.wikipediaCitation.count({
          where: {
            monitoring: { patchId: patch.id },
            relevanceDecision: 'saved'
          }
        })

        console.log(`\n   Pending citations: ${pendingCitations}`)
        console.log(`   Saved citations: ${savedCitations}`)

        if (pendingCitations === citationCount && savedCitations === 0) {
          results.push({
            step: 'Citation Processing',
            status: 'fail',
            message: 'All citations are pending - incremental processing not running',
            details: { pending: pendingCitations, saved: savedCitations }
          })
          console.log('   ❌ FAIL: Citations are not being processed\n')
        } else if (savedCitations === 0) {
          results.push({
            step: 'Citation Processing',
            status: 'warning',
            message: 'Citations being processed but none saved yet',
            details: { pending: pendingCitations, saved: savedCitations }
          })
          console.log('   ⚠️  WARNING: Processing but no saves yet\n')
        } else {
          results.push({
            step: 'Citation Processing',
            status: 'pass',
            message: `Processing working: ${savedCitations} saved`,
            details: { pending: pendingCitations, saved: savedCitations }
          })
          console.log('   ✅ PASS: Citations are being processed and saved\n')
        }
      }
    }

    // Step 4: Check if incremental processing is configured
    console.log('Step 4: Checking discovery engine integration...')
    const recentRuns = await prisma.discoveryRun.findMany({
      where: { patchId: patch.id },
      orderBy: { startedAt: 'desc' },
      take: 1,
      select: { id: true, status: true, startedAt: true }
    })

    if (recentRuns.length === 0) {
      results.push({
        step: 'Discovery Integration',
        status: 'warning',
        message: 'No discovery runs found',
        details: {}
      })
      console.log('   ⚠️  WARNING: No discovery runs found')
      console.log('   → Start a discovery run to trigger Wikipedia processing\n')
    } else {
      const lastRun = recentRuns[0]
      results.push({
        step: 'Discovery Integration',
        status: 'pass',
        message: `Last run: ${lastRun.status} at ${lastRun.startedAt?.toISOString() || 'unknown'}`,
        details: { runId: lastRun.id, status: lastRun.status }
      })
      console.log(`   ✅ PASS: Discovery runs exist`)
      console.log(`   Last run: ${lastRun.status} (${lastRun.startedAt?.toISOString() || 'unknown'})\n`)
    }

    // Step 5: Check saved content
    console.log('Step 5: Checking saved content...')
    // Check via WikipediaCitation -> savedContentId relationship
    const savedFromCitations = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId: patch.id },
        savedContentId: { not: null }
      }
    })

    const savedToMemory = await prisma.wikipediaCitation.count({
      where: {
        monitoring: { patchId: patch.id },
        savedMemoryId: { not: null }
      }
    })

    console.log(`   Saved to DiscoveredContent: ${savedFromCitations}`)
    console.log(`   Saved to AgentMemory: ${savedToMemory}`)

    if (savedFromCitations === 0 && savedToMemory === 0) {
      results.push({
        step: 'Content Saving',
        status: 'fail',
        message: 'No content saved from Wikipedia citations',
        details: { discoveredContent: savedFromCitations, agentMemory: savedToMemory }
      })
      console.log('   ❌ FAIL: No content has been saved\n')
    } else {
      results.push({
        step: 'Content Saving',
        status: 'pass',
        message: `Content saved: ${savedFromCitations} to content, ${savedToMemory} to memory`,
        details: { discoveredContent: savedFromCitations, agentMemory: savedToMemory }
      })
      console.log('   ✅ PASS: Content is being saved\n')
    }

    // Step 6: Get full status
    console.log('Step 6: Overall status summary...')
    const status = await getWikipediaMonitoringStatus(patch.id)
    console.log(`   Total pages: ${status.totalPages}`)
    console.log(`   Scanned pages: ${status.scannedPages}`)
    console.log(`   Total citations: ${status.totalCitations}`)
    console.log(`   Processed citations: ${status.processedCitations}`)
    console.log(`   Saved citations: ${status.savedCitations}`)
    console.log(`   Average priority: ${status.averagePriorityScore?.toFixed(1) || 'N/A'}\n`)

    // Summary
    console.log('=' .repeat(60))
    console.log('\n📊 Audit Summary\n')

    const passed = results.filter(r => r.status === 'pass').length
    const warnings = results.filter(r => r.status === 'warning').length
    const failed = results.filter(r => r.status === 'fail').length

    console.log(`✅ Passed: ${passed}`)
    console.log(`⚠️  Warnings: ${warnings}`)
    console.log(`❌ Failed: ${failed}\n`)

    results.forEach(result => {
      const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
      console.log(`${icon} ${result.step}: ${result.message}`)
      if (result.details) {
        console.log(`   Details:`, result.details)
      }
    })

    // Recommendations
    console.log('\n' + '=' .repeat(60))
    console.log('\n💡 Recommendations\n')

    if (monitoringCount === 0) {
      console.log('1. Initialize Wikipedia monitoring:')
      console.log('   npx tsx scripts/trigger-wikipedia-init.ts ' + patch.handle)
    }

    const citationCount = status.totalCitations || 0
    const savedCitations = status.savedCitations || 0

    if (monitoringCount > 0 && citationCount === 0) {
      console.log('2. Citations not extracted - check if pages are being scanned')
      console.log('   Run discovery to trigger page processing')
    }

    if (citationCount > 0 && savedCitations === 0) {
      console.log('3. Citations exist but not being saved:')
      console.log('   - Check if incremental processing is running in discovery loop')
      console.log('   - Verify prioritizeCitations function is working')
      console.log('   - Check if saveAsContent/saveAsMemory functions are called')
    }

    if (failed === 0 && warnings === 0) {
      console.log('✅ All systems operational!')
    }

    process.exit(failed > 0 ? 1 : 0)

  } catch (error: any) {
    console.error('\n❌ Audit failed:', error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

const patchHandle = process.argv[2]
auditWikipediaDiscovery(patchHandle).catch(console.error)

