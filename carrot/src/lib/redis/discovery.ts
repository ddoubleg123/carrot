/**
 * Redis utilities for discovery pipeline
 * Manages seen URLs, content hashes, frontier queue, and active runs
 */

import Redis from 'ioredis'

let redisClient: Redis | null = null

async function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis(
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    })
    
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
export async function addToFrontier(patchId: string, item: { provider: string, query: string, cursor: string, priority: number }): Promise<void> {
  const client = await getRedisClient()
  const key = `frontier:patch:${patchId}`
  
  const value = JSON.stringify({ provider: item.provider, query: item.query, cursor: item.cursor })
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
export async function popFromFrontier(patchId: string): Promise<{ provider: string, query: string, cursor: string } | null> {
  const client = await getRedisClient()
  const key = `frontier:patch:${patchId}`
  
  const results = await client.zrevrange(key, 0, 0)
  if (results.length === 0) {
    return null
  }
  
  const item = JSON.parse(results[0])
  await client.zrem(key, results[0])
  
  return item
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
  return result === 1
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

