/**
 * Seen URL tracking with database persistence
 * Tracks URLs across discovery runs using both Redis (fast) and DB (persistent)
 */

import { prisma } from '@/lib/prisma'
import { createHash } from 'crypto'
import { canonicalizeUrlFast } from './canonicalize'
import { isSeen as redisIsSeen, markAsSeen as redisMarkAsSeen } from '@/lib/redis/discovery'

/**
 * Normalize and hash URL for storage
 */
function normalizeAndHashUrl(url: string): { normalized: string; hash: string } {
  const normalized = canonicalizeUrlFast(url)
  const hash = createHash('sha256').update(normalized).digest('hex')
  return { normalized, hash }
}

/**
 * Check if URL has been seen (checks both Redis and DB)
 * Returns true if URL was seen in either Redis or DB
 */
export async function isUrlSeen(patchId: string, url: string): Promise<boolean> {
  // Fast check: Redis first
  const redisSeen = await redisIsSeen(patchId, url).catch(() => false)
  if (redisSeen) {
    return true
  }
  
  // Persistent check: Database
  try {
    const { hash } = normalizeAndHashUrl(url)
    const seen = await prisma.seenUrl.findUnique({
      where: {
        patchId_urlHash: {
          patchId,
          urlHash: hash
        }
      },
      select: { id: true }
    })
    
    return seen !== null
  } catch (error) {
    console.error('[SeenUrl] Error checking DB:', error)
    // If DB check fails, fall back to Redis result
    return redisSeen
  }
}

/**
 * Mark URL as seen (updates both Redis and DB)
 */
export async function markUrlSeen(
  patchId: string,
  url: string,
  options: { ttlDays?: number } = {}
): Promise<void> {
  const { normalized, hash } = normalizeAndHashUrl(url)
  const { ttlDays = 30 } = options
  
  // Update Redis (fast, in-memory)
  await redisMarkAsSeen(patchId, normalized, ttlDays).catch((error) => {
    console.error('[SeenUrl] Error marking in Redis:', error)
  })
  
  // Update DB (persistent, cross-run)
  try {
    await prisma.seenUrl.upsert({
      where: {
        patchId_urlHash: {
          patchId,
          urlHash: hash
        }
      },
      create: {
        patchId,
        urlHash: hash,
        urlNormalized: normalized,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        timesSeen: 1
      },
      update: {
        lastSeenAt: new Date(),
        timesSeen: {
          increment: 1
        }
      }
    })
  } catch (error) {
    console.error('[SeenUrl] Error marking in DB:', error)
    // Don't throw - Redis update is sufficient for current run
  }
}

/**
 * Get seen URL statistics for a patch
 */
export async function getSeenUrlStats(patchId: string): Promise<{
  totalSeen: number
  recentlySeen: number // Seen in last 7 days
}> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    
    const [totalSeen, recentlySeen] = await Promise.all([
      prisma.seenUrl.count({
        where: { patchId }
      }),
      prisma.seenUrl.count({
        where: {
          patchId,
          lastSeenAt: {
            gte: sevenDaysAgo
          }
        }
      })
    ])
    
    return { totalSeen, recentlySeen }
  } catch (error) {
    console.error('[SeenUrl] Error getting stats:', error)
    return { totalSeen: 0, recentlySeen: 0 }
  }
}

