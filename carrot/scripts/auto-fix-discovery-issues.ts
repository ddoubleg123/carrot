/**
 * Auto-Fix Discovery Issues
 * 
 * Periodically checks for discovery issues and automatically fixes them:
 * 1. Citations with score >= 50 that weren't saved (should be saved)
 * 2. Saved content without AgentMemory (should have memories)
 * 3. Citations stuck in 'scanning' status
 * 4. Other common issues
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

interface Issue {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  count: number
  description: string
  fixable: boolean
}

interface FixResult {
  issueType: string
  fixed: number
  failed: number
  errors: string[]
}

/**
 * Detect all discovery issues
 */
async function detectIssues(patchId?: string): Promise<Issue[]> {
  const issues: Issue[] = []

  // Issue 1: Citations with score >= 50 that weren't saved
  const unsavedHighScore = await prisma.wikipediaCitation.count({
    where: {
      ...(patchId ? { monitoring: { patchId } } : {}),
      aiPriorityScore: { gte: 50 },
      OR: [
        { relevanceDecision: { not: 'saved' } },
        { savedContentId: null },
        { relevanceDecision: null }
      ]
    }
  })

  if (unsavedHighScore > 0) {
    issues.push({
      type: 'unsaved_high_score_citations',
      severity: unsavedHighScore > 100 ? 'high' : unsavedHighScore > 50 ? 'medium' : 'low',
      count: unsavedHighScore,
      description: `${unsavedHighScore} citations with score >= 50 were not saved`,
      fixable: true
    })
  }

  // Issue 2: Saved content without AgentMemory
  const savedContent = await prisma.discoveredContent.findMany({
    where: {
      ...(patchId ? { patchId } : {}),
      // Exclude content that's already in queue or has memory
    },
    select: {
      id: true,
      patchId: true
    }
  })

  if (savedContent.length > 0) {
    const contentIds = savedContent.map(c => c.id)
    
    // Check which ones have memories
    const withMemories = await prisma.agentMemory.findMany({
      where: {
        discoveredContentId: { in: contentIds }
      },
      select: {
        discoveredContentId: true
      }
    })

    const memoryIds = new Set(withMemories.map(m => m.discoveredContentId).filter(Boolean))
    const withoutMemories = contentIds.filter(id => !memoryIds.has(id))

    // Check which ones are in queue
    const inQueue = await (prisma as any).agentMemoryFeedQueue.findMany({
      where: {
        discoveredContentId: { in: withoutMemories }
      },
      select: {
        discoveredContentId: true
      }
    })

    const queueIds = new Set(inQueue.map((q: any) => q.discoveredContentId).filter(Boolean))
    const missingMemories = withoutMemories.filter(id => !queueIds.has(id))

    if (missingMemories.length > 0) {
      issues.push({
        type: 'missing_agent_memories',
        severity: missingMemories.length > 50 ? 'medium' : 'low',
        count: missingMemories.length,
        description: `${missingMemories.length} saved content items missing AgentMemory (not in queue)`,
        fixable: true
      })
    }
  }

  // Issue 3: Citations stuck in 'scanning' status for > 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const stuckScanning = await prisma.wikipediaCitation.count({
    where: {
      ...(patchId ? { monitoring: { patchId } } : {}),
      scanStatus: 'scanning',
      updatedAt: { lt: oneHourAgo }
    }
  })

  if (stuckScanning > 0) {
    issues.push({
      type: 'stuck_scanning_citations',
      severity: stuckScanning > 10 ? 'medium' : 'low',
      count: stuckScanning,
      description: `${stuckScanning} citations stuck in 'scanning' status for > 1 hour`,
      fixable: true
    })
  }

  // Issue 4: Queue items stuck in PROCESSING for > 1 hour
  const stuckProcessing = await (prisma as any).agentMemoryFeedQueue.count({
    where: {
      ...(patchId ? { patchId } : {}),
      status: 'PROCESSING',
      pickedAt: { lt: oneHourAgo }
    }
  })

  if (stuckProcessing > 0) {
    issues.push({
      type: 'stuck_processing_queue',
      severity: stuckProcessing > 5 ? 'medium' : 'low',
      count: stuckProcessing,
      description: `${stuckProcessing} queue items stuck in PROCESSING for > 1 hour`,
      fixable: true
    })
  }

  return issues
}

/**
 * Fix an issue
 */
