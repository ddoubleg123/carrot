#!/usr/bin/env ts-node

import { randomInt } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { generateGuideSnapshot } from '@/lib/discovery/planner'
import { OPEN_EVIDENCE_V2 } from '@/lib/flags'

interface BackfillStats {
  processed: number
  updated: number
  skipped: number
  failed: number
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  if (!OPEN_EVIDENCE_V2) {
    console.error('[BackfillGuides] OPEN_EVIDENCE_V2 must be true to run this script.')
    process.exit(1)
  }

  const force = process.argv.includes('--force')
  const prisma = new PrismaClient()
  const stats: BackfillStats = { processed: 0, updated: 0, skipped: 0, failed: 0 }

  console.log('[BackfillGuides] Starting patch guide backfill', { force })

  try {
    const patches = await prisma.patch.findMany({
      select: {
        id: true,
        title: true,
        tags: true,
        entity: true,
        guide: true
      }
    })

    for (const patch of patches) {
      stats.processed += 1

      if (patch.guide && !force) {
        stats.skipped += 1
        continue
      }

      const entity = (patch.entity ?? {}) as { name?: string; aliases?: string[] }
      const topic = entity?.name && entity.name.trim().length ? entity.name.trim() : patch.title
      const aliases = Array.isArray(entity?.aliases) && entity.aliases.length
        ? entity.aliases.filter((value): value is string => typeof value === 'string' && value.trim()).map((value) => value.trim())
        : patch.tags.filter((value): value is string => typeof value === 'string' && value.trim()).map((value) => value.trim())

      try {
        const guide = await generateGuideSnapshot(topic, aliases)
        await prisma.patch.update({
          where: { id: patch.id },
          data: { guide }
        })
        stats.updated += 1

        const jitter = randomInt(250, 500)
        await sleep(jitter)
      } catch (error) {
        stats.failed += 1
        console.error('[BackfillGuides] Failed to update patch', {
          patchId: patch.id,
          error
        })
      }
    }

    console.log('[BackfillGuides] Complete', stats)
  } catch (error) {
    console.error('[BackfillGuides] Fatal error', error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
