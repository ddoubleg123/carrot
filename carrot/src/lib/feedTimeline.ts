export const BACKFILL_FOLLOWS = 5
export const BACKFILL_DAY_POSTS = 8

const DAY = 24 * 60 * 60 * 1000

type Row = {
  userId?: string | null
  createdAt?: string | Date | null
  bucket?: string | null
  media?: string | null
  outlet?: string | null
  lane?: string | null
}

/**
 * Home is the people you follow, newest first, plus your own posts.
 * Unfollowed bots fill the page only when that list is too thin:
 * fewer than 5 follows, or fewer than 8 posts from them in the last day.
 * A bot you chose to follow stays in the first list.
 */
export function buildTimeline<T extends Row>(
  posts: T[],
  opts: { viewerId: string; following: string[]; botIds: Set<string> }
): T[] {
  const followed = new Set(opts.following)
  const inNetwork = posts.filter((post) => {
    const id = post.userId || ''
    return Boolean(id) && (id === opts.viewerId || followed.has(id))
  })
  const cutoff = Date.now() - DAY
  const recent = inNetwork.filter((post) => new Date(post.createdAt || 0).getTime() >= cutoff).length
  const thin = opts.following.length < BACKFILL_FOLLOWS || recent < BACKFILL_DAY_POSTS
  const limits = { media: 2, bucket: 2 }
  if (!thin) return spreadSlate(inNetwork, limits)
  const extra = posts.filter((post) => {
    const id = post.userId || ''
    return Boolean(id) && opts.botIds.has(id) && id !== opts.viewerId && !followed.has(id)
  })
  const merged = [...inNetwork, ...extra]
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
  opts: { signals: number; learnAfter?: number; hoursFor: (post: T) => number }
): T[] {
  const need = opts.learnAfter ?? 3
  if (opts.signals < need) return posts
  const ranked = [...posts].sort((a, b) => {
    const aAt = new Date(a.createdAt || 0).getTime() + opts.hoursFor(a) * HOUR
    const bAt = new Date(b.createdAt || 0).getTime() + opts.hoursFor(b) * HOUR
    return bAt - aAt
  })
  return spreadSlate(ranked, { media: 2, bucket: 2 })
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
  if (recentCount(out, 'outlet', post.outlet, 6) >= 1) return false
  if (recentCount(out, 'lane', post.lane, 6) >= 1) return false
  if (recentCount(out, 'media', post.media, 5) >= 2) return false
  return true
}

/** Break a run of the same person, outlet, subject, or kind of post. */
export function spreadSlate<T extends Row>(posts: T[], limits: { media: number; bucket: number }): T[] {
  const pending = [...posts]
  const out: T[] = []
  while (pending.length) {
    let index = pending.findIndex((post) => fits(out, post, limits))
    if (index < 0) index = pending.findIndex((post) => !post.outlet || recentCount(out, 'outlet', post.outlet, 6) === 0)
    if (index < 0) index = 0
    out.push(pending.splice(index, 1)[0])
  }
  return out
}
