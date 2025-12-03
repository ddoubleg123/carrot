/**
 * Re-run extraction+validation+save for previously denied/short items.
 * Usage: npx tsx scripts/backfill-wiki-citations.ts --patch=israel --limit=500
 */

import { prisma } from '../src/lib/prisma'
import { reprocessCitation } from '../src/lib/discovery/wikipediaProcessor'

function getArg(flag: string): string | undefined {
  const args = process.argv.slice(2)
  const arg = args.find(a => a.startsWith(flag + '='))
  return arg ? arg.split('=')[1] : undefined
}

// Simple concurrency limiter
class ConcurrencyLimiter {
  private running = 0
  constructor(private max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.max) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    this.running++
    try {
      return await fn()
    } finally {
      this.running--
    }
  }
}

async function main() {
  const patchHandle = getArg('--patch') || 'israel'
  const limit = Number(getArg('--limit') || 500)
  const limiter = new ConcurrencyLimiter(5) // Process 5 at a time

  console.log(`[Backfill] Starting backfill for patch: ${patchHandle}, limit: ${limit}`)

  // Get patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true, title: true }
  })

  if (!patch) {
    console.error(`[Backfill] Patch "${patchHandle}" not found`)
    process.exit(1)
  }

  // Find denied citations that were scanned but not saved
  // These are candidates for reprocessing with better extraction
  const rows = await prisma.wikipediaCitation.findMany({
    where: {
      monitoring: { patchId: patch.id },
      scanStatus: 'scanned',
      relevanceDecision: 'denied',
      savedContentId: null,
      // Only reprocess if they have some content (might have been too short before)
      OR: [
        { contentText: { not: null } },
        { errorMessage: { contains: 'insufficient content' } },
        { errorMessage: { contains: 'min_len' } }
      ]
    },
    take: limit,
    orderBy: { lastScannedAt: 'desc' },
    include: {
      monitoring: {
        select: {
          wikipediaTitle: true,
          wikipediaUrl: true
        }
      }
    }
  })

  console.log(`[Backfill] Found ${rows.length} citations to reprocess`)

  if (rows.length === 0) {
    console.log(`[Backfill] No citations to reprocess`)
    process.exit(0)
  }

  // Get save functions (these would normally come from the discovery engine)
  // For backfill, we'll need to import or create minimal versions
  const { saveAsContent, saveAsMemory } = await import('../src/lib/discovery/engineV21').catch(() => {
    // Fallback: create minimal save functions
    return {
      saveAsContent: async (url: string, title: string, content: string) => {
        const { prisma } = await import('../src/lib/prisma')
        try {
          const saved = await prisma.discoveredContent.create({
            data: {
              patchId: patch.id,
              title,
              sourceUrl: url,
              canonicalUrl: url,
              content,
              summary: content.substring(0, 240),
              relevanceScore: 0.7,
              qualityScore: 0
            }
          })
          return saved.id
        } catch (error) {
          console.error(`[Backfill] Error saving content:`, error)
          return null
        }
      },
      saveAsMemory: async (url: string, title: string, content: string) => {
        // Skip memory for backfill
        return null
      }
    }
  })

  let ok = 0
  let fail = 0
  let saved = 0

  await Promise.all(
    rows.map(r =>
      limiter.run(async () => {
        try {
          const result = await reprocessCitation(r.id, {
            patchName: patch.title,
            patchHandle: patchHandle,
            saveAsContent: saveAsContent as any,
            saveAsMemory: saveAsMemory as any
          })

          if (result.processed) {
            ok++
            if (result.saved) {
              saved++
            }
          } else {
            fail++
          }
        } catch (e) {
          console.warn(JSON.stringify({
            tag: 'backfill_fail',
            citationId: r.id,
            url: r.citationUrl,
            error: String(e)
          }))
          fail++
        }
      })
    )
  )

  console.log(
    JSON.stringify({
      tag: 'backfill_done',
      patch: patchHandle,
      total: rows.length,
      ok,
      fail,
      saved
    })
  )

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

