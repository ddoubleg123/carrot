/**
 * Structured logging for enrichment pipeline
 * Emits JSON logs with stage, patchSlug, id, url, status, ms
 * Includes PII redaction
 */

import { sanitizeLogEntry } from '@/lib/logging/redact'
import { getCounterStats } from '@/lib/counters/dbTruth'

export interface EnrichmentLog {
  ts?: number // Optional, defaults to Date.now()
  stage: 'search' | 'save' | 'enrich' | 'hero' | 'image' | 'fe'
  patchSlug?: string
  patchId?: string
  id?: string
  url?: string
  status: 'ok' | 'warn' | 'error'
  ms?: number
  errorCode?: string
  errorMessage?: string
  [key: string]: any
}

/**
 * Emit structured log with PII redaction
 */
export function logEnrichment(log: EnrichmentLog): void {
  const logEntry = {
    ...log,
    ts: log.ts || Date.now()
  }
  
  // Sanitize log entry before output (redacts sensitive data)
  const sanitized = sanitizeLogEntry(logEntry)
  console.log(JSON.stringify(sanitized))
}

/**
 * Get current counters from DB truth (not run aggregates)
 */
export async function getCounters(patchId?: string) {
  return await getCounterStats(patchId)
}

/**
 * Reset counters (deprecated - counters now come from DB)
 * Kept for backward compatibility
 */
export function resetCounters() {
  console.warn('[Logger] resetCounters() is deprecated - counters now come from DB truth')
}

