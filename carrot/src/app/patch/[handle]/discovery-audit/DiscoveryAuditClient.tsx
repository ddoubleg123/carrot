'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface AuditEvent {
  id?: string
  runId: string
  patchId: string
  step: string
  status: 'pending' | 'ok' | 'fail'
  provider?: string | null
  query?: string | null
  candidateUrl?: string | null
  finalUrl?: string | null
  http?: any
  meta?: any
  rulesHit?: any
  scores?: any
  decisions?: any
  hashes?: any
  synthesis?: any
  hero?: any
  timings?: any
  error?: any
  createdAt?: string
  updatedAt?: string
  ts?: string
}

interface ApiResponse {
  items: AuditEvent[]
  cursor: number
  hasMore: boolean
}

interface DiscoveryAuditClientProps {
  handle: string
}

const PAGE_SIZE = 200

function normaliseEvent(raw: AuditEvent): AuditEvent {
  if (!raw) {
    return raw
  }
  if (!raw.createdAt && raw.ts) {
    return { ...raw, createdAt: raw.ts }
  }
  return raw
}

function eventKey(event: AuditEvent): string {
  if (event.id) return event.id
  const time = event.createdAt || event.ts || ''
  const url = event.candidateUrl || event.finalUrl || event.query || ''
  return `${event.runId}:${event.step}:${event.status}:${url}:${time}`
}

