import prisma from '@/lib/prisma'
import { interestTokens } from '@/lib/interestCatalog'
import { loadFeedRank } from '@/lib/feedRankStore'
import { FEED_RANK_DEFAULTS, searchHours, type FeedRankConfig } from '@/lib/feedRank'
import { parseTaste, type TasteState } from '@/lib/taste'
import type { FeedRow } from '@/lib/feedTimeline'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function seenSet(metadata: unknown): Set<string> {
  const ids = new Set<string>()
  const taste = parseTaste(asRecord(metadata).taste)
  for (const mark of taste.marks) ids.add(mark.id)
  const keys = asRecord(asRecord(metadata).interest).keys
  if (Array.isArray(keys)) {
    for (const key of keys) {
      const text = String(key || '')
      if (text.startsWith('view:')) ids.add(text.slice(5))
    }
  }
  const seen = asRecord(metadata).seenPosts
  if (Array.isArray(seen)) {
    for (const id of seen) if (id) ids.add(String(id))
  }
  return ids
}

export type ViewerContext = {
  at: number
  viewerId: string
  following: string[]
  groups: Set<string>
  favoredPatches: Set<string>
  seen: Set<string>
  taste: TasteState
  searches: { bucket: string; at: number }[]
  tokens: Set<string>
  rank: FeedRankConfig
}

const cache = new Map<string, ViewerContext>()

export function dropViewer(userId: string) {
  cache.delete(userId)
}

function searchesOf(metadata: unknown): { bucket: string; at: number }[] {
  const row = asRecord(asRecord(metadata).interest).searches
  if (!Array.isArray(row)) return []
  return row.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const bucket = String((item as { bucket?: unknown }).bucket || '')
    const at = Number((item as { at?: unknown }).at)
    if (!bucket || !Number.isFinite(at)) return []
    return [{ bucket, at }]
  }).slice(-40)
}

export async function loadViewerContext(viewerId: string): Promise<ViewerContext | null> {
  const cached = cache.get(viewerId)
  if (cached && Date.now() - cached.at < 15_000) return cached
  const [viewer, memberships, rank] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewerId }, select: { metadata: true, interests: true } }),
    prisma.patchMember.findMany({
      where: { userId: viewerId },
      select: { patchId: true, patch: { select: { handle: true, title: true } } }
    }),
    loadFeedRank().catch(() => FEED_RANK_DEFAULTS)
  ])
  if (!viewer) return null
  const metadata = viewer.metadata
  const taste = parseTaste(asRecord(metadata).taste)
  const tokens = new Set(interestTokens(viewer.interests || ''))
  for (const [desk, hours] of Object.entries(taste.desks)) {
    if (hours >= 12) tokens.add(desk)
  }
  const groups = new Set<string>()
  const favoredPatches = new Set<string>()
  for (const row of memberships) {
    groups.add(row.patchId)
    const handle = row.patch.handle.toLowerCase()
    const title = interestTokens(row.patch.title)
    if (tokens.has(handle) || title.some((word) => tokens.has(word))) favoredPatches.add(row.patchId)
  }
  const ctx: ViewerContext = {
    at: Date.now(),
    viewerId,
    following: Array.isArray(asRecord(metadata).following) ? (asRecord(metadata).following as unknown[]).map(String) : [],
    groups,
    favoredPatches,
    seen: seenSet(metadata),
    taste,
    searches: searchesOf(metadata),
    tokens,
    rank
  }
  cache.set(viewerId, ctx)
  return ctx
}

export function hoursForPost(ctx: ViewerContext, post: FeedRow): number {
  const bucket = String(post.bucket || '')
  const authorId = String(post.userId || '')
  const learned = ctx.taste.desks[bucket] || 0
  const follow = ctx.following.includes(authorId) ? ctx.rank.follow : 0
  const group = post.patchId && ctx.groups.has(String(post.patchId)) ? ctx.rank.group : 0
  const searched = searchHours(ctx.searches, bucket, ctx.rank.search)
  let hours = learned + follow + group + searched
  const asked = ctx.tokens.has(bucket)
    || (post.patchId ? ctx.favoredPatches.has(String(post.patchId)) : false)
    || mentionsInterest(post, ctx.tokens)
  if (asked && hours < 24) hours = 24
  return hours
}

function mentionsInterest(post: FeedRow, tokens: Set<string>): boolean {
  const content = String((post as { content?: unknown }).content || '').toLowerCase()
  if (!content) return false
  for (const token of tokens) {
    if (token.length < 4) continue
    if (content.includes(token)) return true
  }
  return false
}
