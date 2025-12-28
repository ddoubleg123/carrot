/**
 * Investigate why discovery run is stuck
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const PATCH_HANDLE = 'israel'

async function main() {
  console.log(`\n🔍 Investigating Discovery Run Issues for: ${PATCH_HANDLE}\n`)
  
  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, title: true }
  })
  
  if (!patch) {
    console.error(`❌ Patch not found`)
    process.exit(1)
  }
  
  // Get latest run
  const runs = await (prisma as any).discoveryRun.findMany({
    where: { patchId: patch.id },
    orderBy: { id: 'desc' },
    take: 1
  })
  
  const latestRun = runs[0]
  if (!latestRun) {
    console.log('No discovery runs found')
    await prisma.$disconnect()
    return
  }
  
  console.log(`Latest Run: ${latestRun.id}`)
  console.log(`Status: ${latestRun.status}`)
  console.log(`Started: ${latestRun.startedAt}`)
  console.log(`\n`)
  
  // Check frontier size
  try {
    const { frontierSize } = await import('../src/lib/redis/discovery')
    const size = await frontierSize(patch.id)
    console.log(`🌳 Frontier Size: ${size} items\n`)
    
    if (size > 0) {
      console.log(`⚠️  WARNING: Frontier still has ${size} items - engine may not be processing them\n`)
    }
  } catch (error: any) {
    console.log(`⚠️  Could not check frontier: ${error.message}\n`)
  }
  
  // Get recent discovery audits (limited to avoid timeout)
  console.log(`📋 Checking Discovery Audits (last 50)...\n`)
  
  const audits = await (prisma as any).discoveryAudit.findMany({
    where: { runId: latestRun.id },
    orderBy: { ts: 'desc' },
    take: 50, // Reduced from 100 to avoid timeout
    select: {
      step: true,
      status: true,
      ts: true,
      provider: true,
      candidateUrl: true,
      error: true,
      decisions: true
    }
  })
  
  if (audits.length === 0) {
    console.log(`❌ No discovery audits found - engine may not be running at all\n`)
    await prisma.$disconnect()
    return
  }
  
  console.log(`Found ${audits.length} audit records\n`)
  
  // Analyze by step
  const stepCounts = new Map<string, { total: number; ok: number; fail: number; pending: number }>()
  
  audits.forEach((a: any) => {
    if (!stepCounts.has(a.step)) {
      stepCounts.set(a.step, { total: 0, ok: 0, fail: 0, pending: 0 })
    }
    const counts = stepCounts.get(a.step)!
    counts.total++
    if (a.status === 'ok') counts.ok++
    else if (a.status === 'fail') counts.fail++
    else if (a.status === 'pending') counts.pending++
  })
  
  console.log(`📊 Step Breakdown:\n`)
  Array.from(stepCounts.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([step, counts]) => {
      const okPct = ((counts.ok / counts.total) * 100).toFixed(1)
      const failPct = ((counts.fail / counts.total) * 100).toFixed(1)
      console.log(`  ${step}:`)
      console.log(`    Total: ${counts.total}`)
      console.log(`    ✅ OK: ${counts.ok} (${okPct}%)`)
      console.log(`    ❌ Fail: ${counts.fail} (${failPct}%)`)
      console.log(`    ⏳ Pending: ${counts.pending}`)
      console.log()
    })
  
  // Check for errors
  const errors = audits.filter((a: any) => a.status === 'fail' || a.error)
  if (errors.length > 0) {
    console.log(`\n❌ ERRORS FOUND: ${errors.length}\n`)
    
    // Group errors by type
    const errorTypes = new Map<string, number>()
    errors.forEach((e: any) => {
      const errorMsg = e.error ? JSON.stringify(e.error) : 'Unknown error'
      const key = errorMsg.substring(0, 100)
      errorTypes.set(key, (errorTypes.get(key) || 0) + 1)
    })
    
    console.log(`Error Summary (top 10):\n`)
    Array.from(errorTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([error, count], idx) => {
        console.log(`${idx + 1}. [${count}x] ${error}`)
      })
    
    console.log(`\nRecent Errors:\n`)
    errors.slice(0, 10).forEach((e: any, idx) => {
      const time = new Date(e.ts).toISOString().substring(11, 19)
      console.log(`${idx + 1}. [${time}] ${e.step} - ${e.provider || ''}`)
      if (e.error) {
        console.log(`   Error: ${JSON.stringify(e.error).substring(0, 200)}`)
      }
      if (e.decisions) {
        const decisions = e.decisions as any
        console.log(`   Decision: ${decisions.reason || JSON.stringify(decisions).substring(0, 100)}`)
      }
      console.log()
    })
  } else {
    console.log(`✅ No errors found in audits\n`)
  }
  
  // Check most recent activity
  const recentAudits = audits.slice(0, 20)
  console.log(`\n⏰ Most Recent Activity (last 20):\n`)
  recentAudits.forEach((a: any, idx) => {
    const time = new Date(a.ts).toISOString()
    const timeAgo = Math.floor((Date.now() - new Date(a.ts).getTime()) / 1000 / 60)
    const status = a.status === 'ok' ? '✅' : a.status === 'fail' ? '❌' : '⏳'
    const url = (a.candidateUrl || '').substring(0, 50)
    console.log(`${idx + 1}. [${timeAgo}m ago] ${status} ${a.step} - ${a.provider || ''} - ${url}...`)
  })
  
  // Check last activity time
  if (audits.length > 0) {
    const lastAudit = audits[0]
    const lastActivity = new Date(lastAudit.ts)
    const minutesAgo = Math.floor((Date.now() - lastActivity.getTime()) / 1000 / 60)
    
    console.log(`\n⏱️  Last Activity: ${lastActivity.toISOString()} (${minutesAgo} minutes ago)`)
    
    if (minutesAgo > 10) {
      console.log(`\n⚠️  WARNING: No activity for ${minutesAgo} minutes - engine may be stuck or stopped\n`)
    } else {
      console.log(`\n✅ Recent activity detected - engine appears to be running\n`)
    }
  }
  
  // Check if items are being saved
  const contentSinceRun = await prisma.discoveredContent.count({
    where: {
      patchId: patch.id,
      createdAt: { gte: latestRun.startedAt }
    }
  })
  
  console.log(`\n💾 Items Saved Since Run Started: ${contentSinceRun}`)
  
  if (contentSinceRun === 0 && audits.length > 0) {
    console.log(`\n⚠️  WARNING: Engine is processing (${audits.length} audits) but NOT saving items\n`)
    console.log(`   Possible causes:`)
    console.log(`   1. Items are failing relevance/quality checks`)
    console.log(`   2. Save operations are failing silently`)
    console.log(`   3. Items are being marked as duplicates`)
    console.log(`   4. Database write operations are blocked\n`)
  }
  
  await prisma.$disconnect()
}

main().catch(console.error)

