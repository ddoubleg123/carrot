/**
 * Check detailed status of a discovery run
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

const PATCH_HANDLE = 'israel'

async function main() {
  console.log(`\n🔍 Checking Discovery Run Status for: ${PATCH_HANDLE}\n`)
  
  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: PATCH_HANDLE },
    select: { id: true, title: true }
  })
  
  if (!patch) {
    console.error(`❌ Patch "${PATCH_HANDLE}" not found`)
    process.exit(1)
  }
  
  // Get latest discovery run
  const runs = await (prisma as any).discoveryRun.findMany({
    where: { patchId: patch.id },
    orderBy: { id: 'desc' },
    take: 5
  })
  
  console.log(`📊 Recent Discovery Runs (last 5):\n`)
  runs.forEach((run: any, idx: number) => {
    const started = run.startedAt ? new Date(run.startedAt) : null
    const ended = run.endedAt ? new Date(run.endedAt) : null
    const now = new Date()
    const age = started ? Math.floor((now.getTime() - new Date(started).getTime()) / 1000 / 60) : 0
    
    console.log(`${idx + 1}. Run ${run.id.substring(0, 12)}...`)
    console.log(`   Status: ${run.status}`)
    console.log(`   Started: ${started ? started.toISOString() : 'N/A'}`)
    console.log(`   Ended: ${ended ? ended.toISOString() : 'Still running'}`)
    console.log(`   Age: ${age} minutes`)
    if (run.metrics) {
      const m = run.metrics as any
      console.log(`   Metrics:`, JSON.stringify(m, null, 2).substring(0, 200))
    }
    console.log()
  })
  
  // Get discovery audits for latest run
  const latestRun = runs[0]
  if (latestRun) {
    console.log(`\n📋 Discovery Audits for Latest Run (${latestRun.id.substring(0, 12)}...):\n`)
    
    const audits = await (prisma as any).discoveryAudit.findMany({
      where: { runId: latestRun.id },
      orderBy: { ts: 'desc' },
      take: 50,
      select: {
        step: true,
        status: true,
        ts: true,
        provider: true,
        candidateUrl: true,
        finalUrl: true,
        error: true
      }
    })
    
    // Group by step
    const byStep = new Map<string, any[]>()
    audits.forEach((a: any) => {
      if (!byStep.has(a.step)) {
        byStep.set(a.step, [])
      }
      byStep.get(a.step)!.push(a)
    })
    
    console.log(`Total audits: ${audits.length}`)
    console.log(`\nBy step:`)
    Array.from(byStep.entries()).forEach(([step, items]) => {
      const ok = items.filter((i: any) => i.status === 'ok').length
      const fail = items.filter((i: any) => i.status === 'fail').length
      const pending = items.filter((i: any) => i.status === 'pending').length
      console.log(`  ${step}: ${items.length} total (${ok} ok, ${fail} fail, ${pending} pending)`)
    })
    
    // Show recent audits
    console.log(`\n📝 Recent Audits (last 20):`)
    audits.slice(0, 20).forEach((a: any, idx: number) => {
      const time = new Date(a.ts).toISOString().substring(11, 19)
      const status = a.status === 'ok' ? '✅' : a.status === 'fail' ? '❌' : '⏳'
      const url = a.candidateUrl || a.finalUrl || ''
      console.log(`${idx + 1}. [${time}] ${status} ${a.step} - ${a.provider || ''} - ${url.substring(0, 60)}...`)
      if (a.error) {
        console.log(`     Error: ${JSON.stringify(a.error).substring(0, 100)}`)
      }
    })
    
    // Check for errors
    const errors = audits.filter((a: any) => a.status === 'fail' || a.error)
    if (errors.length > 0) {
      console.log(`\n❌ ERRORS FOUND: ${errors.length}`)
      errors.slice(0, 10).forEach((e: any, idx: number) => {
        console.log(`${idx + 1}. ${e.step} - ${e.error ? JSON.stringify(e.error).substring(0, 150) : 'Failed'}`)
      })
    }
  }
  
  // Check frontier size from Redis
  try {
    const { frontierSize } = await import('../src/lib/redis/discovery')
    const size = await frontierSize(patch.id)
    console.log(`\n🌳 Frontier Size: ${size} items`)
  } catch (error) {
    console.log(`\n⚠️  Could not check frontier size (Redis may not be available)`)
  }
  
  await prisma.$disconnect()
}

main().catch(console.error)

