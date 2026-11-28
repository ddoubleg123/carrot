import prisma from '@/lib/prisma'
import { FEED_RANK_DEFAULTS, normalizeFeedRank, type FeedRankConfig } from '@/lib/feedRank'

const ROW = 'live'
let cache: { at: number; config: FeedRankConfig } | null = null

export async function loadFeedRank(): Promise<FeedRankConfig> {
  if (cache && Date.now() - cache.at < 60_000) return cache.config
  try {
    const row = await prisma.feedRank.findUnique({ where: { id: ROW } })
    const config = normalizeFeedRank(row?.data)
    cache = { at: Date.now(), config }
    return config
  } catch (error) {
    console.error('[feed-rank] read', error)
    return FEED_RANK_DEFAULTS
  }
}

export async function saveFeedRank(raw: unknown): Promise<FeedRankConfig> {
  const config = normalizeFeedRank(raw)
  await prisma.feedRank.upsert({
    where: { id: ROW },
    create: { id: ROW, data: config },
    update: { data: config }
  })
  cache = { at: Date.now(), config }
  return config
}

export function clearFeedRankCache() {
  cache = null
}
