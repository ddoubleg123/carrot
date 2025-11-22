/**
 * Discovery Telemetry System
 * Tracks metrics for all discovery pipeline steps
 */

import { incrementSaveCounters } from '@/lib/redis/discovery'

export interface TelemetryMetrics {
  processed: number
  duplicates: number
  paywallBlocked: number
  extractOk: number
  relevanceFail: number
  persistOk: number
  skipped: number
}

export class DiscoveryTelemetry {
  private patchId: string
  private runId?: string
  private metrics: TelemetryMetrics = {
    processed: 0,
    duplicates: 0,
    paywallBlocked: 0,
    extractOk: 0,
    relevanceFail: 0,
    persistOk: 0,
    skipped: 0
  }

  constructor(patchId: string, runId?: string) {
    this.patchId = patchId
    this.runId = runId
  }

  /**
   * Record a processed item
   */
  recordProcessed() {
    this.metrics.processed++
    this.syncToRedis()
  }

  /**
   * Record a duplicate
   */
  recordDuplicate() {
    this.metrics.duplicates++
    this.syncToRedis()
  }

  /**
   * Record paywall blocked
   */
  recordPaywallBlocked() {
    this.metrics.paywallBlocked++
    this.syncToRedis()
  }

  /**
   * Record successful extraction
   */
  recordExtractOk() {
    this.metrics.extractOk++
    this.syncToRedis()
  }

  /**
   * Record relevance failure
   */
  recordRelevanceFail() {
    this.metrics.relevanceFail++
    this.syncToRedis()
  }

  /**
   * Record successful persist
   */
  recordPersistOk() {
    this.metrics.persistOk++
    this.syncToRedis()
  }

  /**
   * Record skipped item
   */
  recordSkipped() {
    this.metrics.skipped++
    this.syncToRedis()
  }

  /**
   * Get current metrics
   */
  getMetrics(): TelemetryMetrics {
    return { ...this.metrics }
  }

  /**
   * Sync metrics to Redis
   */
  private async syncToRedis() {
    try {
      // Store detailed metrics in Redis hash
      const { getRedisClient } = await import('@/lib/redis/discovery')
      const client = await getRedisClient()
      const key = `discovery:telemetry:${this.patchId}${this.runId ? `:${this.runId}` : ''}`
      
      await client.hset(key, {
        processed: String(this.metrics.processed),
        duplicates: String(this.metrics.duplicates),
        paywallBlocked: String(this.metrics.paywallBlocked),
        extractOk: String(this.metrics.extractOk),
        relevanceFail: String(this.metrics.relevanceFail),
        persistOk: String(this.metrics.persistOk),
        skipped: String(this.metrics.skipped),
        updatedAt: String(Date.now())
      })
      
      // Set TTL (6 hours)
      await client.expire(key, 60 * 60 * 6)
      
      // Also update legacy counters for backward compatibility
      await incrementSaveCounters(this.patchId, {
        total: this.metrics.persistOk
      })
    } catch (error) {
      console.warn('[Telemetry] Failed to sync to Redis:', error)
    }
  }

  /**
   * Get telemetry for a patch
   */
  static async getTelemetry(patchId: string, runId?: string): Promise<TelemetryMetrics | null> {
    try {
      const { getRedisClient } = await import('@/lib/redis/discovery')
      const client = await getRedisClient()
      const key = `discovery:telemetry:${patchId}${runId ? `:${runId}` : ''}`
      
      const data = await client.hgetall(key)
      if (!data || Object.keys(data).length === 0) {
        return null
      }
      
      return {
        processed: Number(data.processed || '0'),
        duplicates: Number(data.duplicates || '0'),
        paywallBlocked: Number(data.paywallBlocked || '0'),
        extractOk: Number(data.extractOk || '0'),
        relevanceFail: Number(data.relevanceFail || '0'),
        persistOk: Number(data.persistOk || '0'),
        skipped: Number(data.skipped || '0')
      }
    } catch (error) {
      console.warn('[Telemetry] Failed to get telemetry:', error)
      return null
    }
  }

  /**
   * Get aggregated telemetry across all runs for a patch
   */
  static async getAggregatedTelemetry(patchId: string): Promise<TelemetryMetrics> {
    try {
      const { getRedisClient } = await import('@/lib/redis/discovery')
      const client = await getRedisClient()
      const pattern = `discovery:telemetry:${patchId}:*`
      
      const keys = await client.keys(pattern)
      if (keys.length === 0) {
        return {
          processed: 0,
          duplicates: 0,
          paywallBlocked: 0,
          extractOk: 0,
          relevanceFail: 0,
          persistOk: 0,
          skipped: 0
        }
      }
      
      // Aggregate across all runs
      const aggregated: TelemetryMetrics = {
        processed: 0,
        duplicates: 0,
        paywallBlocked: 0,
        extractOk: 0,
        relevanceFail: 0,
        persistOk: 0,
        skipped: 0
      }
      
      for (const key of keys) {
        const data = await client.hgetall(key)
        aggregated.processed += Number(data.processed || '0')
        aggregated.duplicates += Number(data.duplicates || '0')
        aggregated.paywallBlocked += Number(data.paywallBlocked || '0')
        aggregated.extractOk += Number(data.extractOk || '0')
        aggregated.relevanceFail += Number(data.relevanceFail || '0')
        aggregated.persistOk += Number(data.persistOk || '0')
        aggregated.skipped += Number(data.skipped || '0')
      }
      
      return aggregated
    } catch (error) {
      console.warn('[Telemetry] Failed to get aggregated telemetry:', error)
      return {
        processed: 0,
        duplicates: 0,
        paywallBlocked: 0,
        extractOk: 0,
        relevanceFail: 0,
        persistOk: 0,
        skipped: 0
      }
    }
  }
}

/**
 * Structured logging helper for discovery steps
 */
export function logDiscoveryStep(
  step: string,
  status: 'ok' | 'fail' | 'skip',
  data: Record<string, any>,
  patchId: string,
  runId?: string
) {
  const { slog } = require('@/lib/log')
  const logObj = {
    step: 'discovery',
    msg: step,
    status,
    job_id: patchId,
    run_id: runId,
    ...data,
    timestamp: new Date().toISOString()
  }
  
  if (status === 'ok') {
    slog('info', logObj)
  } else if (status === 'fail') {
    slog('error', logObj)
  } else {
    slog('warn', logObj)
  }
}

