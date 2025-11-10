'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowDownToLine, Filter, RefreshCcw, AlertCircle, Scale, WifiOff } from 'lucide-react'

interface AuditRecord {
  id: string
  step: string
  status: 'pending' | 'ok' | 'fail'
  provider?: string | null
  candidateUrl?: string | null
  finalUrl?: string | null
  query?: string | null
  decisions?: { action?: string; reason?: string; [key: string]: any } | null
  meta?: Record<string, any> | null
  error?: Record<string, any> | null
  timings?: Record<string, any> | null
  ts?: string | Date
}

interface AuditRow {
  id: string
  ts: string
  step: string
  status: 'pending' | 'ok' | 'fail'
  provider: string
  candidateUrl: string
  finalUrl?: string
  reason?: string
  action?: string
  angle?: string
  heroSource?: string
  timings?: string
  contestedNote?: string
  contestedClaim?: string
  payload: AuditRecord
}

const formatTimestamp = (value: string | Date | undefined) => {
  if (!value) return '—'
  try {
    const date = typeof value === 'string' ? new Date(value) : value
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return String(value)
  }
}

const buildRow = (record: AuditRecord): AuditRow => {
  const ts = record.ts ? (typeof record.ts === 'string' ? record.ts : record.ts.toISOString()) : new Date().toISOString()
  const meta = record.meta || {}
  const decisions = record.decisions || {}
  const heroSource = meta.heroSource || meta.hero_source
  const angle = meta.angle || decisions.angle
  const timings = record.timings ? JSON.stringify(record.timings) : undefined
  const contested = meta.contested || decisions.contested
  const contestedNote = contested?.note
  const contestedClaim = meta.contestedClaim || contested?.claim

  return {
    id: record.id || `${record.step}-${ts}`,
    ts,
    step: record.step,
    status: record.status,
    provider: record.provider || meta.provider || '—',
    candidateUrl: record.candidateUrl || meta.finalUrl || record.finalUrl || '—',
    finalUrl: record.finalUrl || meta.finalUrl,
    reason: decisions.reason || record.error?.message,
    action: decisions.action,
    angle,
    heroSource,
    timings,
    contestedNote,
    contestedClaim,
    payload: record
  }
}

const filterRows = (rows: AuditRow[], statusFilter: string, provider: string, reason: string, contested: string) => {
  return rows.filter((row) => {
    if (statusFilter === 'accepted' && !(row.step === 'save' && row.status === 'ok')) {
      return false
    }
    if (statusFilter === 'denied' && !(row.step === 'save' && row.status !== 'ok')) {
      return false
    }
    if (provider !== 'all' && row.provider !== provider) {
      return false
    }
    if (reason !== 'all' && row.reason !== reason) {
      return false
    }
    if (contested === 'contested' && !row.contestedNote) {
      return false
    }
    if (contested === 'non-contested' && row.contestedNote) {
      return false
    }
    return true
  })
}

interface AuditPageProps {
  params: Promise<{ handle: string }>
}

