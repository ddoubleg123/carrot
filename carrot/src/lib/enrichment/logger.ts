/**
 * Structured logging for enrichment pipeline
 * Emits JSON logs with stage, patchSlug, id, url, status, ms
 */

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

const counters = {
  itemsReturned: 0,
  heroesCreated: 0,
  imageFallbacks: 0,
  enrich404: 0,
  dbMigrateErrors: 0
}

/**
 * Emit structured log
 */
export function logEnrichment(log: EnrichmentLog): void {
  const logEntry = {
    ...log,
    ts: log.ts || Date.now()
  }
  console.log(JSON.stringify(logEntry))
  
  // Update counters
  if (log.stage === 'hero' && log.status === 'ok') {
    counters.heroesCreated++
  }
  if (log.stage === 'image' && log.status === 'warn') {
    counters.imageFallbacks++
  }
  if (log.status === 'error' && log.errorCode === 'ENRICH_404') {
    counters.enrich404++
  }
}

/**
 * Get current counters
 */
export function getCounters() {
  return { ...counters }
}

/**
 * Reset counters (for testing)
 */
export function resetCounters() {
  counters.itemsReturned = 0
  counters.heroesCreated = 0
  counters.imageFallbacks = 0
  counters.enrich404 = 0
  counters.dbMigrateErrors = 0
}

