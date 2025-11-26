/**
 * Counters = DB truth
 * Avoid any "run" aggregates; compute from DB each refresh (or a 15s cached Redis key)
 * so the FE never shows "stuck"
 */

import { prisma } from '@/lib/prisma'
import { createClient } from 'redis'

const CACHE_TTL_SECONDS = 15

let redisClient: ReturnType<typeof createClient> | null = null

async function getRedisClient() {
  if (redisClient) return redisClient
  
  try {
    const url = process.env.REDIS_URL
    if (!url) return null
    
    redisClient = createClient({ url })
    await redisClient.connect()
    return redisClient
  } catch (error) {
    console.warn('[Counters] Redis not available, using DB-only mode:', error)
    return null
  }
}

export interface CounterStats {
  heroesReady: number
  heroesError: number
  heroesDraft: number
  contentTotal: number
  contentWithHero: number
}

/**
 * Get counter stats from DB (with 15s Redis cache)
 */
export async function getCounterStats(patchId?: string): Promise<CounterStats> {
  const cacheKey = `counters:${patchId || 'global'}`
  
  // Try Redis cache first
  const redis = await getRedisClient()
  if (redis) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (error) {
      console.warn('[Counters] Redis cache read failed:', error)
    }
  }
  
  // Compute from DB
  const [heroesReady, heroesError, heroesDraft, contentTotal, contentWithHero] = await Promise.all([
    prisma.hero.count({
      where: {
        status: 'READY',
        ...(patchId ? { content: { patchId } } : {})
      }
    }),
    prisma.hero.count({
      where: {
        status: 'ERROR',
        ...(patchId ? { content: { patchId } } : {})
      }
    }),
    prisma.hero.count({
      where: {
        status: 'DRAFT',
        ...(patchId ? { content: { patchId } } : {})
      }
    }),
    prisma.discoveredContent.count({
      ...(patchId ? { where: { patchId } } : {})
    }),
    prisma.discoveredContent.count({
      where: {
        ...(patchId ? { patchId } : {}),
        heroRecord: {
          status: 'READY'
        }
      }
    })
  ])
  
  const stats: CounterStats = {
    heroesReady,
    heroesError,
    heroesDraft,
    contentTotal,
    contentWithHero
  }
  
  // Cache in Redis
  if (redis) {
    try {
      await redis.setEx(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(stats))
    } catch (error) {
      console.warn('[Counters] Redis cache write failed:', error)
    }
  }
  
  return stats
}