export default function AuditPage(props: AuditPageProps) {
  const [handle, setHandle] = useState<string>('')
  const [rows, setRows] = useState<AuditRow[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | 'accepted' | 'denied'>('all')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [reasonFilter, setReasonFilter] = useState<string>('all')
  const [contestedFilter, setContestedFilter] = useState<'all' | 'contested' | 'non-contested'>('all')
  const [angleFilter, setAngleFilter] = useState<string>('all')
  const [anglesCovered, setAnglesCovered] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState<boolean>(true)
  const eventSourceRef = useRef<EventSource | null>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const [aggregate, setAggregate] = useState<{ accepted: number; denied: number; skipped: number }>({
    accepted: 0,
    denied: 0,
    skipped: 0
  })
  const [statusSummary, setStatusSummary] = useState<{ status: string; runId?: string } | null>(null)

  useEffect(() => {
    props.params.then(({ handle }) => {
      setHandle(handle)
      loadInitial(handle)
      startStream(handle)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadInitial = useCallback(async (patchHandle: string) => {
    try {
      const response = await fetch(`/api/patches/${patchHandle}/audit?limit=200`, {
        headers: { 'Cache-Control': 'no-cache' }
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      if (Array.isArray(data.items)) {
        const mapped = data.items.map(buildRow)
        seenIdsRef.current.clear()
        mapped.forEach((row: AuditRow) => seenIdsRef.current.add(row.id))
        setRows(mapped)
        setAnglesCovered(new Set(mapped.map((row: AuditRow) => row.angle).filter(Boolean) as string[]))
      }
      if (data.aggregate) {
        setAggregate(data.aggregate)
      }
      setError(null)
      setConnected(true)
    } catch (err) {
      console.error('[Audit] Failed to load initial events', err)
      setError('Failed to load audit events')
    }
  }, [seenIdsRef])

  const startStream = useCallback((patchHandle: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    const source = new EventSource(`/api/patches/${patchHandle}/audit/stream`)
    eventSourceRef.current = source
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as AuditRecord
        const row = buildRow(payload)
        if (seenIdsRef.current.has(row.id)) {
          return
        }
        seenIdsRef.current.add(row.id)
        setRows((prev) => [row, ...prev])
        if (row.angle) {
          setAnglesCovered((prev) => {
            const next = new Set(prev)
            next.add(row.angle as string)
            return next
          })
        }
        if (row.step === 'save') {
          setAggregate((prev) => {
            if (row.status === 'ok') {
              return { ...prev, accepted: prev.accepted + 1 }
            }
            return { ...prev, denied: prev.denied + 1 }
          })
        } else if (row.step.startsWith('skipped')) {
          setAggregate((prev) => ({ ...prev, skipped: prev.skipped + 1 }))
        } else if (row.step === 'run_complete' && row.status !== 'ok') {
          setStatusSummary({
            status: row.status,
            runId: row.payload?.decisions?.runId || undefined
          })
        }
        setError(null)
        setConnected(true)
      } catch (err) {
        console.error('[Audit SSE] Failed to parse payload', err, event.data)
      }
    }
    source.onerror = (err) => {
      console.error('[Audit SSE] error', err)
      setConnected(false)
      setError('Live stream disconnected')
    }
  }, [seenIdsRef])

  const filteredRows = useMemo(() => {
    const base = filterRows(rows, statusFilter, providerFilter, reasonFilter, contestedFilter)
    if (angleFilter === 'all') return base
    return base.filter((row) => row.angle === angleFilter)
  }, [rows, statusFilter, providerFilter, reasonFilter, contestedFilter, angleFilter])

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  const providers = useMemo(() => ['all', ...Array.from(new Set(rows.map((row) => row.provider).filter(Boolean)))] as string[], [rows])
  const reasons = useMemo(() => ['all', ...Array.from(new Set(rows.map((row) => row.reason).filter(Boolean)))] as string[], [rows])
  const angles = useMemo(() => ['all', ...Array.from(new Set(rows.map((row) => row.angle).filter(Boolean)))] as string[], [rows])
  const contestedCount = useMemo(() => rows.filter((row) => Boolean(row.contestedNote)).length, [rows])

  const acceptedCount = useMemo(() => rows.filter((row) => row.step === 'save' && row.status === 'ok').length, [rows])
  const deniedCount = useMemo(() => rows.filter((row) => row.step === 'save' && row.status !== 'ok').length, [rows])

  const handleExport = useCallback(async () => {
    try {
      const response = await fetch(`/api/patches/${handle}/audit?limit=500`)
      if (!response.ok) throw new Error('export failed')
      const data = await response.json()
      const blob = new Blob([JSON.stringify(data.items ?? [], null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${handle}-audit-log.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[Audit] Export failed', err)
      alert('Failed to export audit log')
    }
  }, [handle])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Discovery Audit · {handle}</h1>
          <p className="text-sm text-slate-600">Real-time trace of every decision with reasons, providers, and hero sources.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadInitial(handle)} className="gap-2">
            <RefreshCcw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={handleExport} className="gap-2">
            <ArrowDownToLine className="h-4 w-4" /> Export JSON
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-5">
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total events</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{rows.length}</p>
          {!connected && (
            <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
              <WifiOff className="h-3 w-3" /> Stream paused
            </div>
          )}
          {statusSummary && (
            <div className="mt-2 text-xs text-slate-500">
              Status: <span className="font-medium text-slate-800">{statusSummary.status}</span>
            </div>
          )}
        </Card>
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Accepted saves</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">{aggregate.accepted || acceptedCount}</p>
        </Card>
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Denied saves</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">{aggregate.denied || deniedCount}</p>
        </Card>
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Skipped items</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{aggregate.skipped}</p>
        </Card>
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Contested cards</p>
          <div className="mt-1 flex items-center gap-2 text-slate-900">
            <Scale className="h-4 w-4 text-amber-600" />
            <span className="text-2xl font-semibold">{contestedCount}</span>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Angles covered</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{anglesCovered.size}</p>
          {anglesCovered.size > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from(anglesCovered).map((angle) => (
                <Badge key={angle} variant="outline" className="border-slate-200 text-slate-700">{angle}</Badge>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4 pb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600"><Filter className="h-4 w-4" /> Filters</div>
          <div className="flex flex-wrap gap-3 text-sm">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as any)} className="rounded-md border border-slate-200 px-3 py-1.5">
              <option value="all">All statuses</option>
              <option value="accepted">Accepted saves</option>
              <option value="denied">Denied saves</option>
            </select>
            <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-1.5">
              {providers.map((provider) => (
                <option key={provider} value={provider}>{provider === 'all' ? 'All providers' : provider}</option>
              ))}
            </select>
            <select value={reasonFilter} onChange={(event) => setReasonFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-1.5">
              {reasons.map((reason) => (
                <option key={reason} value={reason}>{reason === 'all' ? 'All reasons' : reason}</option>
              ))}
            </select>
            <select value={contestedFilter} onChange={(event) => setContestedFilter(event.target.value as any)} className="rounded-md border border-slate-200 px-3 py-1.5">
              <option value="all">All viewpoints</option>
              <option value="contested">Contested only</option>
              <option value="non-contested">Non-contested only</option>
            </select>
            <select value={angleFilter} onChange={(event) => setAngleFilter(event.target.value)} className="rounded-md border border-slate-200 px-3 py-1.5">
              {angles.map((angle) => (
                <option key={angle} value={angle}>
                  {angle === 'all' ? 'All angles' : angle}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <AlertCircle className="h-3 w-3" /> {error}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Step</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Provider</th>
                <th className="px-3 py-2">Candidate</th>
                <th className="px-3 py-2">Decision</th>
                <th className="px-3 py-2">Contested</th>
                <th className="px-3 py-2">Angle</th>
                <th className="px-3 py-2">Hero</th>
                <th className="px-3 py-2">Timings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <tr key={`${row.id}-${row.ts}`} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{formatTimestamp(row.ts)}</td>
                  <td className="px-3 py-2 text-slate-700">{row.step}</td>
                  <td className="px-3 py-2">
                    <Badge variant={row.status === 'ok' ? 'outline' : 'destructive'} className={row.status === 'ok' ? 'border-emerald-200 text-emerald-700' : 'border-red-200 text-red-700'}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.provider}</td>
                  <td className="px-3 py-2 text-slate-600">
                    <a href={row.candidateUrl} target="_blank" rel="noreferrer" className="max-w-xs truncate text-blue-600 underline">
                      {row.candidateUrl}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    <div className="flex flex-col">
                      {row.action && <span className="text-xs uppercase tracking-wide text-slate-500">{row.action}</span>}
                      {row.reason || '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {row.contestedNote ? (
                      <div className="flex flex-col gap-1">
                        {row.contestedClaim && <span className="text-xs font-semibold text-amber-700">{row.contestedClaim}</span>}
                        <span>{row.contestedNote}</span>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.angle || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">{row.heroSource || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">
                    <span className="group relative cursor-help">
                      {row.timings ? 'view' : '—'}
                      {row.timings && (
                        <span className="absolute left-0 top-full z-10 hidden w-48 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white group-hover:block">
                          {row.timings}
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
