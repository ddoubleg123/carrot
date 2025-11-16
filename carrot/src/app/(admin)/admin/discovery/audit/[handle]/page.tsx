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

const OPERATOR_ACTIONS: Array<{
  value: string
  label: string
  placeholder?: string
  helper?: string
}> = [
  { value: 'pin_seed', label: 'Pin seed', placeholder: 'Seed URL to prioritize' },
  { value: 'nuke_host', label: 'Nuke host (24h)', placeholder: 'Domain to block', helper: 'Blocks the host for 24 hours' },
  { value: 'boost_hook', label: 'Boost hook', placeholder: 'Hook ID to boost', helper: 'Temporarily increases priority' },
  { value: 'skip_angle', label: 'Skip angle', placeholder: 'Angle ID to skip', helper: 'Skips further attempts for the angle' },
  { value: 'add_seed', label: 'Add manual seed', placeholder: 'Seed URL with notes', helper: 'Adds a seed URL with your notes' }
]

interface HookStat {
  hookId: string
  attempts: number
  saved: number
}

interface HostStat {
  host: string
  attempts: number
  saved: number
}

interface ViewpointStat {
  label: string
  count: number
}

interface AnalyticsSummary {
  hooks: HookStat[]
  hosts: HostStat[]
  viewpoints: ViewpointStat[]
  wikiShare: number
  totalAttempts: number
  seedsVsQueries: { seeds: number; queries: number }
  paywallLog: AuditRow[]
  robotsLog: AuditRow[]
}

