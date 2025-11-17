/**
 * In-memory ring buffer for discovery events
 * Used by status endpoint to show recent activity
 */

export interface DiscoveryEvent {
  ts?: string
  level?: string
  step?: string
  result?: string
  err_code?: string
  job_id?: string
  run_id?: string
  [key: string]: unknown
}

const ring: DiscoveryEvent[] = []
const MAX_SIZE = 500

export function pushEvent(e: DiscoveryEvent): void {
  // Ensure ts and level are set if missing
  const event: DiscoveryEvent = {
    ts: new Date().toISOString(),
    level: 'info',
    ...e,
  }
  ring.push(event)
  if (ring.length > MAX_SIZE) {
    ring.shift()
  }
}

export function getEventsForRun(runId: string): DiscoveryEvent[] {
  return ring.filter((e) => e?.run_id === runId).slice(-100)
}

export function getAllEvents(): DiscoveryEvent[] {
  return ring.slice()
}

export function getEventCounts(): Record<string, number> {
  return ring.reduce((acc: Record<string, number>, e: DiscoveryEvent) => {
    const k = `${e.step || 'unknown'}:${e.result || 'n/a'}`
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
}

