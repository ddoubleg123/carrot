export interface AuditItem {
  step: string
  status: string
  candidateUrl?: string | null
  meta?: Record<string, any> | null
  decisions?: Record<string, any> | null
}

interface BuildAnalyticsExtras {
  paywallBranches: string[]
  zeroSaveDiagnostics: any
  seedsVsQueries: { seeds: number; queries: number }
  whyRejected: Array<{ reason: string; count: number }>
  robotsDecisions: Array<{ url: string; rule?: string | null }>
  topCandidates: Array<{ url: string; angle?: string | null; savedAt?: string | null }>
}

export function buildWhyRejected(items: AuditItem[]): Array<{ reason: string; count: number }> {
  const map = new Map<string, number>()
  items.forEach((item) => {
    const reason =
      item?.decisions?.reason ||
      item?.meta?.reason ||
      (typeof (item as any)?.error?.message === 'string' ? (item as any).error.message : null)
    if (!reason) return
    const key = String(reason).toLowerCase()
    map.set(key, (map.get(key) ?? 0) + 1)
  })
  return Array.from(map.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
}

export function computeSeedsVsQueries(items: AuditItem[]): { seeds: number; queries: number } {
  let seeds = 0
  let queries = 0
  items.forEach((item) => {
    const reason = item?.meta?.reason || item?.decisions?.reason
    if (reason === 'planner_query') {
      queries += 1
    } else if (item?.meta?.directSeed || reason === 'direct_seed' || item?.step === 'seed') {
      seeds += 1
    }
  })
  return { seeds, queries }
}

export function buildRobotsDecisions(items: AuditItem[]): Array<{ url: string; rule?: string | null }> {
  return items
    .filter((item) => {
      const reason = (item?.decisions?.reason || '').toLowerCase()
      return reason.includes('robots') || reason.includes('forbidden')
    })
    .slice(0, 20)
    .map((item) => ({
      url: item.candidateUrl || item.meta?.finalUrl || item.meta?.url || '',
      rule: item?.meta?.robotsRule || item?.decisions?.rule || null
    }))
}

export function buildTopCandidates(items: AuditItem[]): Array<{ url: string; angle?: string | null; savedAt?: string | null }> {
  return items
    .filter((item) => item.step === 'save' && item.status === 'ok')
    .slice(0, 10)
    .map((item) => ({
      url: item.candidateUrl || item.meta?.finalUrl || item.meta?.url || '',
      angle: item?.meta?.angle || null,
      savedAt: (item as any)?.ts || null
    }))
}

export function buildAnalytics(items: AuditItem[], snapshot: any, extras: BuildAnalyticsExtras) {
  const { paywallBranches, zeroSaveDiagnostics, seedsVsQueries, whyRejected, robotsDecisions, topCandidates } = extras
  const paywallSummary = paywallBranches.reduce<Record<string, { attempts: number; successes: number; failures: number }>>((acc, entry) => {
    const [prefix, branch] = entry.includes(':') ? entry.split(':', 2) : ['attempt', entry]
    const key = branch || 'canonical'
    if (!acc[key]) {
      acc[key] = { attempts: 0, successes: 0, failures: 0 }
    }
    if (prefix === 'success') {
      acc[key].successes += 1
    } else if (prefix === 'fail') {
      acc[key].failures += 1
    } else {
      acc[key].attempts += 1
    }
    return acc
  }, {})
  const distinctHosts = new Set<string>()
  const hostStats = new Map<string, { attempts: number; saved: number }>()
  let wikiSum = 0
  const totalWindow = Math.min(items.length, 200)
  let contestedAttempts = 0
  let contestedSaves = 0
  let savesInWindow = 0

  const canonicalCooldownEvents = items
    .filter(
      (item) =>
        item?.decisions?.reason === 'canonical_cooldown' ||
        item?.meta?.reason === 'canonical_cooldown' ||
        item?.step === 'cooldown'
    )
    .slice(0, 10)
    .map((item) => ({
      url: item?.candidateUrl || item?.meta?.finalUrl || '',
      ts: (item as any)?.ts ?? null
    }))

  items.slice(0, 20).forEach((item) => {
    const host = extractHost(item?.candidateUrl || item?.meta?.finalUrl || '')
    if (host) distinctHosts.add(host)
  })

  items.slice(0, totalWindow).forEach((item) => {
    const url = item?.candidateUrl || item?.meta?.finalUrl || ''
    const host = extractHost(url)
    const isSave = item.step === 'save' && item.status === 'ok'
    const isContested = Boolean(item?.meta?.stance === 'contested' || item?.decisions?.stance === 'contested')

    if (host) {
      const stat = hostStats.get(host) ?? { attempts: 0, saved: 0 }
      stat.attempts += 1
      if (isSave) stat.saved += 1
      hostStats.set(host, stat)
    }

    if (url.includes('wikipedia.org')) {
      wikiSum += 1
    }

    if (isContested) {
      contestedAttempts += 1
      if (isSave) contestedSaves += 1
    }
    if (isSave) {
      savesInWindow += 1
    }
  })

  const hostArray = Array.from(hostStats.entries())
    .map(([host, stat]) => ({ host, attempts: stat.attempts, saved: stat.saved }))
    .sort((a, b) => b.attempts - a.attempts)

  const telemetry = snapshot?.metrics?.telemetry ?? {}
  const wikiShare = totalWindow > 0 ? (wikiSum / totalWindow) * 100 : 0
  const controversyWindow = snapshot?.metrics?.controversyWindow ?? {}
  const frontierDepth = snapshot?.metrics?.tracker?.frontierDepth ?? null
  const ttfMs = snapshot?.metrics?.timeToFirstMs ?? null

  return {
    ttfSeconds: typeof ttfMs === 'number' ? Math.round(ttfMs / 1000) : null,
    distinctHosts: distinctHosts.size,
    topHosts: hostArray.slice(0, 10),
    wikiShare: Number(wikiShare.toFixed(2)),
    controversy: {
      attemptRatio: typeof controversyWindow.attemptRatio === 'number' ? controversyWindow.attemptRatio : contestedAttempts / Math.max(totalWindow, 1),
      saveRatio: typeof controversyWindow.saveRatio === 'number' ? controversyWindow.saveRatio : contestedSaves / Math.max(savesInWindow, 1),
      windowSize: controversyWindow.size ?? totalWindow
    },
    frontierSize: frontierDepth,
    telemetry: {
      httpCacheHits: telemetry.httpCacheHits ?? 0,
      jsLiteUsage: telemetry.jsLiteUsage ?? 0
    },
    paywallBranches: {
      raw: paywallBranches,
      summary: paywallSummary
    },
    zeroSave: zeroSaveDiagnostics ?? snapshot?.metrics?.zeroSave ?? null,
    seedsVsQueries,
    whyRejected: whyRejected.slice(0, 5),
    robotsDecisions,
    topCandidates,
    first20Hosts: snapshot?.metrics?.first20Hosts ?? [],
    first20HostCount: snapshot?.metrics?.first20HostCount ?? null,
    first12Angles: snapshot?.metrics?.first12Angles ?? {},
    first12Viewpoints: snapshot?.metrics?.first12Viewpoints ?? {},
    quotaStatus: snapshot?.metrics?.quotaStatus ?? {},
    hookAttemptCounts: snapshot?.metrics?.hookAttemptCounts ?? {},
    hostThrottleHits: snapshot?.metrics?.hostThrottleHits ?? {},
    hostAttemptSnapshot: snapshot?.metrics?.hostAttemptSnapshot ?? {},
    hostAttemptCap: snapshot?.metrics?.hostAttemptCap ?? null,
    runAttemptCap: snapshot?.metrics?.runAttemptCap ?? null,
    totalAttempts: snapshot?.metrics?.totalAttempts ?? null,
    heroGate: snapshot?.metrics?.heroGate ?? { eligible: false },
    canonicalCooldowns: canonicalCooldownEvents,
    wikiGuardActive: snapshot?.metrics?.wikiGuardActive ?? false
  }
}

function extractHost(url: string | null | undefined): string | null {
  if (!url || url === '—') return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

