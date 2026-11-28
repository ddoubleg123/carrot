import prisma from '@/lib/prisma'
import { loadFeedRank } from '@/lib/feedRankStore'
import { dwellHours } from '@/lib/feedRank'
import { dropViewer } from '@/lib/feedViewer'
import { subjectOf, addHours, parseTaste, type TasteState } from '@/lib/taste'
import { sanitizePicks, type InterestPick } from '@/lib/interestCatalog'
import { deskByUsername } from '@/lib/curator/desks'

type Kind = 'share' | 'save' | 'post' | 'comment' | 'dwell' | 'skip'

type InterestMeta = {
  keys: string[]
  searches: { bucket: string; at: number }[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function readMeta(metadata: unknown): InterestMeta {
  const row = asRecord(asRecord(metadata).interest)
  const keys = Array.isArray(row.keys) ? row.keys.map(String).slice(-400) : []
  const searches = Array.isArray(row.searches)
    ? row.searches.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const bucket = String((item as { bucket?: unknown }).bucket || '')
        const at = Number((item as { at?: unknown }).at)
        if (!bucket || !Number.isFinite(at)) return []
        return [{ bucket, at }]
      }).slice(-40)
    : []
  return { keys, searches }
}

async function writeMeta(userId: string, taste: TasteState, interest: InterestMeta) {
  const tasteJson = JSON.stringify(taste)
  const interestJson = JSON.stringify(interest)
  await prisma.$executeRaw`
    UPDATE "User"
    SET metadata = jsonb_set(
      jsonb_set(COALESCE(metadata, '{}'::jsonb), '{taste}', ${tasteJson}::jsonb, true),
      '{interest}', ${interestJson}::jsonb, true
    )
    WHERE id = ${userId}
  `
}

export function bucketOf(post: { bucket?: string | null; userId?: string | null; User?: { username?: string | null } | null }): string {
  if (post.bucket) return post.bucket
  if (deskByUsername(post.User?.username)?.id === 'member-card') return 'pol-watch'
  return subjectOf(post.User?.username, post.userId || '')
}

async function loadViewer(userId: string) {
  const viewer = await prisma.user.findUnique({ where: { id: userId }, select: { metadata: true } })
  const metadata = viewer?.metadata
  return { metadata, taste: parseTaste(asRecord(metadata).taste), interest: readMeta(metadata) }
}

export async function recordInterest(userId: string, bucket: string, kind: Kind, dedupeKey: string, hours?: number) {
  if (!userId || !bucket || bucket === 'pol-watch') return
  const rank = await loadFeedRank()
  const table: Record<Kind, number> = {
    share: rank.share,
    save: rank.save,
    post: rank.post,
    comment: rank.comment,
    dwell: rank.dwell,
    skip: rank.skip
  }
  const amount = typeof hours === 'number' ? hours : table[kind]
  if (!amount) return
  const viewer = await loadViewer(userId)
  if (viewer.interest.keys.includes(dedupeKey)) return
  const taste = addHours(viewer.taste, bucket, amount)
  taste.signals = Math.max(taste.signals, 3)
  const keys = [...viewer.interest.keys, dedupeKey].slice(-400)
  await writeMeta(userId, taste, { ...viewer.interest, keys })
  dropViewer(userId)
}

export async function recordSearch(userId: string, bucket: string) {
  if (!userId || !bucket || bucket === 'pol-watch') return
  const viewer = await loadViewer(userId)
  const searches = [...viewer.interest.searches, { bucket, at: Date.now() }].slice(-40)
  await writeMeta(userId, viewer.taste, { ...viewer.interest, searches })
}

async function rememberSeen(userId: string, postId: string) {
  await prisma.$executeRaw`
    UPDATE "User"
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{seenPosts}',
      (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM (
          SELECT elem
          FROM jsonb_array_elements(
            COALESCE(metadata->'seenPosts', '[]'::jsonb) || jsonb_build_array(${postId}::text)
          ) WITH ORDINALITY AS listed(elem, ord)
          ORDER BY ord DESC
          LIMIT 800
        ) kept
      ),
      true
    )
    WHERE id = ${userId}
      AND NOT (COALESCE(metadata->'seenPosts', '[]'::jsonb) @> jsonb_build_array(${postId}::text))
  `
  dropViewer(userId)
}

export async function recordDwell(userId: string, postId: string, ms: number) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { bucket: true, userId: true, User: { select: { username: true } } }
  })
  if (!post) return
  await rememberSeen(userId, postId)
  if (post.userId === userId) return
  const rank = await loadFeedRank()
  const scored = dwellHours(ms, rank)
  if (scored.kind === 'none' || !scored.hours) return
  await recordInterest(userId, bucketOf(post), scored.kind, `view:${postId}`, scored.hours)
}

export function searchesFrom(metadata: unknown): { bucket: string; at: number }[] {
  return readMeta(metadata).searches
}

export function picksFrom(metadata: unknown): InterestPick[] {
  return sanitizePicks(asRecord(metadata).interestPicks)
}

export async function saveInterestPicks(userId: string, picks: InterestPick[]) {
  const json = JSON.stringify(picks)
  await prisma.$executeRaw`
    UPDATE "User"
    SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{interestPicks}', ${json}::jsonb, true)
    WHERE id = ${userId}
  `
  await seedInterest(userId, picks.map((pick) => pick.id))
}

export async function seedInterest(userId: string, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return
  const viewer = await loadViewer(userId)
  let taste = viewer.taste
  for (const id of unique) {
    const current = taste.desks[id] || 0
    if (current < 24) taste = addHours(taste, id, 24 - current)
  }
  taste.seeded = true
  taste.signals = Math.max(taste.signals, unique.length, 3)
  await writeMeta(userId, taste, viewer.interest)
}
