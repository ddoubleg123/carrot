import { deskById, deskByUsername } from '@/lib/curator/desks'
import { saysSomething } from '@/lib/curator/meaning'
import { quoteGrade, readQuote } from '@/lib/curator/quoteCard'
import { parseFeedPost } from '@/lib/feedPost'

export const BACKFILL_FOLLOWS = 5
export const BACKFILL_DAY_POSTS = 8

const DAY = 24 * 60 * 60 * 1000

export type FeedRow = {
  id?: string | null
  userId?: string | null
  createdAt?: string | Date | null
  bucket?: string | null
  patchId?: string | null
  media?: string | null
  thumbnailUrl?: string | null
  videoUrl?: string | null
  content?: string | null
  office?: boolean
  /** Set when another person reposted this post. Their id, not the author's. */
  repostedBy?: string | null
  /** The publisher, so BBC Golf and BBC F1 count as one outlet. */
  outlet?: string | null
  /** Sports desks share one lane. Other desks use their own bucket. */
  lane?: string | null
  User?: { username?: string | null } | null
}

/** One picture, one headline, or one page. A second caption does not make a second story. */
export function storyKeys(post: FeedRow): string[] {
  const keys: string[] = []
  const thumb = String(post.thumbnailUrl || '').split('?')[0].trim()
  if (thumb) keys.push(`img:${thumb}`)
  const content = String(post.content || '')
  const image = content.match(/^image:\s*(\S+)/im)
  if (image) keys.push(`img:${image[1].split('?')[0]}`)
  const title = content.match(/^title:\s*(.+)$/im)
  if (title) {
    const key = title[1].toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
    if (key.length >= 24) keys.push(`title:${key}`)
  }
  const url = content.match(/^https?:\/\/\S+/m)
  if (url) keys.push(`url:${url[0].split('?')[0]}`)
  return keys
}

/** A quote with no picture is an empty card. A desk text post that names nobody is too. */
export function feedVisible<T extends FeedRow & { imageUrls?: string[] | string | null }>(posts: T[]): T[] {
  return posts.filter((post) => {
    if (/^kind:\s*quote\b/im.test(String(post.content || ''))) {
      const quote = readQuote(post.content)
      if (!quote) return false
      const images = post.imageUrls
      const listed = Array.isArray(images) ? images.find((item) => item) : typeof images === 'string' && images.trim() !== '[]' ? images : ''
      return quoteGrade({ ...quote, image: post.thumbnailUrl || listed || '' }).pass
    }
    const desk = deskByUsername(post.User?.username) || (post.bucket ? deskById(post.bucket) : undefined)
    if (!desk) return true
    const parts = parseFeedPost(post.content)
    if (parts.url || post.videoUrl) return true
    return saysSomething(parts.note)
  })
}

export function uniqueStories<T extends FeedRow>(posts: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const post of posts) {
    const keys = storyKeys(post)
    if (keys.some((key) => seen.has(key))) continue
    for (const key of keys) seen.add(key)
    out.push(post)
  }
  return out
}

type Row = FeedRow

export function isPolPost(post: FeedRow): boolean {
  if (post.bucket === 'pol-watch' || post.office) return true
  return deskByUsername(post.User?.username)?.id === 'member-card'
}

/** Your own post stays off home. A repost still shows when someone else made it. */
export function repostedBySomeoneElse(post: Row, viewerId: string): boolean {
  const by = String(post.repostedBy || '').trim()
  return Boolean(by) && by !== viewerId
}

/**
 * Home is the people you follow, newest first.
 * Your own posts stay off it, unless someone else reposted one.
 * Unfollowed bots fill the page only when that list is too thin:
 * fewer than 5 follows, or fewer than 8 posts from them in the last day.
 * A bot you chose to follow stays in the first list.
 */
export function buildTimeline<T extends Row>(
  posts: T[],
  opts: { viewerId: string; following: string[]; botIds: Set<string>; patchIds?: Set<string>; mediaRun?: number; bucketRun?: number }
): T[] {
  const followed = new Set(opts.following)
  const patches = opts.patchIds || new Set<string>()
  const inNetwork = posts.filter((post) => {
    const id = post.userId || ''
    if (!id) return false
    if (id === opts.viewerId) return repostedBySomeoneElse(post, opts.viewerId)
    if (followed.has(id)) return true
    return Boolean(post.patchId && patches.has(String(post.patchId)))
  })
  const cutoff = Date.now() - DAY
  const recent = inNetwork.filter((post) => new Date(post.createdAt || 0).getTime() >= cutoff).length
  const thin = opts.following.length < BACKFILL_FOLLOWS || recent < BACKFILL_DAY_POSTS
  const limits = { media: opts.mediaRun ?? 2, bucket: opts.bucketRun ?? 2 }
  if (!thin) return spreadSlate(inNetwork, limits)
  const extra = posts.filter((post) => {
    const id = post.userId || ''
    return Boolean(id) && opts.botIds.has(id) && id !== opts.viewerId && !followed.has(id)
  })
  const merged: T[] = []
  const used = new Set<string>()
  for (const post of [...inNetwork, ...extra]) {
    const id = post.id ? String(post.id) : ''
    if (id && used.has(id)) continue
    if (id) used.add(id)
    merged.push(post)
  }
  merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  return spreadSlate(merged, limits)
}

