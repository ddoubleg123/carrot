import prisma from '@/lib/prisma'

async function main() {
  const patchHandle = process.argv[2] || 'israel'
  
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })
  
  if (!patch) {
    console.error(`Patch not found: ${patchHandle}`)
    process.exit(1)
  }
  
  console.log(`\n📊 Discovery Details for: ${patch.title} (${patchHandle})\n`)
  
  // Recent runs
  const runs = await (prisma as any).discoveryRun.findMany({
    where: { patchId: patch.id },
    orderBy: { startedAt: 'desc' },
    take: 3,
    select: {
      id: true,
      status: true,
      startedAt: true,
      endedAt: true,
      metrics: true
    }
  })
  
  console.log('Recent Discovery Runs:')
  runs.forEach((run: any, i: number) => {
    console.log(`  ${i+1}. ${run.status} - Started: ${run.startedAt}`)
    if (run.metrics) {
      const m = run.metrics as any
      console.log(`     Processed: ${m.candidatesProcessed || 0}, Saved: ${m.itemsSaved || 0}`)
    }
  })
  
  // Recent discovered content
  const recent = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      category: true,
      createdAt: true,
      textContent: true,
      metadata: true
    }
  })
  
  console.log(`\nRecent Discovered Content (${recent.length} items):`)
  recent.forEach((item, i) => {
    const meta = item.metadata as any
    const source = meta?.source || item.category || 'unknown'
    const textLen = item.textContent?.length || 0
    console.log(`  ${i+1}. [${source}] ${item.title?.substring(0, 50) || 'No title'}...`)
    console.log(`     URL: ${item.sourceUrl?.substring(0, 70)}...`)
    console.log(`     Text: ${textLen.toLocaleString()} chars, Created: ${item.createdAt.toISOString().substring(0, 19)}`)
  })
  
  // Citations
  const citations = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: 'scanned',
      lastScannedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    orderBy: { lastScannedAt: 'desc' },
    take: 15,
    select: {
      id: true,
      citationUrl: true,
      citationTitle: true,
      scanStatus: true,
      relevanceDecision: true,
      lastScannedAt: true,
      aiPriorityScore: true
    }
  })
  
  console.log(`\nCitations Processed (Last 24h): ${citations.length}`)
  citations.slice(0, 10).forEach((c, i) => {
    console.log(`  ${i+1}. [${c.relevanceDecision || 'pending'}] ${c.citationTitle?.substring(0, 45) || 'No title'}...`)
    console.log(`     URL: ${c.citationUrl.substring(0, 65)}...`)
    console.log(`     AI Score: ${c.aiPriorityScore || 'N/A'}, Scanned: ${c.lastScannedAt?.toISOString().substring(0, 19)}`)
  })
  
  // Anna's Archive
  const annasArchive = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id,
      sourceUrl: { contains: 'annas-archive.org' }
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      textContent: true,
      createdAt: true
    }
  })
  
  console.log(`\nAnna's Archive Items: ${annasArchive.length}`)
  annasArchive.forEach((item, i) => {
    console.log(`  ${i+1}. ${item.title?.substring(0, 50) || 'No title'}...`)
    console.log(`     URL: ${item.sourceUrl?.substring(0, 70)}...`)
    console.log(`     Text: ${item.textContent?.length || 0} chars`)
  })
  
  await prisma.$disconnect()
}

main().catch(console.error)

