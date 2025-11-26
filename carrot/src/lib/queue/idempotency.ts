/**
 * Queue idempotency across restarts
 * Persist jobId = sha256(patchId|canonicalUrl) and set removeOnComplete: true, removeOnFail: false
 * to keep DLQ introspectable
 */

import { createHash } from 'crypto'

/**
 * Generate idempotent job ID from patchId and canonicalUrl
 * Format: sha256(patchId|canonicalUrl)
 */
export function generateJobId(patchId: string, canonicalUrl: string): string {
  const input = `${patchId}|${canonicalUrl}`
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Queue configuration for idempotency
 * removeOnComplete: true - removes completed jobs to save memory
 * removeOnFail: false - keeps failed jobs in DLQ for inspection
 */
export const QUEUE_IDEMPOTENCY_CONFIG = {
  removeOnComplete: {
    age: 3600, // Keep completed jobs for 1 hour
    count: 1000 // Keep last 1000 completed jobs
  },
  removeOnFail: false, // Never remove failed jobs (keep in DLQ)
  attempts: 3, // Retry failed jobs up to 3 times
  backoff: {
    type: 'exponential' as const,
    delay: 2000 // Start with 2s delay, exponential backoff
  }
}