const HOUR = 60 * 60 * 1000

/**
 * Same pool, reordered once a person has a few carrot, open, or stick signals.
 * hoursFor is how many hours that post's subject should be treated as newer.
 * A negative number sinks it. The post stays in the pool.
 */
export function orderByTaste<T extends Row>(
  posts: T[],
  opts: { signals: number; learnAfter?: number; hoursFor: (post: T) => number; mediaRun?: number; bucketRun?: number }
): T[] {
  const need = opts.learnAfter ?? 3
  if (opts.signals < need) return posts
  const ranked = [...posts].sort((a, b) => {
    const aAt = new Date(a.createdAt || 0).getTime() + opts.hoursFor(a) * HOUR
    const bAt = new Date(b.createdAt || 0).getTime() + opts.hoursFor(b) * HOUR
    return bAt - aAt
  })
  return spreadSlate(ranked, { media: opts.mediaRun ?? 2, bucket: opts.bucketRun ?? 2 })
}

function runLength<T extends Row>(out: T[], key: 'media' | 'bucket' | 'outlet' | 'lane', value: string | null | undefined): number {
  if (!value) return 0
  let count = 0
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i][key] !== value) break
    count += 1
  }
  return count
}

function recentCount<T extends Row>(out: T[], key: 'media' | 'outlet' | 'lane', value: string | null | undefined, span: number): number {
  if (!value) return 0
  let count = 0
  const start = Math.max(0, out.length - span)
  for (let i = out.length - 1; i >= start; i--) {
    if (out[i][key] === value) count += 1
  }
  return count
}

function fits<T extends Row>(out: T[], post: T, limits: { media: number; bucket: number }): boolean {
  const last = out[out.length - 1]
  if (last?.userId && post.userId === last.userId) return false
  if (runLength(out, 'media', post.media) >= limits.media) return false
  if (runLength(out, 'bucket', post.bucket) >= limits.bucket) return false
  if (runLength(out, 'outlet', post.outlet) >= 1) return false
  if (recentCount(out, 'media', post.media, 5) >= 2) return false
  return true
}

/**
 * A post is new when you have not seen it, or when it was published in the
 * last 24 hours. Unseen posts you asked for come first, even if they are older
 * than that. A subject you have pushed down stays behind those.
 */
export function rankHome<T extends Row>(
  posts: T[],
  opts: { hoursFor: (post: T) => number; seen?: Set<string>; now?: number; mediaRun?: number; bucketRun?: number }
): T[] {
  const seen = opts.seen || new Set<string>()
  const now = opts.now ?? Date.now()
  const band = (post: T) => {
    const wasSeen = Boolean(post.id && seen.has(String(post.id)))
    const at = new Date(post.createdAt || 0).getTime()
    const fresh = !wasSeen || (Number.isFinite(at) && now - at < DAY)
    const hours = opts.hoursFor(post)
    const liked = hours >= 12
    const avoided = !liked && hours < 0
    if (liked && fresh) return 0
    if (!avoided && fresh) return 1
    if (avoided && fresh) return 2
    if (liked) return 3
    if (!avoided) return 4
    return 5
  }
  const ranked = uniqueStories([...posts].sort((a, b) => {
    const diff = band(a) - band(b)
    if (diff) return diff
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  }))
  return spreadKeeping(ranked, { media: opts.mediaRun ?? 2, bucket: opts.bucketRun ?? 2 }, band)
}

/** Break a run without pulling a worse subject ahead of one you asked for. */
function spreadKeeping<T extends Row>(
  posts: T[],
  limits: { media: number; bucket: number },
  priority: (post: T) => number
): T[] {
  const pending = [...posts]
  const out: T[] = []
  while (pending.length) {
    const best = priority(pending[0])
    let index = -1
    for (let i = 0; i < pending.length; i++) {
      if (priority(pending[i]) !== best) break
      if (fits(out, pending[i], limits)) {
        index = i
        break
      }
    }
    if (index < 0) index = pending.findIndex((post) => fits(out, post, limits))
    if (index < 0) index = pending.findIndex((post) => runLength(out, 'outlet', post.outlet) < 1)
    if (index < 0) index = 0
    out.push(pending.splice(index, 1)[0])
  }
  return out
}

/** Break a run of the same person, the same media type, or the same bucket. */
export function spreadSlate<T extends Row>(posts: T[], limits: { media: number; bucket: number }): T[] {
  const pending = uniqueStories([...posts])
  const out: T[] = []
  while (pending.length) {
    let index = pending.findIndex((post) => fits(out, post, limits))
    if (index < 0) index = pending.findIndex((post) => runLength(out, 'outlet', post.outlet) < 1)
    if (index < 0) index = 0
    out.push(pending.splice(index, 1)[0])
  }
  return out
}

/** Pol Watch stays off Home unless every is at least 1. */
export function placePol<T>(posts: T[], pol: T[], every: number): T[] {
  if (every <= 0 || pol.length === 0) return posts
  const out: T[] = []
  let taken = 0
  for (let i = 0; i < posts.length; i++) {
    out.push(posts[i])
    if ((i + 1) % every === 0 && taken < pol.length) out.push(pol[taken++])
  }
  return out
}