function formatTime(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function computeStats(events: AuditEvent[]) {
  const counters = events.reduce(
    (acc, event) => {
      acc.total++
      acc.byStatus[event.status] = (acc.byStatus[event.status] ?? 0) + 1
      acc.byStep[event.step] = (acc.byStep[event.step] ?? 0) + 1
      if (event.status === 'ok' && event.step === 'save') {
        acc.saved++
      }
      if (event.status === 'fail') {
        acc.failures++
      }
      if (event.status === 'ok') {
        acc.successes++
      }
      return acc
    },
    {
      total: 0,
      saved: 0,
      successes: 0,
      failures: 0,
      byStatus: {} as Record<string, number>,
      byStep: {} as Record<string, number>
    }
  )

  return counters
}

function downloadNdjson(handle: string, events: AuditEvent[]) {
  const ndjson = events.map((event) => JSON.stringify(event)).join('\n')
  const blob = new Blob([ndjson], { type: 'application/x-ndjson' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `discovery-audit-${handle}-${Date.now()}.ndjson`
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function DiscoveryAuditClient({ handle }: DiscoveryAuditClientProps) {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [cursor, setCursor] = useState<number>(0)
  const [hasMore, setHasMore] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isFetchingMore, setIsFetchingMore] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedEventKey, setSelectedEventKey] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [stepFilter, setStepFilter] = useState<string>('all')
  const [autoScroll, setAutoScroll] = useState<boolean>(true)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (statusFilter !== 'all' && event.status !== statusFilter) {
        return false
      }
      if (stepFilter !== 'all' && event.step !== stepFilter) {
        return false
      }
      return true
    })
  }, [events, statusFilter, stepFilter])

  const stats = useMemo(() => computeStats(events), [events])
  const uniqueSteps = useMemo(() => Array.from(new Set(events.map((event) => event.step))).sort(), [events])

  const loadInitial = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const res = await fetch(`/api/patches/${handle}/audit?limit=${PAGE_SIZE}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data: ApiResponse = await res.json()
      const normalised = data.items.map(normaliseEvent)
      const keys = new Set<string>()
      const deduped: AuditEvent[] = []
      for (const item of normalised) {
        const key = eventKey(item)
        if (!keys.has(key)) {
          keys.add(key)
          deduped.push(item)
        }
      }
      setEvents(deduped)
      setCursor(data.cursor)
      setHasMore(data.hasMore)
      if (deduped.length > 0) {
        setSelectedEventKey(eventKey(deduped[0]))
      }
    } catch (err: any) {
      console.error('[Discovery Audit] Failed to load audit trail', err)
      setError(err?.message || 'Failed to load audit trail')
    } finally {
      setIsLoading(false)
    }
  }, [handle])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  const loadMore = useCallback(async () => {
    if (!hasMore || isFetchingMore) {
      return
    }
    try {
      setIsFetchingMore(true)
      const res = await fetch(`/api/patches/${handle}/audit?limit=${PAGE_SIZE}&cursor=${cursor}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data: ApiResponse = await res.json()
      const newItems = data.items.map(normaliseEvent)
      setEvents((prev) => {
        const existingKeys = new Set(prev.map(eventKey))
        const merged = [...prev]
        for (const item of newItems) {
          const key = eventKey(item)
          if (!existingKeys.has(key)) {
            existingKeys.add(key)
            merged.push(item)
          }
        }
        return merged
      })
      setCursor(data.cursor)
      setHasMore(data.hasMore)
    } catch (err: any) {
      console.error('[Discovery Audit] Failed to load more audit events', err)
      setError(err?.message || 'Failed to load more audit events')
    } finally {
      setIsFetchingMore(false)
    }
  }, [cursor, handle, hasMore, isFetchingMore])

  useEffect(() => {
    if (!handle) return

    const source = new EventSource(`/api/patches/${handle}/audit/stream`)
    eventSourceRef.current = source

    source.onmessage = (event) => {
      try {
        const payload: AuditEvent = normaliseEvent(JSON.parse(event.data))
        setEvents((prev) => {
          const key = eventKey(payload)
          if (prev.some((existing) => eventKey(existing) === key)) {
            return prev
          }
          const updated = [payload, ...prev]
          const maxSize = 1000
          if (updated.length > maxSize) {
            return updated.slice(0, maxSize)
          }
          return updated
        })
      } catch (err) {
        console.error('[Discovery Audit] Failed to parse SSE payload', err)
      }
    }

    source.onerror = (err) => {
      console.error('[Discovery Audit] SSE error', err)
    }

    return () => {
      source.close()
      eventSourceRef.current = null
    }
  }, [handle])

  useEffect(() => {
    if (!autoScroll) return
    const container = scrollContainerRef.current
    if (!container) return
    container.scrollTo({ top: 0, behavior: 'smooth' })
  }, [filteredEvents, autoScroll])

  const selectedEvent = useMemo(() => {
    if (!selectedEventKey) return null
    return events.find((event) => eventKey(event) === selectedEventKey) || null
  }, [events, selectedEventKey])

  if (!handle) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-lg font-medium">Missing patch handle.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="uppercase tracking-[0.3em] text-xs text-slate-400 mb-1">Discovery Live</p>
            <h1 className="text-3xl font-semibold text-white">Audit Feed – {handle}</h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-700 bg-slate-900"
                checked={autoScroll}
                onChange={(event) => setAutoScroll(event.target.checked)}
              />
              Auto-scroll
            </label>
            <button
              onClick={() => downloadNdjson(handle, events)}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              disabled={events.length === 0}
            >
              Export NDJSON
            </button>
          </div>
        </header>

        {error && (
          <div className="rounded-md border border-rose-600/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
            <strong className="font-semibold">Error:</strong> {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Total Events</p>
            <p className="mt-2 text-2xl font-semibold text-white">{stats.total}</p>
            <p className="mt-1 text-xs text-slate-500">Real-time feed of every decision</p>
          </div>
          <div className="rounded-xl border border-emerald-700/50 bg-emerald-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">Saved Items</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-100">{stats.saved}</p>
            <p className="mt-1 text-xs text-emerald-200/70">Count of successful saves this run</p>
          </div>
          <div className="rounded-xl border border-amber-700/50 bg-amber-950/40 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-amber-200/80">Failures</p>
            <p className="mt-2 text-2xl font-semibold text-amber-100">{stats.failures}</p>
            <p className="mt-1 text-xs text-amber-200/70">Errors, duplicates & rejects</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring focus:ring-slate-600"
                >
                  <option value="all">Status: All</option>
                  <option value="pending">Pending</option>
                  <option value="ok">OK</option>
                  <option value="fail">Fail</option>
                </select>
                <select
                  value={stepFilter}
                  onChange={(event) => setStepFilter(event.target.value)}
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring focus:ring-slate-600"
                >
                  <option value="all">Step: All</option>
                  {uniqueSteps.map((step) => (
                    <option key={step} value={step}>
                      {step}
                    </option>
                  ))}
                </select>
                <span className="hidden sm:inline">Filtered: {filteredEvents.length}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
            </header>

            <div className="h-[520px] overflow-y-auto" ref={scrollContainerRef}>
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Loading audit events…
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No audit events captured yet.
                </div>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {filteredEvents.map((event) => {
                    const key = eventKey(event)
                    const isSelected = selectedEventKey === key
                    return (
                      <li
                        key={key}
                        className={`relative cursor-pointer px-4 py-3 transition-colors ${
                          isSelected ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'
                        }`}
                        onClick={() => setSelectedEventKey(key)}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full ${
                              event.status === 'ok'
                                ? 'bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]'
                                : event.status === 'fail'
                                ? 'bg-rose-400 shadow-[0_0_0_3px_rgba(244,63,94,0.15)]'
                                : 'bg-amber-300 shadow-[0_0_0_3px_rgba(252,211,77,0.15)]'
                            }`}
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="font-medium text-slate-100">{event.step}</span>
                              <span className="text-xs uppercase tracking-wide text-slate-500">{event.status}</span>
                              {event.provider && (
                                <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                                  {event.provider}
                                </span>
                              )}
                              {(event.decisions as any)?.action && (
                                <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                                  {(event.decisions as any).action}
                                </span>
                              )}
                            </div>
                            {event.query && (
                              <p className="text-xs text-slate-400">{event.query}</p>
                            )}
                            {event.candidateUrl && (
                              <a
                                href={event.candidateUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block truncate text-xs text-sky-300 underline-offset-2 hover:underline"
                                onClick={(clickEvent) => clickEvent.stopPropagation()}
                              >
                                {event.candidateUrl}
                              </a>
                            )}
                          </div>
                          <time className="mt-1 text-xs text-slate-500">
                            {formatTime(event.createdAt)}
                          </time>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {hasMore && (
              <div className="border-t border-slate-800 bg-slate-900/80 px-4 py-3 text-right">
                <button
                  onClick={loadMore}
                  className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isFetchingMore}
                >
                  {isFetchingMore ? 'Loading…' : 'Load older events'}
                </button>
              </div>
            )}
          </div>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900/70">
            <header className="border-b border-slate-800 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Event Detail</p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                {selectedEvent ? selectedEvent.step : 'Select an event'}
              </h2>
            </header>
            <div className="h-[520px] overflow-y-auto px-4 py-4 text-sm text-slate-200">
              {selectedEvent ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs uppercase tracking-[0.3em] text-slate-500">Summary</h3>
                    <div className="mt-2 space-y-1 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span>Status</span>
                        <span className="font-medium text-slate-100">{selectedEvent.status}</span>
                      </div>
                      {selectedEvent.provider && (
                        <div className="flex items-center justify-between">
                          <span>Provider</span>
                          <span className="font-medium text-slate-100">{selectedEvent.provider}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span>Run</span>
                        <span className="font-mono text-[11px] text-slate-400">{selectedEvent.runId}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Timestamp</span>
                        <span className="font-medium text-slate-100">{formatTime(selectedEvent.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {selectedEvent.query && (
                    <div>
                      <h3 className="text-xs uppercase tracking-[0.3em] text-slate-500">Query</h3>
                      <p className="mt-2 rounded-md bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
                        {selectedEvent.query}
                      </p>
                    </div>
                  )}

                  {selectedEvent.candidateUrl && (
                    <div>
                      <h3 className="text-xs uppercase tracking-[0.3em] text-slate-500">Candidate URL</h3>
                      <a
                        href={selectedEvent.candidateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block break-words text-xs text-sky-300 underline-offset-2 hover:underline"
                      >
                        {selectedEvent.candidateUrl}
                      </a>
                    </div>
                  )}

                  {selectedEvent.decisions && (
                    <DataBlock title="Decision" data={selectedEvent.decisions} />
                  )}
                  {selectedEvent.meta && <DataBlock title="Metadata" data={selectedEvent.meta} />}
                  {selectedEvent.scores && <DataBlock title="Scores" data={selectedEvent.scores} />}
                  {selectedEvent.hashes && <DataBlock title="Hashes" data={selectedEvent.hashes} />}
                  {selectedEvent.hero && <DataBlock title="Hero" data={selectedEvent.hero} />}
                  {selectedEvent.timings && <DataBlock title="Timings" data={selectedEvent.timings} />}
                  {selectedEvent.error && (
                    <DataBlock title="Error" data={selectedEvent.error} tone="error" />
                  )}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Select an event to inspect full payload.
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </div>
  )
}

function DataBlock({ title, data, tone }: { title: string; data: unknown; tone?: 'error' }) {
  return (
    <div>
      <h3
        className={`text-xs uppercase tracking-[0.3em] ${
          tone === 'error' ? 'text-rose-300/90' : 'text-slate-500'
        }`}
      >
        {title}
      </h3>
      <pre
        className={`mt-2 max-h-40 overflow-auto rounded-md border px-3 py-2 text-[11px] leading-relaxed ${
          tone === 'error'
            ? 'border-rose-800/60 bg-rose-950/40 text-rose-200'
            : 'border-slate-800 bg-slate-950/60 text-slate-200'
        }`}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
