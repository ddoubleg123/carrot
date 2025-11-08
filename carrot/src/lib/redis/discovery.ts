/**
 * Redis utilities for discovery pipeline
 * Manages seen URLs, content hashes, frontier queue, and active runs
 */

import Redis from 'ioredis'

let redisClient: Redis | null = null

async function getRedisClient() {
  if (!redisClient) {
    const url = process.env.REDIS_URL
    if (!url) {
      throw new Error('REDIS_URL must be set for discovery redis utilities')
    }
    redisClient = new Redis(url)
  }
  return redisClient
}

/**
 * Check if URL has been seen for this patch
 */
export async function isSeen(patchId: string, canonicalUrl: string): Promise<boolean> {
  const client = await getRedisClient()
  const key = `seen:patch:${patchId}`
  const result = await client.sismember(key, canonicalUrl)
  return result === 1
}

/**
 * Mark URL as seen for this patch
 */
export async function markAsSeen(patchId: string, canonicalUrl: string, ttlDays: number = 30): Promise<void> {
  const client = await getRedisClient()
  const key = `seen:patch:${patchId}`
  await client.sadd(key, canonicalUrl)
  await client.expire(key, ttlDays * 24 * 60 * 60)
}

/**
 * Check if content hash is near-duplicate (SimHash)
 */
export async function isNearDuplicate(patchId: string, contentHash: string, threshold: number = 4): Promise<boolean> {
  const client = await getRedisClient()
  const key = `hashes:patch:${patchId}`
  
  // Get all hashes (last 1k)
  const hashes = await client.zrevrange(key, 0, 1000)
  
  const hashNum = BigInt(contentHash)
  
  for (const existingHashStr of hashes) {
    const existingHash = BigInt(existingHashStr)
    const hammingDistance = calculateHammingDistance(hashNum, existingHash)
    
    if (hammingDistance <= threshold) {
      return true
    }
  }
  
  return false
}

/**
 * Mark content hash for near-dup detection
 */
export async function markContentHash(patchId: string, contentHash: string): Promise<void> {
  const client = await getRedisClient()
  const key = `hashes:patch:${patchId}`
  const timestamp = Date.now()
  
  await client.zadd(key, timestamp, contentHash)
  
  // Keep only last 1k entries
  const count = await client.zcard(key)
  if (count > 1000) {
    await client.zremrangebyrank(key, 0, count - 1000)
  }
}

/**
 * Calculate Hamming distance between two SimHashes
 */
function calculateHammingDistance(hash1: bigint, hash2: bigint): number {
  const xor = hash1 ^ hash2
  let distance = 0
  let temp = xor
  
  while (temp > BigInt(0)) {
    distance += Number(temp & BigInt(1))
    temp >>= BigInt(1)
  }
  
  return distance
}

/**
 * Add item to frontier queue
 */
export interface FrontierItem {
  id: string
  provider: string
  cursor: string
  priority: number
  angle?: string
  meta?: Record<string, any>
  payload?: Record<string, any>
}

export async function addToFrontier(
  patchId: string,
  item: FrontierItem
): Promise<void> {
  const client = await getRedisClient()
  const key = `frontier:patch:${patchId}`
  
  const value = JSON.stringify(item)
  await client.zadd(key, item.priority, value)
  
  // Keep only top 2k entries
  const count = await client.zcard(key)
  if (count > 2000) {
    await client.zremrangebyrank(key, 0, count - 2000)
  }
}

/**
 * Get highest priority item from frontier
 */
export async function popFromFrontier(patchId: string): Promise<FrontierItem | null> {
  const client = await getRedisClient()
  const key = `frontier:patch:${patchId}`
  
  const results = await client.zrevrange(key, 0, 0)
  if (results.length === 0) {
    return null
  }
  
  const item = JSON.parse(results[0]) as FrontierItem
  await client.zrem(key, results[0])
  
  return item
}

export async function clearFrontier(patchId: string): Promise<void> {
  const client = await getRedisClient()
  const key = `frontier:patch:${patchId}`
  await client.del(key)
}

export async function frontierSize(patchId: string): Promise<number> {
  const client = await getRedisClient()
  return client.zcard(`frontier:patch:${patchId}`)
}

/**
 * Set active run ID for patch
 */
