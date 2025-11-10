#!/usr/bin/env ts-node

import { randomInt } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { generateGuideSnapshot } from '@/lib/discovery/planner'

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
  const prisma = new PrismaClient()
  const force = process.argv.includes('--force')
  const dryRun = process.argv.includes('--dry-run')
  const stats: BackfillStats = { processed: 0, updated: 0, skipped: 0, failed: 0 }

  console.log('[BackfillTopicProfiles] Starting backfill', { force, dryRun })

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

      const entity = (patch.entity ?? {}) as { name?: string; aliases?: unknown[] }
      const topic =
        typeof entity?.name === 'string' && entity.name.trim().length > 0
          ? entity.name.trim()
          : patch.title

      const aliasSource = Array.isArray(entity?.aliases) && entity.aliases.length
        ? entity.aliases
        : patch.tags

      const aliases = Array.isArray(aliasSource)
        ? aliasSource
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => value.trim())
        : []

      try {
        const guide = await generateGuideSnapshot(topic, aliases)

        if (dryRun) {
          console.log('[BackfillTopicProfiles] Preview', {
            patchId: patch.id,
            topic: guide.topic,
            seedCount: guide.seedCandidates?.length ?? 0
          })
          stats.skipped += 1
          continue
        }

        await prisma.patch.update({
          where: { id: patch.id },
          data: { guide: guide as any }
        })

        stats.updated += 1

        const jitter = randomInt(200, 450)
        await sleep(jitter)
      } catch (error) {
        stats.failed += 1
        console.error('[BackfillTopicProfiles] Failed to generate guide', {
          patchId: patch.id,
          error
        })
      }
    }

    console.log('[BackfillTopicProfiles] Complete', stats)
  } catch (error) {
    console.error('[BackfillTopicProfiles] Fatal error', error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()

