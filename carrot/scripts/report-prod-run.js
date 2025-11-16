#!/usr/bin/env node
/**
 * Usage: node scripts/report-prod-run.js <auditPath> <runId> <outPath?>
 * Reads the audit JSON (as produced by /api/patches/:handle/audit) and
 * emits a compact metrics summary for the specified run.
 */

const fs = require('fs')
const path = require('path')

function hostFromUrl(url) {
  if (!url || url === '—') return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

function main() {
  const [auditPath, runId, outPath] = process.argv.slice(2)
  if (!auditPath || !runId) {
    console.error('Usage: node scripts/report-prod-run.js <auditPath> <runId> <outPath?>')
    process.exit(1)
  }

  const raw = fs.readFileSync(auditPath, 'utf8').replace(/^\uFEFF/, '')
  const data = JSON.parse(raw)
  const items = (data.items || []).filter((item) => item.runId === runId)
  if (!items.length) {
    throw new Error(`No audit items found for run ${runId}`)
  }

  const frontier = items.filter((item) => item.step === 'frontier_pop')
  const first20Hosts = frontier
    .slice(0, 20)
    .map((item) => hostFromUrl(item.candidateUrl || item.meta?.finalUrl || ''))
    .filter(Boolean)
  const distinctHostCount = new Set(first20Hosts).size
  const contestedAttempts = frontier.filter((item) => item.meta?.stance === 'contested').length
  const firstSaveIndex = items.findIndex((item) => item.step === 'save' && item.status === 'ok')

  const reasons = new Map()
  items.forEach((item) => {
    const reason = item.decisions?.reason || item.meta?.reason
    if (!reason) return
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1)
  })
  const whyRejected = Array.from(reasons.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }))

  const wikiAttempts = first20Hosts.filter((host) => host.includes('wikipedia.org')).length
  const wikiSharePercent = first20Hosts.length
    ? Number(((wikiAttempts / first20Hosts.length) * 100).toFixed(2))
    : 0

  const autoPauses = items
    .filter((item) => item.step === 'reseed')
    .map((item) => ({
      ts: item.ts,
      meta: item.meta ?? null
    }))

  const summary = {
    runId,
    attempts: frontier.length,
    first20Hosts,
    distinctHostCount,
    ttfAttempts: firstSaveIndex === -1 ? null : firstSaveIndex + 1,
    wikiSharePercent,
    controversy: {
      attemptRatio: first20Hosts.length
        ? Number((contestedAttempts / first20Hosts.length).toFixed(2))
        : 0,
      saveRatio: 0,
      windowSize: first20Hosts.length
    },
    whyRejected,
    autoPauses,
    paywallEvents: items.filter(
      (item) =>
        item.step === 'fetch' &&
        ((item.meta?.reason || '').includes('paywall') ||
          (item.decisions?.reason || '').includes('paywall') ||
          (item.error?.message || '').includes('paywall'))
    ).length,
    zeroSave: { warning: false, paused: false, attempts: frontier.length },
    heroEligible: false
  }

  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2))
  }

  console.log(JSON.stringify(summary, null, 2))
}

main()