function computeAnalytics(rows: AuditRow[]): AnalyticsSummary {
  const hookMap = new Map<string, HookStat>()
  const hostMap = new Map<string, HostStat>()
  const viewpointMap = new Map<string, number>()
  let wikiTagged = 0
  let total = 0
  let seedCount = 0
  let queryCount = 0
  const paywall: AuditRow[] = []
  const robots: AuditRow[] = []

  rows.forEach((row) => {
    total += 1
    const meta = row.payload.meta || {}
    const decisions = row.payload.decisions || {}
    const hookId = meta.hookId || decisions.hookId
    const viewpoint = meta.viewpoint || meta.stance || (row.contestedNote ? 'contested' : 'majority')
    const reason = (row.reason || '').toLowerCase()
    const metaReason = typeof meta.reason === 'string' ? meta.reason : ''

    const candidateUrl = row.candidateUrl || ''
    let host = meta.domain || ''
    if (!host && candidateUrl && candidateUrl !== '—') {
      try {
        host = new URL(candidateUrl).hostname.toLowerCase()
      } catch {
        host = candidateUrl
      }
    }
    const isSave = row.step === 'save' && row.status === 'ok'

    if (hookId) {
      const hook = hookMap.get(hookId) ?? { hookId, attempts: 0, saved: 0 }
      hook.attempts += 1
      if (isSave) hook.saved += 1
      hookMap.set(hookId, hook)
    }

    if (host) {
      const hostStat = hostMap.get(host) ?? { host, attempts: 0, saved: 0 }
      hostStat.attempts += 1
      if (isSave) hostStat.saved += 1
      hostMap.set(host, hostStat)
    }

    if (viewpoint) {
      viewpointMap.set(viewpoint, (viewpointMap.get(viewpoint) ?? 0) + (isSave ? 1 : 0))
    }

    if (host.includes('wikipedia.org')) {
      wikiTagged += 1
    }

    if (metaReason === 'planner_query') {
      queryCount += 1
    } else if (meta.directSeed || metaReason === 'direct_seed' || decisions.action === 'seed_accepted') {
      seedCount += 1
    }

    if (reason.includes('paywall')) {
      paywall.push(row)
    } else if (reason.includes('robots') || (meta.http && meta.http.status === 403)) {
      robots.push(row)
    }
  })

  const hooks = Array.from(hookMap.values()).sort((a, b) => b.attempts - a.attempts)
  const hosts = Array.from(hostMap.values()).sort((a, b) => b.attempts - a.attempts)
  const viewpoints = Array.from(viewpointMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)

  const wikiShare = total > 0 ? (wikiTagged / total) * 100 : 0

  return {
    hooks,
    hosts,
    viewpoints,
    wikiShare,
    totalAttempts: total,
    seedsVsQueries: { seeds: seedCount, queries: queryCount },
    paywallLog: paywall.slice(0, 10),
    robotsLog: robots.slice(0, 10)
  }
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
  const [plan, setPlan] = useState<any | null>(null)
  const [planHash, setPlanHash] = useState<string | null>(null)
  const [isPlanOpen, setIsPlanOpen] = useState<boolean>(false)
  const [run, setRun] = useState<any | null>(null)
  const [runState, setRunState] = useState<'live' | 'paused' | 'suspended' | null>(null)
  const [serverAnalytics, setServerAnalytics] = useState<any | null>(null)
  const [aggregate, setAggregate] = useState<{
    accepted: number
    denied: number
    skipped: number
    telemetry?: {
      seedsEnqueued?: number
      directFetchOk?: number
      htmlExtracted?: number
      vetterJsonOk?: number
      accepted?: number
      rejectedThreshold?: number
      rejectedParse?: number
      paywall?: number
      robotsBlock?: number
      timeout?: number
      softAccepted?: number
      queriesExpanded?: number
      queryExpansionSkipped?: number
      queryDeferred?: number
    } | null
  }>({
    accepted: 0,
    denied: 0,
    skipped: 0,
    telemetry: null
  })
  const [statusSummary, setStatusSummary] = useState<{ status: string; runId?: string } | null>(null)
  const [operatorAction, setOperatorAction] = useState<string>('pin_seed')
  const [operatorTarget, setOperatorTarget] = useState<string>('')
  const [operatorNotes, setOperatorNotes] = useState<string>('')
  const [operatorSubmitting, setOperatorSubmitting] = useState<boolean>(false)
  const [operatorMessage, setOperatorMessage] = useState<string | null>(null)

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
      setPlan(data.plan ?? null)
      setPlanHash(data.planHash ?? null)
      setRun(data.run ?? null)
      setRunState(data.runState ?? null)
      setServerAnalytics(data.analytics ?? null)
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
        } else if (row.step === 'run_complete') {
          const metaStatus = (row.payload?.meta as any)?.status
          const nextRunState =
            metaStatus === 'suspended'
              ? 'suspended'
              : metaStatus === 'paused'
                ? 'paused'
                : 'live'
          setRunState(nextRunState)
          setStatusSummary({
            status: metaStatus || row.status,
            runId: (row.payload?.decisions as any)?.runId || row.payload?.meta?.runId || undefined
          })
          const telemetryMeta = (row.payload?.meta as any)?.telemetry
          if (telemetryMeta) {
            setAggregate((prev) => ({ ...prev, telemetry: telemetryMeta }))
          }
          setRun((prev: any) => ({
            ...(prev ?? {}),
            id: (row.payload?.decisions as any)?.runId || prev?.id || row.id,
            metrics: row.payload?.meta || prev?.metrics || {}
          }))
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
  const telemetry = aggregate.telemetry
  const telemetrySummary = useMemo(() => {
    if (!telemetry) return []
    return [
      { label: 'Seeds enqueued', value: telemetry.seedsEnqueued ?? 0 },
      { label: 'Direct fetch ok', value: telemetry.directFetchOk ?? 0 },
      { label: 'HTML extracted', value: telemetry.htmlExtracted ?? 0 },
      { label: 'Vetter JSON ok', value: telemetry.vetterJsonOk ?? 0 },
      { label: 'Accepted', value: telemetry.accepted ?? 0 },
      { label: 'Rejected threshold', value: telemetry.rejectedThreshold ?? 0 },
      { label: 'Rejected parse', value: telemetry.rejectedParse ?? 0 },
      { label: 'Paywall', value: telemetry.paywall ?? 0 },
      { label: 'Robots block', value: telemetry.robotsBlock ?? 0 },
      { label: 'Timeout', value: telemetry.timeout ?? 0 },
      { label: 'Soft accepted', value: telemetry.softAccepted ?? 0 },
      { label: 'Queries expanded', value: telemetry.queriesExpanded ?? 0 },
      { label: 'Query skips', value: telemetry.queryExpansionSkipped ?? 0 },
      { label: 'Query deferred', value: telemetry.queryDeferred ?? 0 }
    ]
  }, [telemetry])

  const acceptedCount = useMemo(() => rows.filter((row) => row.step === 'save' && row.status === 'ok').length, [rows])
  const deniedCount = useMemo(() => rows.filter((row) => row.step === 'save' && row.status !== 'ok').length, [rows])
  const computedAnalytics = useMemo(() => computeAnalytics(rows), [rows])
  const analytics = useMemo(() => {
    if (!serverAnalytics) return computedAnalytics
    return {
      ...computedAnalytics,
      wikiShare: typeof serverAnalytics.wikiShare === 'number' ? serverAnalytics.wikiShare : computedAnalytics.wikiShare,
      seedsVsQueries: serverAnalytics.seedsVsQueries ?? computedAnalytics.seedsVsQueries
    }
  }, [computedAnalytics, serverAnalytics])
  const wikiSharePercent = analytics.wikiShare.toFixed(1)
  const seedsVsQueries = analytics.seedsVsQueries ?? { seeds: 0, queries: 0 }
  const paywallBranchesRaw: string[] = serverAnalytics?.paywallBranches?.raw ?? []
  const paywallBranchSummary = (serverAnalytics?.paywallBranches?.summary ?? {}) as Record<
    string,
    { attempts: number; successes: number; failures: number }
  >
  const ttfSeconds =
    serverAnalytics?.ttfSeconds ??
    (typeof run?.metrics?.timeToFirstMs === 'number' ? Math.round(run.metrics.timeToFirstMs / 1000) : null)
  const distinctHosts =
    serverAnalytics?.first20HostCount ?? serverAnalytics?.distinctHosts ?? analytics.hosts.length
  const controversyAttemptRatio =
    serverAnalytics?.controversy?.attemptRatio !== undefined
      ? serverAnalytics.controversy.attemptRatio
      : 0
  const controversySaveRatio =
    serverAnalytics?.controversy?.saveRatio !== undefined ? serverAnalytics.controversy.saveRatio : 0
  const zeroSaveData =
    serverAnalytics?.zeroSave ??
    run?.metrics?.zeroSave ??
    run?.metrics?.zeroSavePayload ??
    run?.metrics?.zeroSaveContext ??
    null
  const controversyWindowSize = serverAnalytics?.controversy?.windowSize ?? 40
  const frontierSize = serverAnalytics?.frontierSize ?? run?.metrics?.tracker?.frontierDepth ?? null
  const whyRejected: Array<{ reason: string; count: number }> = serverAnalytics?.whyRejected ?? []
  const robotsDecisions: Array<{ url?: string | null; rule?: string | null }> = serverAnalytics?.robotsDecisions ?? []
  const topCandidates: Array<{ url: string; angle?: string | null; savedAt?: string | null }> = serverAnalytics?.topCandidates ?? []
  const first20HostsList: string[] = serverAnalytics?.first20Hosts ?? []
  const first12Angles = (serverAnalytics?.first12Angles ?? {}) as Record<string, number>
  const first12Viewpoints = (serverAnalytics?.first12Viewpoints ?? {}) as Record<string, number>
  const quotaStatus = serverAnalytics?.quotaStatus ?? {}
  const hookAttemptCounts = (serverAnalytics?.hookAttemptCounts ?? {}) as Record<string, number>
  const hostThrottleHits = (serverAnalytics?.hostThrottleHits ?? {}) as Record<string, number>
  const canonicalCooldowns: Array<{ url: string; ts: any }> = serverAnalytics?.canonicalCooldowns ?? []
  const heroGate: { eligible: boolean; supportDomain?: string | null; counterDomain?: string | null; score?: number | null } =
    serverAnalytics?.heroGate ?? { eligible: false }
  const totalAttemptsMetric = serverAnalytics?.totalAttempts ?? analytics.totalAttempts ?? null
  const hostAttemptCap = serverAnalytics?.hostAttemptCap ?? null
  const runAttemptCap = serverAnalytics?.runAttemptCap ?? null

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
      {runState && runState !== 'live' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">
            {runState === 'paused' ? 'Discovery run paused' : 'Discovery run suspended'}
          </p>
          <p className="text-xs text-amber-700">
            {statusSummary?.status
              ? `Last status: ${statusSummary.status}`
              : 'Operator attention required before discovery resumes.'}
          </p>
        </div>
      )}
      {runState && runState !== 'live' && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-center gap-2 font-medium uppercase tracking-wide">
            <AlertCircle className="h-4 w-4" />
            Discovery {runState}
          </div>
          <p className="mt-2 text-xs text-amber-700">
            The engine is currently {runState}. Verify zero-save diagnostics, operator logs, and kill switches before resuming.
          </p>
        </div>
      )}

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

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">TTF-S (shadow)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{ttfSeconds !== null ? `${ttfSeconds}s` : '—'}</p>
          <p className="mt-2 text-xs text-slate-500">Time-to-first-save for the current run.</p>
        </Card>
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Distinct hosts (last 20)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{distinctHosts}</p>
          <p className="mt-2 text-xs text-slate-500">Calculated from the most recent dequeues.</p>
        </Card>
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Contested ratios (rolling {controversyWindowSize})</p>
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>Attempts</span>
              <span className="font-semibold text-slate-900">{(controversyAttemptRatio * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>Saves</span>
              <span className="font-semibold text-slate-900">{(controversySaveRatio * 100).toFixed(1)}%</span>
            </div>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Wikipedia share (30s)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{wikiSharePercent}%</p>
          <p className="mt-2 text-xs text-slate-500">
            Based on the latest window. Frontier depth: {frontierSize ?? '—'}.
          </p>
        </Card>
      </section>

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
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:col-span-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Run telemetry</p>
          {telemetrySummary.length > 0 ? (
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-700">
              {telemetrySummary.map((item) => (
                <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-2">
                  <dt className="text-xs uppercase tracking-wide text-slate-500">{item.label}</dt>
                  <dd className="mt-1 text-lg font-semibold text-slate-900">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Telemetry will appear once the run emits counters.</p>
          )}
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

      {plan && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Planner guide</p>
              {planHash && <p className="text-xs text-slate-400">Hash: {planHash}</p>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(JSON.stringify(plan, null, 2))}>
                Copy JSON
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsPlanOpen((prev) => !prev)}>
                {isPlanOpen ? 'Hide plan' : 'Show plan'}
              </Button>
            </div>
          </div>
          {isPlanOpen && (
            <pre className="mt-4 max-h-96 overflow-y-auto rounded-xl bg-slate-900/90 p-4 text-xs text-slate-100">
              {JSON.stringify(plan, null, 2)}
            </pre>
          )}
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Hook coverage</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {analytics.hooks.slice(0, 6).map((hook) => (
              <li key={hook.hookId} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium">{hook.hookId}</span>
                <span className="text-xs text-slate-500">
                  {hook.saved} saved / {hook.attempts} attempts
                </span>
              </li>
            ))}
            {analytics.hooks.length === 0 && <li className="text-xs text-slate-500">No hook activity yet.</li>}
          </ul>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Top hosts</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {analytics.hosts.slice(0, 6).map((host) => (
              <li key={host.host} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="truncate font-medium">{host.host}</span>
                <span className="text-xs text-slate-500">
                  {host.saved} saved / {host.attempts} attempts
                </span>
              </li>
            ))}
            {analytics.hosts.length === 0 && <li className="text-xs text-slate-500">No host data yet.</li>}
          </ul>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Viewpoint coverage</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {analytics.viewpoints.slice(0, 6).map((item) => (
              <li key={item.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="font-medium capitalize">{item.label}</span>
                <span className="text-xs text-slate-500">{item.count} saved</span>
              </li>
            ))}
            {analytics.viewpoints.length === 0 && <li className="text-xs text-slate-500">No viewpoint data yet.</li>}
          </ul>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Seeds vs Planner queries</p>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-600">Seeds</span>
              <span>{seedsVsQueries.seeds}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-600">Queries</span>
              <span>{seedsVsQueries.queries}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100">
              {(() => {
                const total = seedsVsQueries.seeds + seedsVsQueries.queries
                if (total === 0) return null
                const seedPct = (seedsVsQueries.seeds / total) * 100
                return (
                  <div className="flex h-2 w-full overflow-hidden rounded-full">
                    <span className="bg-emerald-500" style={{ width: `${seedPct}%` }} />
                    <span className="bg-blue-500" style={{ width: `${100 - seedPct}%` }} />
                  </div>
                )
              })()}
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Wikipedia share</p>
          <div className="mt-4 space-y-2">
            <p className="text-3xl font-semibold text-slate-900">{wikiSharePercent}%</p>
            <div className="h-2 w-full rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full ${analytics.wikiShare > 45 ? 'bg-red-500' : analytics.wikiShare > 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(analytics.wikiShare, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">Share of events touching wikipedia.org out of {analytics.totalAttempts} events.</p>
          </div>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Zero-save diagnostics</p>
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            {zeroSaveData ? (
              <div className="space-y-2">
                <p>
                  Status: <span className="font-semibold uppercase text-slate-800">{zeroSaveData.status ?? 'unknown'}</span> · Attempts: {zeroSaveData.attempts ?? '—'}
                </p>
                {zeroSaveData.reason && <p className="text-slate-500">Reason: {zeroSaveData.reason}</p>}
                <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap">{JSON.stringify(zeroSaveData, null, 2)}</pre>
              </div>
            ) : (
              <p>No zero-save warnings recorded for the current run.</p>
            )}
          </div>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">First-wave coverage</p>
          <div className="mt-3 space-y-3 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span>First 20 hosts</span>
              <span className={quotaStatus.first20Hosts ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}>
                {distinctHosts} {quotaStatus.first20Hosts ? 'met' : 'needs diversity'}
              </span>
            </div>
            {first20HostsList.length > 0 && (
              <div className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500">
                {first20HostsList.join(', ')}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>First 12 angles</span>
              <span className={quotaStatus.first12Angles ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}>
                {Object.keys(first12Angles).length} {quotaStatus.first12Angles ? 'met' : 'insufficient'}
              </span>
            </div>
            {Object.keys(first12Angles).length > 0 && (
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {Object.entries(first12Angles).map(([angleName, count]) => (
                  <span key={angleName} className="rounded-md bg-slate-50 px-2 py-1 text-slate-500">
                    {angleName}: {count as number}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>First 12 viewpoints</span>
              <span className={quotaStatus.first12Viewpoints ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}>
                {Object.keys(first12Viewpoints).length} {quotaStatus.first12Viewpoints ? 'met' : 'needs spread'}
              </span>
            </div>
            {Object.keys(first12Viewpoints).length > 0 && (
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {Object.entries(first12Viewpoints).map(([viewpointName, count]) => (
                  <span key={viewpointName} className="rounded-md bg-slate-50 px-2 py-1 text-slate-500">
                    {viewpointName}: {count as number}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span>Hook attempts ≥ 2 (first 20)</span>
              <span className={quotaStatus.hookAttempts ? 'font-semibold text-emerald-600' : 'font-semibold text-amber-600'}>
                {Object.keys(hookAttemptCounts).length > 0 ? (quotaStatus.hookAttempts ? 'met' : 'needs repeats') : '—'}
              </span>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Paywall branch attempts</p>
          <div className="mt-3 space-y-2 text-xs text-slate-700">
            {Object.keys(paywallBranchSummary).length > 0 ? (
              <ul className="space-y-2">
                {Object.entries(paywallBranchSummary).map(([branch, stats]) => (
                  <li key={branch} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="font-medium text-slate-700">{branch}</span>
                    <span className="text-[11px] uppercase tracking-wide text-slate-500">
                      {stats.successes} success · {stats.failures} fail · {stats.attempts} attempts
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">No paywall branches recorded yet.</p>
            )}
            {paywallBranchesRaw.length > 0 && (
              <div className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500">
                <p className="mb-1 font-semibold uppercase tracking-wide text-slate-600">Recent log</p>
                <ul className="space-y-1">
                  {paywallBranchesRaw.slice(0, 6).map((entry, index) => (
                    <li key={`${entry}-${index}`}>{entry}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Guard activity & hero gate</p>
          <div className="mt-3 space-y-3 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span>Total attempts (cap)</span>
              <span className="font-semibold text-slate-700">
                {totalAttemptsMetric ?? '—'} / {runAttemptCap ?? '∞'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Per-host cap</span>
              <span className="font-semibold text-slate-700">{hostAttemptCap ?? '—'}</span>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wide text-slate-500">Host throttles</p>
              {Object.keys(hostThrottleHits).length > 0 ? (
                <ul className="mt-1 space-y-1 text-[11px] text-slate-500">
                  {Object.entries(hostThrottleHits).map(([host, count]) => (
                    <li key={host}>{host}: {count as number}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-400">No throttles recorded.</p>
              )}
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wide text-slate-500">Canonical cooldowns</p>
              {canonicalCooldowns.length > 0 ? (
                <ul className="mt-1 space-y-1 text-[11px] text-slate-500">
                  {canonicalCooldowns.map((entry, index) => (
                    <li key={`${entry.url}-${index}`}>{entry.url || 'unknown url'}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-400">No cooldowns recorded.</p>
              )}
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-semibold uppercase tracking-wide text-slate-500">Hero gate</p>
              <p className="mt-1 text-slate-600">
                {heroGate.eligible ? 'Eligible for hero generation' : 'Waiting for support + counter symmetry'}
              </p>
              <p className="text-[11px] text-slate-500">
                Score: {heroGate?.score !== undefined ? heroGate.score : '—'}
                {heroGate.supportDomain && heroGate.counterDomain && (
                  <> · {heroGate.supportDomain} vs {heroGate.counterDomain}</>
                )}
              </p>
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Robots.txt decisions</p>
          <ul className="mt-3 space-y-2 text-xs text-slate-700">
            {robotsDecisions.length > 0 ? (
              robotsDecisions.slice(0, 8).map((entry, index) => (
                <li key={`${entry.url}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="font-medium truncate text-slate-700">{entry.url || 'Unknown URL'}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Rule: {entry.rule || 'robots.txt'}</p>
                </li>
              ))
            ) : (
              <li className="text-xs text-slate-500">No robots decisions recorded.</li>
            )}
          </ul>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Why items were rejected</p>
          <ul className="mt-3 space-y-2 text-xs text-slate-700">
            {whyRejected.length > 0 ? (
              whyRejected.slice(0, 8).map((item) => (
                <li key={item.reason} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-medium capitalize text-slate-700">{item.reason}</span>
                  <span className="text-[11px] uppercase tracking-wide text-slate-500">{item.count}</span>
                </li>
              ))
            ) : (
              <li className="text-xs text-slate-500">No rejection data yet.</li>
            )}
          </ul>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Top conversation candidates</p>
          <ul className="mt-3 space-y-2 text-xs text-slate-700">
            {topCandidates.length > 0 ? (
              topCandidates.slice(0, 8).map((item, index) => (
                <li key={`${item.url}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="font-medium truncate text-slate-700">{item.url || 'Unknown URL'}</p>
                  {item.angle && <p className="text-[11px] uppercase tracking-wide text-slate-500">Angle: {item.angle}</p>}
                </li>
              ))
            ) : (
              <li className="text-xs text-slate-500">No saved candidates yet.</li>
            )}
          </ul>
        </Card>

        <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Operator controls</p>
          <form
            className="mt-3 space-y-3 text-sm text-slate-700"
            onSubmit={async (event) => {
              event.preventDefault()
              setOperatorSubmitting(true)
              setOperatorMessage(null)
              try {
                const response = await fetch(`/api/patches/${handle}/discovery/operator`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: operatorAction, target: operatorTarget, notes: operatorNotes })
                })
                if (!response.ok) {
                  throw new Error(`Request failed with status ${response.status}`)
                }
                setOperatorTarget('')
                setOperatorNotes('')
                setOperatorMessage('Action logged to audit stream.')
              } catch (err) {
                console.error('[OperatorAction] failed', err)
                setOperatorMessage('Failed to log action. See console for details.')
              } finally {
                setOperatorSubmitting(false)
              }
            }}
          >
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
              Action
              <select
                value={operatorAction}
                onChange={(event) => setOperatorAction(event.target.value)}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
              >
                {OPERATOR_ACTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
              Target
              <input
                value={operatorTarget}
                onChange={(event) => setOperatorTarget(event.target.value)}
                className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
                placeholder={OPERATOR_ACTIONS.find((option) => option.value === operatorAction)?.placeholder}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-slate-500">
              Notes (optional)
              <textarea
                value={operatorNotes}
                onChange={(event) => setOperatorNotes(event.target.value)}
                className="min-h-[64px] rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
                placeholder={OPERATOR_ACTIONS.find((option) => option.value === operatorAction)?.helper}
              />
            </label>
            <Button type="submit" size="sm" disabled={operatorSubmitting} className="w-full">
              {operatorSubmitting ? 'Recording…' : 'Log action'}
            </Button>
            {operatorMessage && <p className="text-xs text-slate-500">{operatorMessage}</p>}
          </form>
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
