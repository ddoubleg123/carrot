/**
 * Check DiscoveredContent Status
 */

import 'dotenv/config'
import { prisma } from '../src/lib/prisma'

async function check() {
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })

  if (!patch) {
    console.error('Patch not found')
    process.exit(1)
  }

  const all = await prisma.discoveredContent.count({
    where: { patchId: patch.id }
  })

  const fromCitations = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    take: 10,
    select: { 
      id: true, 
      title: true, 
      metadata: true, 
      hero: true,
      sourceUrl: true,
      createdAt: true
    }
  })

  console.log(`\n📊 DiscoveredContent for Israel:`)
  console.log(`   Total: ${all}`)
  console.log(`\n📝 Sample items (first 10):`)
  
  fromCitations.forEach((item, i) => {
    const metadata = item.metadata as any
    const source = metadata?.source || 'unknown'
    const hasHero = item.hero !== null && item.hero !== undefined
    console.log(`   ${i + 1}. ${item.title}`)
    console.log(`      Source: ${source}`)
    console.log(`      Hero: ${hasHero ? 'Yes' : 'No'}`)
    console.log(`      URL: ${item.sourceUrl?.substring(0, 60)}...`)
    console.log(`      Created: ${item.createdAt.toISOString().split('T')[0]}`)
    console.log()
  })
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