async function fixIssue(issue: Issue, patchId?: string): Promise<FixResult> {
  const result: FixResult = {
    issueType: issue.type,
    fixed: 0,
    failed: 0,
    errors: []
  }

  try {
    switch (issue.type) {
      case 'unsaved_high_score_citations':
        // Reset citations to allow re-processing
        const citations = await prisma.wikipediaCitation.findMany({
          where: {
            ...(patchId ? { monitoring: { patchId } } : {}),
            aiPriorityScore: { gte: 50 },
            OR: [
              { relevanceDecision: { not: 'saved' } },
              { savedContentId: null },
              { relevanceDecision: null }
            ]
          },
          select: { id: true },
          take: 100 // Fix in batches
        })

        for (const citation of citations) {
          try {
            await prisma.wikipediaCitation.update({
              where: { id: citation.id },
              data: {
                scanStatus: 'not_scanned',
                relevanceDecision: null,
                savedContentId: null
              }
            })
            result.fixed++
          } catch (error) {
            result.failed++
            result.errors.push(`Citation ${citation.id}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        break

      case 'missing_agent_memories':
        // Enqueue content for agent feeding
        const savedContent = await prisma.discoveredContent.findMany({
          where: {
            ...(patchId ? { patchId } : {}),
          },
          select: {
            id: true,
            patchId: true,
            title: true,
            summary: true,
            textContent: true
          },
          take: 100
        })

        const { enqueueDiscoveredContent, calculateContentHash } = await import('../src/lib/agent/feedWorker')

        for (const content of savedContent) {
          try {
            // Check if already has memory or is in queue
            const hasMemory = await prisma.agentMemory.findFirst({
              where: {
                discoveredContentId: content.id
              }
            })

            const inQueue = await (prisma as any).agentMemoryFeedQueue.findFirst({
              where: {
                discoveredContentId: content.id,
                patchId: content.patchId
              }
            })

            if (!hasMemory && !inQueue) {
              const contentHash = calculateContentHash(
                content.title || '',
                content.summary || '',
                content.textContent || ''
              )

              await enqueueDiscoveredContent(content.id, content.patchId, contentHash, 0)
              result.fixed++
            }
          } catch (error) {
            result.failed++
            result.errors.push(`Content ${content.id}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        break

      case 'stuck_scanning_citations':
        // Reset stuck citations
        const stuckCitations = await prisma.wikipediaCitation.findMany({
          where: {
            ...(patchId ? { monitoring: { patchId } } : {}),
            scanStatus: 'scanning',
            updatedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) }
          },
          select: { id: true },
          take: 100
        })

        for (const citation of stuckCitations) {
          try {
            await prisma.wikipediaCitation.update({
              where: { id: citation.id },
              data: {
                scanStatus: 'not_scanned'
              }
            })
            result.fixed++
          } catch (error) {
            result.failed++
            result.errors.push(`Citation ${citation.id}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        break

      case 'stuck_processing_queue':
        // Reset stuck queue items
        const stuckQueueItems = await (prisma as any).agentMemoryFeedQueue.findMany({
          where: {
            ...(patchId ? { patchId } : {}),
            status: 'PROCESSING',
            pickedAt: { lt: new Date(Date.now() - 60 * 60 * 1000) }
          },
          select: { id: true },
          take: 100
        })

        for (const item of stuckQueueItems) {
          try {
            await (prisma as any).agentMemoryFeedQueue.update({
              where: { id: item.id },
              data: {
                status: 'PENDING',
                attempts: { increment: 1 }
              }
            })
            result.fixed++
          } catch (error) {
            result.failed++
            result.errors.push(`Queue item ${item.id}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        break
    }
  } catch (error) {
    result.errors.push(`Fix failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  return result
}

async function main() {
  const patchHandle = process.argv[2]
  const autoFix = !process.argv.includes('--detect-only')
  const verbose = process.argv.includes('--verbose')

  console.log(`\n🔍 Auto-Fix Discovery Issues\n`)

  if (patchHandle) {
    console.log(`Patch: ${patchHandle}`)
  } else {
    console.log(`Scope: All patches`)
  }

  console.log(`Mode: ${autoFix ? 'DETECT & FIX' : 'DETECT ONLY'}\n`)

  // Get patch ID if specified
  let patchId: string | undefined
  if (patchHandle) {
    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle },
      select: { id: true, title: true }
    })

    if (!patch) {
      console.error(`❌ Patch "${patchHandle}" not found`)
      process.exit(1)
    }

    patchId = patch.id
    console.log(`Patch: ${patch.title} (${patch.id})\n`)
  }

  // Detect issues
  console.log('🔍 Detecting issues...')
  const issues = await detectIssues(patchId)

  if (issues.length === 0) {
    console.log('✅ No issues detected!')
    process.exit(0)
  }

  console.log(`\n⚠️  Found ${issues.length} issue(s):\n`)

  issues.forEach((issue, index) => {
    const severityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    }[issue.severity]

    console.log(`${index + 1}. ${severityEmoji} [${issue.severity.toUpperCase()}] ${issue.type}`)
    console.log(`   ${issue.description}`)
    console.log(`   Fixable: ${issue.fixable ? 'Yes' : 'No'}\n`)
  })

  if (!autoFix) {
    console.log('ℹ️  Detection only - use without --detect-only to auto-fix')
    process.exit(0)
  }

  // Fix issues
  console.log('🔧 Fixing issues...\n')
  const results: FixResult[] = []

  for (const issue of issues) {
    if (!issue.fixable) {
      console.log(`⏭️  Skipping ${issue.type} (not fixable)`)
      continue
    }

    console.log(`🔧 Fixing: ${issue.type} (${issue.count} items)...`)
    const result = await fixIssue(issue, patchId)
    results.push(result)

    console.log(`   ✅ Fixed: ${result.fixed}`)
    if (result.failed > 0) {
      console.log(`   ❌ Failed: ${result.failed}`)
      if (verbose) {
        result.errors.forEach(err => console.log(`      - ${err}`))
      }
    }
    console.log('')
  }

  // Summary
  const totalFixed = results.reduce((sum, r) => sum + r.fixed, 0)
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0)

  console.log(`${'='.repeat(60)}`)
  console.log(`📊 AUTO-FIX SUMMARY`)
  console.log(`${'='.repeat(60)}`)
  console.log(`Issues detected: ${issues.length}`)
  console.log(`✅ Total fixed: ${totalFixed}`)
  console.log(`❌ Total failed: ${totalFailed}`)
  console.log(`${'='.repeat(60)}\n`)

  if (totalFailed > 0) {
    console.log(`⚠️  ${totalFailed} items failed to fix. Use --verbose for details.`)
    process.exit(1)
  } else {
    console.log(`✅ All issues fixed successfully!`)
    process.exit(0)
  }
}

main().catch(error => {
  console.error('\n❌ Auto-fix script failed:', error)
  process.exit(1)
})