export async function setActiveRun(patchId: string, runId: string): Promise<void> {
  const client = await getRedisClient()
  const key = `run:patch:${patchId}`
  await client.setex(key, 3600, runId) // 1 hour TTL
}

/**
 * Get active run ID for patch
 */
export async function getActiveRun(patchId: string): Promise<string | null> {
  const client = await getRedisClient()
  const key = `run:patch:${patchId}`
  const result = await client.get(key)
  return result
}

/**
 * Clear active run for patch
 */
export async function clearActiveRun(patchId: string): Promise<void> {
  const client = await getRedisClient()
  const key = `run:patch:${patchId}`
  await client.del(key)
}

/**
 * Cache Wikipedia references for a patch
 */
export async function cacheWikiRefs(patchId: string, refs: string[]): Promise<void> {
  const client = await getRedisClient()
  const key = `wiki:refs:${patchId}`
  await client.setex(key, 24 * 60 * 60, JSON.stringify(refs)) // 24h TTL
}

/**
 * Get cached Wikipedia references for a patch
 */
export async function getCachedWikiRefs(patchId: string): Promise<string[] | null> {
  const client = await getRedisClient()
  const key = `wiki:refs:${patchId}`
  const result = await client.get(key)
  if (result) {
    return JSON.parse(result)
  }
  return null
}

export async function pushAuditEvent(patchId: string, event: any, cap: number = 2000): Promise<void> {
  const client = await getRedisClient()
  const key = `audit:patch:${patchId}`
  await client.lpush(key, JSON.stringify(event))
  if (cap > 0) {
    await client.ltrim(key, 0, cap - 1)
  }
}

export interface AuditPageOptions {
  offset?: number
  limit?: number
}

export async function getAuditEvents(patchId: string, options: AuditPageOptions = {}): Promise<{ items: any[]; nextOffset: number; hasMore: boolean }> {
  const client = await getRedisClient()
  const key = `audit:patch:${patchId}`
  const offset = Math.max(0, options.offset || 0)
  const limit = Math.max(1, options.limit || 100)
  const start = offset
  const stop = offset + limit - 1

  const raw = await client.lrange(key, start, stop)
  const total = await client.llen(key)
  const items = raw.map((entry) => {
    try {
      return JSON.parse(entry)
    } catch {
      return { raw: entry }
    }
  })

  const nextOffset = offset + items.length
  const hasMore = nextOffset < total

  return {
    items,
    nextOffset,
    hasMore
  }
}

const PLAN_TTL_SECONDS = 60 * 60 // 1 hour

export async function storeDiscoveryPlan(runId: string, plan: any): Promise<void> {
  const client = await getRedisClient()
  await client.setex(`plan:run:${runId}`, PLAN_TTL_SECONDS, JSON.stringify(plan))
}

export async function loadDiscoveryPlan<T = any>(runId: string): Promise<T | null> {
  const client = await getRedisClient()
  const raw = await client.get(`plan:run:${runId}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    console.warn('[Redis] Failed to parse discovery plan for run', runId, error)
    return null
  }
}

export async function markAngleCovered(runId: string, angle: string): Promise<void> {
  const client = await getRedisClient()
  const key = `plan:run:${runId}:angles`
  await client.sadd(key, angle)
  await client.expire(key, PLAN_TTL_SECONDS)
}

export async function getCoveredAngles(runId: string): Promise<Set<string>> {
  const client = await getRedisClient()
  const key = `plan:run:${runId}:angles`
  const members = await client.smembers(key)
  return new Set(members)
}

export async function clearPlan(runId: string): Promise<void> {
  const client = await getRedisClient()
  await client.del(`plan:run:${runId}`)
  await client.del(`plan:run:${runId}:angles`)
  await client.del(`plan:run:${runId}:contested`)
}

export async function markContestedCovered(runId: string, claim: string): Promise<void> {
  if (!claim) return
  const client = await getRedisClient()
  const key = `plan:run:${runId}:contested`
  await client.sadd(key, claim)
  await client.expire(key, PLAN_TTL_SECONDS)
}

export async function getContestedCovered(runId: string): Promise<Set<string>> {
  const client = await getRedisClient()
  const key = `plan:run:${runId}:contested`
  const members = await client.smembers(key)
  return new Set(members)
}


