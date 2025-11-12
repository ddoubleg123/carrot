/**
 * Redis utilities for discovery pipeline
 * Manages seen URLs, content hashes, frontier queue, and active runs
 */

import Redis from 'ioredis'
import { resolvePatch, SHADOW_SENTINEL, PatchKeyParts } from './keys'

let redisClient: Redis | null = null

const RUN_METRICS_KEY = (runId: string) => `discovery:metrics:run:${runId}`
const PATCH_METRICS_KEY = (patchId: string) => {
  const { id, shadow } = resolvePatch(patchId)
  return shadow ? `discovery:shadow:metrics:patch:${id}` : `discovery:metrics:patch:${id}`
}
const RUN_STATE_KEY = (patchId: string) => {
  const { id, shadow } = resolvePatch(patchId)
  return shadow ? `discovery:shadow:run_state:${id}` : `run_state:${id}`
}

const SEEN_KEY = (patchId: string) => {
  const { id, shadow } = resolvePatch(patchId)
  return shadow ? `discovery:shadow:seen:${id}` : `seen:patch:${id}`
}

const HASHES_KEY = (patchId: string) => {
  const { id, shadow } = resolvePatch(patchId)
  return shadow ? `discovery:shadow:hashes:${id}` : `hashes:patch:${id}`
}

const FRONTIER_KEY = (patchId: string) => {
  const { id, shadow } = resolvePatch(patchId)
  return shadow ? `discovery:shadow:frontier:${id}` : `frontier:patch:${id}`
}

const COUNTER_KEY = (patchId: string) => {
  const { id, shadow } = resolvePatch(patchId)
  return shadow ? `discovery:shadow:counters:${id}` : `discovery:counters:${id}`
}

const ACTIVE_RUN_KEY = (patchId: string) => {
  const { id, shadow } = resolvePatch(patchId)
  return shadow ? `discovery:shadow:run:patch:${id}` : `run:patch:${id}`
}

const WIKI_REFS_KEY = (patchId: string) => {
  const { id, shadow } = resolvePatch(patchId)
  return shadow ? `discovery:shadow:wiki:refs:${id}` : `wiki:refs:${id}`
}

const AUDIT_KEY = (patchId: string) => {
  const { id, shadow } = resolvePatch(patchId)
  return shadow ? `discovery:shadow:audit:patch:${id}` : `audit:patch:${id}`
}

const SUCCESS_RATE_KEY = (patchId: string) => {
  const { id, shadow } = resolvePatch(patchId)
  return shadow ? `discovery:shadow:success:${id}` : `discovery:success:${id}`
}

const ZERO_SAVE_KEY = (patchId: string) => {
  const { id, shadow } = resolvePatch(patchId)
  return shadow ? `discovery:shadow:zero_save:${id}` : `discovery:zero_save:${id}`
}

const OPERATOR_LOG_KEY = (patchId: string) => {
  const { id, shadow } = resolvePatch(patchId)
  return shadow ? `discovery:shadow:operator_actions:${id}` : `discovery:operator_actions:${id}`
}

const PAYWALL_BRANCH_KEY = (patchId: string) => {
  const { id, shadow } = resolvePatch(patchId)
  return shadow ? `discovery:shadow:paywall:${id}` : `discovery:paywall:${id}`
}
const METRICS_TTL_SECONDS = 60 * 60 * 6

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
  const key = SEEN_KEY(patchId)
  const result = await client.sismember(key, canonicalUrl)
  return result === 1
}

/**
 * Mark URL as seen for this patch
 */
export async function markAsSeen(patchId: string, canonicalUrl: string, ttlDays: number = 30): Promise<void> {
  const client = await getRedisClient()
  const key = SEEN_KEY(patchId)
  await client.sadd(key, canonicalUrl)
  await client.expire(key, ttlDays * 24 * 60 * 60)
}

/**
 * Check if content hash is near-duplicate (SimHash)
 */
