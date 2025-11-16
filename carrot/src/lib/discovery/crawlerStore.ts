/**
 * In-memory store for crawler run summaries
 * In production, consider using Redis or database for persistence
 */

export interface RunSummary {
  id: string
  runId: string
  patchId?: string
  status: 'ok' | 'fail'
  startedAt: string
  completedAt: string
  meta: {
    attempts: {
      total: number
      byStep: Record<string, number>
    }
    duplicates: number
    itemsSaved: number
    errorsByCode: Record<string, number>
  }
  error?: {
    code: string
    msg: string
  }
}

const runSummaries = new Map<string, RunSummary>()

/**
 * Store a run summary
 */
export function storeRunSummary(runId: string, summary: RunSummary): void {
  runSummaries.set(runId, summary)
  // Keep only last 100 runs in memory
  if (runSummaries.size > 100) {
    const firstKey = runSummaries.keys().next().value
    if (firstKey) {
      runSummaries.delete(firstKey)
    }
  }
}

/**
 * Get a run summary by ID
 */
export function getRunSummary(runId: string): RunSummary | undefined {
  return runSummaries.get(runId)
}

/**
 * Get all run summaries (for debugging)
 */
export function getAllRunSummaries(): RunSummary[] {
  return Array.from(runSummaries.values())
}
