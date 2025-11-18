/**
 * Redis-based queues for crawler
 * Phase 3: Queue System
 * - discovery_queue: URLs to fetch with priority scores
 * - extraction_queue: page_id to extract via LLM
 */

import Redis from 'ioredis'
import { PriorityScore } from './priority'
import { hashUrl } from './utils'

let redisClient: Redis | null = null

const DISCOVERY_QUEUE_KEY = 'crawler:discovery:queue'
const EXTRACTION_QUEUE_KEY = 'crawler:extraction:queue'
const DISCOVERY_DLQ_KEY = 'crawler:discovery:dlq' // Dead-letter queue
const EXTRACTION_DLQ_KEY = 'crawler:extraction:dlq'

interface QueuedUrl {
  url: string
  urlHash: string
  priority: number
  topic: string
  sourceUrl?: string // URL that linked to this
  attemptCount?: number
  lastAttemptAt?: number
  metadata?: Record<string, unknown>
}

interface QueuedExtraction {
  pageId: string
  topic: string
  sourceUrl: string
  attemptCount?: number
  lastAttemptAt?: number
}

async function getRedisClient(): Promise<Redis> {
  if (!redisClient) {
    const url = process.env.REDIS_URL
    if (!url) {
      throw new Error('REDIS_URL must be set for crawler queues')
    }
    const parsed = new URL(url)
    const isTls = parsed.protocol === 'rediss:'
    redisClient = new Redis({
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : undefined,
      username: parsed.username || undefined,
      password: parsed.password || undefined,
      lazyConnect: false,
      connectTimeout: 10_000,
      enableReadyCheck: false,
      keepAlive: 30_000,
      retryStrategy(times) {
        const delay = Math.min(times * 500, 5_000)
        return delay
      },
      tls: isTls
        ? {
            rejectUnauthorized: false, // For Render/Valkey compatibility
          }
        : undefined,
    })
  }
  return redisClient
}

/**
 * Enqueue URL to discovery queue with priority score
 * Uses Redis sorted set (ZADD) for priority ordering
 */
export async function enqueueDiscoveryUrl(
  url: string,
  priority: number,
  topic: string,
  options: {
    sourceUrl?: string
    attemptCount?: number
    metadata?: Record<string, unknown>
  } = {}
): Promise<void> {
  const client = await getRedisClient()
  const urlHash = hashUrl(url)
  
  const item: QueuedUrl = {
    url,
    urlHash,
    priority,
    topic,
    sourceUrl: options.sourceUrl,
    attemptCount: options.attemptCount || 0,
    lastAttemptAt: Date.now(),
    metadata: options.metadata,
  }
  
  // Use sorted set: score = priority (higher = better), member = JSON string
  // Negative priority so higher priority items come first (Redis ZREVRANGE)
  await client.zadd(DISCOVERY_QUEUE_KEY, priority, JSON.stringify(item))
}

/**
 * Dequeue highest priority URL from discovery queue
 * Returns null if queue is empty
 */
export async function dequeueDiscoveryUrl(): Promise<QueuedUrl | null> {
  const client = await getRedisClient()
  
  // Get highest priority item (ZREVRANGE with limit 1)
  const results = await client.zrevrange(DISCOVERY_QUEUE_KEY, 0, 0)
  if (results.length === 0) {
    return null
  }
  
  const item = JSON.parse(results[0]) as QueuedUrl
  
  // Remove from queue (atomic operation)
  await client.zrem(DISCOVERY_QUEUE_KEY, results[0])
  
  return item
}

/**
 * Get discovery queue depth
 */
export async function getDiscoveryQueueDepth(): Promise<number> {
  const client = await getRedisClient()
  return await client.zcard(DISCOVERY_QUEUE_KEY)
}

/**
 * Move failed URL to dead-letter queue with reason
 */
export async function moveToDiscoveryDLQ(
  url: string,
  reasonCode: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const client = await getRedisClient()
  const urlHash = hashUrl(url)
  
  const dlqItem = {
    url,
    urlHash,
    reasonCode,
    failedAt: Date.now(),
    metadata,
  }
  
  await client.lpush(DISCOVERY_DLQ_KEY, JSON.stringify(dlqItem))
  // Keep DLQ size manageable (last 1000 items)
  await client.ltrim(DISCOVERY_DLQ_KEY, 0, 999)
}

/**
 * Enqueue page for LLM extraction
 */
export async function enqueueExtraction(
  pageId: string,
  topic: string,
  sourceUrl: string,
  options: {
    attemptCount?: number
  } = {}
): Promise<void> {
  const client = await getRedisClient()
  
  const item: QueuedExtraction = {
    pageId,
    topic,
    sourceUrl,
    attemptCount: options.attemptCount || 0,
    lastAttemptAt: Date.now(),
  }
  
  // Use simple list (FIFO) for extraction queue
  await client.lpush(EXTRACTION_QUEUE_KEY, JSON.stringify(item))
}

/**
 * Dequeue page for extraction
 * Returns null if queue is empty
 */
export async function dequeueExtraction(): Promise<QueuedExtraction | null> {
  const client = await getRedisClient()
  
  // Blocking pop with 1 second timeout (BRPOP)
  const result = await client.brpop(EXTRACTION_QUEUE_KEY, 1)
  if (!result || result.length < 2) {
    return null
  }
  
  return JSON.parse(result[1]) as QueuedExtraction
}

/**
 * Get extraction queue depth
 */
export async function getExtractionQueueDepth(): Promise<number> {
  const client = await getRedisClient()
  return await client.llen(EXTRACTION_QUEUE_KEY)
}

/**
 * Move failed extraction to dead-letter queue
 */
export async function moveToExtractionDLQ(
  pageId: string,
  reasonCode: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const client = await getRedisClient()
  
  const dlqItem = {
    pageId,
    reasonCode,
    failedAt: Date.now(),
    metadata,
  }
  
  await client.lpush(EXTRACTION_DLQ_KEY, JSON.stringify(dlqItem))
  await client.ltrim(EXTRACTION_DLQ_KEY, 0, 999)
}

/**
 * Retry with exponential backoff
 * Calculate delay: baseDelay * (2 ^ attemptCount) + jitter
 */
export function calculateBackoffDelay(attemptCount: number, baseDelayMs: number = 1000): number {
  const exponential = baseDelayMs * Math.pow(2, attemptCount)
  const jitter = Math.random() * 0.3 * exponential // 0-30% jitter
  return Math.min(exponential + jitter, 300_000) // Cap at 5 minutes
}

/**
 * Re-enqueue with backoff (for retries)
 */
export async function requeueDiscoveryWithBackoff(
  url: string,
  priority: number,
  topic: string,
  attemptCount: number,
  options: {
    sourceUrl?: string
    metadata?: Record<string, unknown>
  } = {}
): Promise<void> {
  const delay = calculateBackoffDelay(attemptCount)
  
  // Re-enqueue with reduced priority (penalty for retries)
  const retryPriority = priority - (attemptCount * 10)
  
  setTimeout(async () => {
    await enqueueDiscoveryUrl(url, Math.max(0, retryPriority), topic, {
      ...options,
      attemptCount: attemptCount + 1,
    })
  }, delay)
}

export async function requeueExtractionWithBackoff(
  pageId: string,
  topic: string,
  sourceUrl: string,
  attemptCount: number
): Promise<void> {
  const delay = calculateBackoffDelay(attemptCount)
  
  setTimeout(async () => {
    await enqueueExtraction(pageId, topic, sourceUrl, {
      attemptCount: attemptCount + 1,
    })
  }, delay)
}

