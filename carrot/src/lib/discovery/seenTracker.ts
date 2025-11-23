/**
 * Discovery seen tracker - prevents re-processing URLs across runs
 * Uses both Redis (fast) and DB (durable) for tracking
 */

import { prisma } from '@/lib/prisma'
import { getRedisClient } from '@/lib/redis/discovery'
import { discoveryLogger } from './structuredLogger'

const SEEN_TTL_DAYS = Number(process.env.DISCOVERY_SEEN_TTL_DAYS || 7)
const SEEN_TTL_MS = SEEN_TTL_DAYS * 24 * 60 * 60 * 1000

/**
 * Check if URL was seen within the TTL window
 * Returns true if seen, false if not seen
 */
export async function isUrlSeen(
  patchId: string,
  url: string,
  runId?: string
): Promise<{ seen: boolean; lastSeen?: Date; reason?: string }> {
  const canonicalUrl = url.trim()
  
  try {
    // Fast Redis check first
    const redis = await getRedisClient()
    const redisKey = `seen:${patchId}:${canonicalUrl}`
    const redisSeen = await redis.get(redisKey)
    
    if (redisSeen) {
      const lastSeen = new Date(parseInt(redisSeen))
      const ageMs = Date.now() - lastSeen.getTime()
      
      if (ageMs < SEEN_TTL_MS) {
        discoveryLogger.seenSkip(canonicalUrl, 'redis_recent', { patchId, ageDays: Math.round(ageMs / (24 * 60 * 60 * 1000) * 10) / 10 })
        return { seen: true, lastSeen, reason: 'redis_recent' }
      }
    }
    
    // DB check for durable tracking
    const dbSeen = await prisma.discoverySeen.findUnique({
      where: { url: canonicalUrl },
      select: { lastSeen: true, timesSeen: true, patchId: true }
    })
    
    if (dbSeen) {
      const ageMs = Date.now() - dbSeen.lastSeen.getTime()
      
      if (ageMs < SEEN_TTL_MS) {
        // Update Redis cache
        await redis.setex(redisKey, Math.floor(SEEN_TTL_MS / 1000), dbSeen.lastSeen.getTime().toString())
        
        discoveryLogger.seenSkip(canonicalUrl, 'db_recent', { 
          patchId, 
          ageDays: Math.round(ageMs / (24 * 60 * 60 * 1000) * 10) / 10,
          timesSeen: dbSeen.timesSeen
        })
        return { seen: true, lastSeen: dbSeen.lastSeen, reason: 'db_recent' }
      }
    }
    
    return { seen: false }
  } catch (error) {
    console.error('[SeenTracker] Error checking seen status:', error)
    // On error, assume not seen (fail open)
    return { seen: false }
  }
}

/**
 * Mark URL as seen
 */
export async function markUrlSeen(
  patchId: string,
  url: string,
  runId?: string,
  domain?: string
): Promise<void> {
  const canonicalUrl = url.trim()
  
  try {
    // Update Redis cache
    const redis = await getRedisClient()
    const redisKey = `seen:${patchId}:${canonicalUrl}`
    await redis.setex(redisKey, Math.floor(SEEN_TTL_MS / 1000), Date.now().toString())
    
    // Upsert DB record
    await prisma.discoverySeen.upsert({
      where: { url: canonicalUrl },
      update: {
        lastSeen: new Date(),
        lastRunId: runId || null,
        timesSeen: { increment: 1 },
        patchId: patchId || null,
        domain: domain || null
      },
      create: {
        url: canonicalUrl,
        firstSeen: new Date(),
        lastSeen: new Date(),
        lastRunId: runId || null,
        timesSeen: 1,
        patchId: patchId || null,
        domain: domain || null
      }
    })
  } catch (error) {
    console.error('[SeenTracker] Error marking URL as seen:', error)
    // Non-fatal - continue
  }
}

/**
 * Clean up old seen records (older than TTL)
 */
export async function cleanupOldSeenRecords(): Promise<number> {
  const cutoffDate = new Date(Date.now() - SEEN_TTL_MS)
  
  try {
    const result = await prisma.discoverySeen.deleteMany({
      where: {
        lastSeen: {
          lt: cutoffDate
        }
      }
    })
    return result.count
  } catch (error) {
    console.error('[SeenTracker] Error cleaning up old records:', error)
    return 0
  }
}

