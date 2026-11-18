export const BACKFILL_FOLLOWS = 5
export const BACKFILL_DAY_POSTS = 8

const DAY = 24 * 60 * 60 * 1000

type Row = { userId?: string | null; createdAt?: string | Date | null }

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
  if (!thin) return inNetwork
  const extra = posts.filter((post) => {
    const id = post.userId || ''
    return Boolean(id) && opts.botIds.has(id) && id !== opts.viewerId && !followed.has(id)
  })
  const merged = [...inNetwork, ...extra]
  merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  return spreadAuthors(merged)
}

function spreadAuthors<T extends Row>(posts: T[]): T[] {
  const pending = [...posts]
  const out: T[] = []
  while (pending.length) {
    let index = 0
    const last = out[out.length - 1]?.userId
    const prev = out[out.length - 2]?.userId
    if (last && prev === last) {
      const other = pending.findIndex((post) => post.userId !== last)
      if (other >= 0) index = other
    }
    out.push(pending.splice(index, 1)[0])
  }
  return out
}
