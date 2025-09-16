#!/usr/bin/env node
/*
  Backfill durable Firebase path fields on Post:
  - videoBucket (e.g., <project>.appspot.com)
  - videoPath   (e.g., users/<uid>/posts/<file>.mp4)

  Usage:
    node scripts/backfill-video-paths.mjs --limit=1000 --dry-run
*/
import process from 'node:process'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function parseArgs() {
  const args = process.argv.slice(2)
  const out = { limit: 1000, dryRun: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--limit' && args[i+1]) { out.limit = parseInt(args[++i], 10) || 1000 }
    else if (a === '--dry-run') { out.dryRun = true }
  }
  return out
}

function extractBucketAndPath(u) {
  try {
    const url = new URL(u)
    const host = url.hostname
    // firebasestorage.googleapis.com/v0/b/<bucket>/o/<ENCODED_PATH>
    const m1 = url.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)$/)
    if (host === 'firebasestorage.googleapis.com' && m1) {
      return { bucket: decodeURIComponent(m1[1]), path: decodeURIComponent(m1[2]) }
    }
    // storage.googleapis.com/<bucket>/<path>
    const m2 = url.pathname.match(/^\/([^/]+)\/(.+)$/)
    if (host === 'storage.googleapis.com' && m2) {
      return { bucket: decodeURIComponent(m2[1]), path: decodeURIComponent(m2[2]) }
    }
    // <project>.firebasestorage.app/o/<ENCODED_PATH>
    const m4 = url.pathname.match(/^\/o\/([^?]+)$/)
    if (host.endsWith('.firebasestorage.app') && m4) {
      // Try to infer bucket from GoogleAccessId if present
      const ga = url.searchParams.get('GoogleAccessId') || ''
      const projectMatch = ga.match(/@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/i)
      const inferredBucket = projectMatch ? `${projectMatch[1]}.appspot.com` : null
      return { bucket: inferredBucket, path: decodeURIComponent(m4[1]) }
    }
    // Generic /o/<ENCODED_PATH>
    const m3 = url.pathname.match(/\/o\/([^?]+)$/)
    if (m3) {
      const ga = url.searchParams.get('GoogleAccessId') || ''
      const projectMatch = ga.match(/@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/i)
      const inferredBucket = projectMatch ? `${projectMatch[1]}.appspot.com` : null
      return { bucket: inferredBucket, path: decodeURIComponent(m3[1]) }
    }
  } catch {}
  return { bucket: null, path: null }
}

async function main() {
  const { limit, dryRun } = parseArgs()
  console.log('[backfill-video-paths] start', { limit, dryRun })
  const rows = await prisma.post.findMany({
    where: {
      OR: [
        { videoBucket: null },
        { videoPath: null },
      ],
      NOT: { videoUrl: null },
    },
    select: { id: true, videoUrl: true, videoBucket: true, videoPath: true },
    take: limit,
  })
  console.log(`[backfill-video-paths] scanning ${rows.length} posts ...`)

  let updated = 0
  for (const r of rows) {
    const u = r.videoUrl
    if (!u || typeof u !== 'string') continue
    const { bucket, path } = extractBucketAndPath(u)
    if (!bucket && !path) continue

    const next = {
      ...(bucket ? { videoBucket: bucket } : {}),
      ...(path ? { videoPath: path } : {}),
    }
    if (Object.keys(next).length === 0) continue

    if (dryRun) {
      console.log('DRY-RUN update', r.id, next)
      updated++
      continue
    }
    try {
      await prisma.post.update({ where: { id: r.id }, data: next })
      updated++
    } catch (e) {
      console.warn('[backfill-video-paths] update failed', r.id, (e?.message)||e)
    }
  }
  console.log(`[backfill-video-paths] updated ${updated} posts`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('[backfill-video-paths] fatal', e)
  process.exit(1)
})