export async function isNearDuplicate(patchId: string, contentHash: string, threshold: number = 7): Promise<boolean> {
  const client = await getRedisClient()
  const key = HASHES_KEY(patchId)

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
  const key = HASHES_KEY(patchId)
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
 * Frontier helpers
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

export async function addToFrontier(patchId: string, item: FrontierItem): Promise<void> {
  const client = await getRedisClient()
  const key = FRONTIER_KEY(patchId)
  const value = JSON.stringify(item)
  await client.zadd(key, item.priority, value)

  const count = await client.zcard(key)
  if (count > 2000) {
    await client.zremrangebyrank(key, 0, count - 2000)
  }
}

export async function popFromFrontier(patchId: string): Promise<FrontierItem | null> {
  const client = await getRedisClient()
  const key = FRONTIER_KEY(patchId)
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
  await client.del(FRONTIER_KEY(patchId))
}

export async function frontierSize(patchId: string): Promise<number> {
  const client = await getRedisClient()
  return client.zcard(FRONTIER_KEY(patchId))
}

/**
 * Controversy / history counters
 */
export interface SaveCounterDelta {
  total?: number
  controversy?: number
  history?: number
}

export async function incrementSaveCounters(patchId: string, delta: SaveCounterDelta): Promise<void> {
  const client = await getRedisClient()
  const key = COUNTER_KEY(patchId)
  const multi = client.multi()
  if (delta.total) multi.hincrby(key, 'total', delta.total)
  if (delta.controversy) multi.hincrby(key, 'controversy', delta.controversy)
  if (delta.history) multi.hincrby(key, 'history', delta.history)
  multi.expire(key, 60 * 60 * 6)
  await multi.exec()
}

export interface SaveCounters {
  total: number
  controversy: number
  history: number
}

export interface SuccessRateRecord {
  ema: number
  updatedAt: number
}

export interface ZeroSaveDiagnostics {
  status: 'ok' | 'warning' | 'paused'
  attempts: number
  issuedAt: string
  reason?: string
}

export async function getSaveCounters(patchId: string): Promise<SaveCounters> {
  const client = await getRedisClient()
  const key = COUNTER_KEY(patchId)
  const [total, controversy, history] = await client.hmget(key, 'total', 'controversy', 'history')
  return {
    total: Number(total ?? 0),
    controversy: Number(controversy ?? 0),
    history: Number(history ?? 0)
  }
}

export async function clearSaveCounters(patchId: string): Promise<void> {
  const client = await getRedisClient()
  await client.del(COUNTER_KEY(patchId))
}

export async function getSuccessRates(patchId: string): Promise<Record<string, SuccessRateRecord>> {
  const client = await getRedisClient()
  const key = SUCCESS_RATE_KEY(patchId)
  const entries = await client.hgetall(key)
  const result: Record<string, SuccessRateRecord> = {}
  Object.entries(entries).forEach(([host, value]) => {
    try {
      const parsed = JSON.parse(value) as SuccessRateRecord
      if (typeof parsed?.ema === 'number' && typeof parsed?.updatedAt === 'number') {
        result[host] = parsed
      }
    } catch {
      // ignore malformed entries
    }
  })
  return result
}

export async function setSuccessRate(patchId: string, host: string, stats: SuccessRateRecord): Promise<void> {
  if (!host) return
  const client = await getRedisClient()
  const key = SUCCESS_RATE_KEY(patchId)
  await client.hset(key, host, JSON.stringify(stats))
  await client.expire(key, 14 * 24 * 60 * 60)
}

export async function clearSuccessRates(patchId: string): Promise<void> {
  const client = await getRedisClient()
  await client.del(SUCCESS_RATE_KEY(patchId))
}

/**
 * Active run helpers
 */
export async function setActiveRun(patchId: string, runId: string): Promise<void> {
  const client = await getRedisClient()
  const key = ACTIVE_RUN_KEY(patchId)
  await client
    .multi()
    .setex(key, 3600, runId)
    .set(RUN_STATE_KEY(patchId), 'live')
    .exec()
}

export async function getActiveRun(patchId: string): Promise<string | null> {
  const client = await getRedisClient()
  const key = ACTIVE_RUN_KEY(patchId)
  const result = await client.get(key)
  return result
}

export async function clearActiveRun(patchId: string): Promise<void> {
  const client = await getRedisClient()
  const key = ACTIVE_RUN_KEY(patchId)
  await client
    .multi()
    .del(key)
    .del(RUN_STATE_KEY(patchId))
    .exec()
}

/**
 * Wikipedia references cache helpers
 */
export async function cacheWikiRefs(patchId: string, refs: string[]): Promise<void> {
  const client = await getRedisClient()
  const key = WIKI_REFS_KEY(patchId)
  await client.setex(key, 24 * 60 * 60, JSON.stringify(refs))
}

export async function getCachedWikiRefs(patchId: string): Promise<string[] | null> {
  const client = await getRedisClient()
  const key = WIKI_REFS_KEY(patchId)
  const result = await client.get(key)
  if (result) {
    return JSON.parse(result)
  }
  return null
}

/**
 * Audit helpers
 */
export async function pushAuditEvent(patchId: string, event: any, cap: number = 2000): Promise<void> {
  const client = await getRedisClient()
  const key = AUDIT_KEY(patchId)
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
  const key = AUDIT_KEY(patchId)
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

export async function pushPaywallBranch(patchId: string, branch: string): Promise<void> {
  const client = await getRedisClient()
  const key = PAYWALL_BRANCH_KEY(patchId)
  await client.lpush(key, branch)
  await client.ltrim(key, 0, 99)
  await client.expire(key, 60 * 60 * 6)
}

export async function getPaywallBranches(patchId: string, limit = 20): Promise<string[]> {
  const client = await getRedisClient()
  const key = PAYWALL_BRANCH_KEY(patchId)
  return client.lrange(key, 0, Math.max(0, limit - 1))
}

/**
 * Planner guide cache helpers
 */
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

export async function setRunState(patchId: string, state: 'live' | 'suspended' | 'paused'): Promise<void> {
  const client = await getRedisClient()
  await client.set(RUN_STATE_KEY(patchId), state)
}

export async function getRunState(patchId: string): Promise<'live' | 'suspended' | 'paused' | null> {
  const client = await getRedisClient()
  const state = await client.get(RUN_STATE_KEY(patchId))
  if (state === 'live' || state === 'suspended' || state === 'paused') {
    return state
  }
  return null
}

export async function setZeroSaveDiagnostics(patchId: string, payload: ZeroSaveDiagnostics): Promise<void> {
  const client = await getRedisClient()
  const key = ZERO_SAVE_KEY(patchId)
  await client.setex(key, 60 * 30, JSON.stringify(payload))
}

export async function getZeroSaveDiagnostics(patchId: string): Promise<ZeroSaveDiagnostics | null> {
  const client = await getRedisClient()
  const key = ZERO_SAVE_KEY(patchId)
  const value = await client.get(key)
  if (!value) return null
  try {
    return JSON.parse(value) as ZeroSaveDiagnostics
  } catch {
    return null
  }
}

export async function clearZeroSaveDiagnostics(patchId: string): Promise<void> {
  const client = await getRedisClient()
  await client.del(ZERO_SAVE_KEY(patchId))
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

const HERO_RETRY_KEY = 'hero:retry:queue'

export interface HeroRetryPayload {
  patchId: string
  runId: string
  url: string
  title: string
  createdAt?: string
}

export async function enqueueHeroRetry(payload: HeroRetryPayload): Promise<void> {
  const client = await getRedisClient()
  const entry = JSON.stringify({
    ...payload,
    createdAt: payload.createdAt ?? new Date().toISOString()
  })
  await client.lpush(HERO_RETRY_KEY, entry)
  await client.ltrim(HERO_RETRY_KEY, 0, 499)
  await client.expire(HERO_RETRY_KEY, PLAN_TTL_SECONDS)
}

export interface RunMetricsSnapshot {
  runId: string
  patchId: string
  status: 'running' | 'completed' | 'error' | 'suspended'
  timestamp: string
  metrics: Record<string, any>
}

export async function storeRunMetricsSnapshot(snapshot: RunMetricsSnapshot): Promise<void> {
  const client = await getRedisClient()
  const payload = JSON.stringify(snapshot)
  await client
    .multi()
    .setex(RUN_METRICS_KEY(snapshot.runId), METRICS_TTL_SECONDS, payload)
    .setex(PATCH_METRICS_KEY(snapshot.patchId), METRICS_TTL_SECONDS, payload)
    .exec()
}

export async function getRunMetricsSnapshot(runId: string): Promise<RunMetricsSnapshot | null> {
  const client = await getRedisClient()
  const raw = await client.get(RUN_METRICS_KEY(runId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as RunMetricsSnapshot
  } catch (error) {
    console.warn('[Redis] Failed to parse run metrics snapshot', error)
    return null
  }
}

export async function getPatchMetricsSnapshot(patchId: string): Promise<RunMetricsSnapshot | null> {
  const client = await getRedisClient()
  const raw = await client.get(PATCH_METRICS_KEY(patchId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as RunMetricsSnapshot
  } catch (error) {
    console.warn('[Redis] Failed to parse patch metrics snapshot', error)
    return null
  }
}
