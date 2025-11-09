import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { OPEN_EVIDENCE_V2 } from '@/lib/flags'
import { generateGuideSnapshot } from '@/lib/discovery/planner'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!OPEN_EVIDENCE_V2) {
    return NextResponse.json({ error: 'Backfill disabled' }, { status: 403 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const force = Boolean(body?.force)

  const patches = await prisma.patch.findMany({
    select: {
      id: true,
      title: true,
      tags: true,
      entity: true,
      guide: true
    }
  })

  let processed = 0
  let updated = 0
  let skipped = 0
  let failed = 0

  for (const patch of patches) {
    processed += 1

    if (patch.guide && !force) {
      skipped += 1
      continue
    }

    const entity = (patch.entity ?? {}) as { name?: string; aliases?: string[] }
    const topic = entity?.name && entity.name.trim().length ? entity.name.trim() : patch.title
    const aliases = Array.isArray(entity?.aliases) && entity.aliases.length
      ? entity.aliases.filter((value): value is string => typeof value === 'string' && value.trim()).map((value) => value.trim())
      : patch.tags.filter((value): value is string => typeof value === 'string' && value.trim()).map((value) => value.trim())

    try {
      const guide = await generateGuideSnapshot(topic, aliases)
      await prisma.patch.update({ where: { id: patch.id }, data: { guide } })
      updated += 1
    } catch (error) {
      failed += 1
      console.error('[BackfillGuidesAPI] Failed for patch', { patchId: patch.id, error })
    }
  }

  return NextResponse.json({ success: true, stats: { processed, updated, skipped, failed } })
}
