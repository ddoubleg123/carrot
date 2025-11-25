/**
 * Live Counters Component
 * Fetches and displays real-time discovery metrics from DB and Redis
 */

import React, { useEffect, useState } from 'react'
import useSWR from 'swr'

interface LiveCountersProps {
  patchHandle: string
  streamCounters?: {
    frontier?: number
    duplicates?: number
    skipped?: number
    processed?: number
  }
}

interface MetricsData {
  metrics?: {
    processed: number
    saved: number
    duplicates: number
    paywallBlocked: number
    extractOk: number
    relevanceFail: number
    persistOk: number
    skipped: number
  }
  counters?: {
    processed: number
    saved: number
    heroes: number
    deduped: number
    paywall: number
    extractOk: number
    renderOk: number
    promoted: number
  }
  frontier?: any
  timestamp?: string
}

interface HeroMetricsData {
  totalHeroes: number
  readyHeroes: number
  errorHeroes: number
  draftHeroes: number
  totalContent: number
  heroesWithoutContent: number
  successRate: number
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  // Always return JSON, even on error (API returns 200 with success:false)
  const data = await res.json()
  // If API returned success:false, return default values instead of throwing
  if (!data.success && res.status === 200) {
    return {
      success: false,
      metrics: {
        processed: 0,
        saved: 0,
        duplicates: 0,
        paywallBlocked: 0,
        extractOk: 0,
        relevanceFail: 0,
        persistOk: 0,
        skipped: 0
      },
      counters: {
        processed: 0,
        saved: 0,
        heroes: 0,
        deduped: 0,
        paywall: 0,
        extractOk: 0,
        renderOk: 0,
        promoted: 0
      }
    }
  }
  if (!res.ok) {
    throw new Error('Failed to fetch metrics')
  }
  return data
}

export default function LiveCounters({ patchHandle, streamCounters }: LiveCountersProps) {
  const { data, error, isLoading } = useSWR<MetricsData>(
    `/api/patches/${patchHandle}/metrics`,
    fetcher,
    {
      refreshInterval: 2000, // Poll every 2 seconds (Phase 6 requirement)
      revalidateOnFocus: true
    }
  )

  const { data: heroData, error: heroError } = useSWR<HeroMetricsData>(
    `/api/patches/${patchHandle}/heroes/metrics`,
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true
    }
  )

  // Use counters from metrics endpoint (Phase 6: unified metrics)
  const counters = (data as any)?.counters
  const metrics = (data as any)?.metrics || {}

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">Live Counters</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        {[
          { 
            label: 'Processed', 
            value: streamCounters?.processed ?? (counters?.processed ?? metrics?.processed ?? 0),
            description: 'Items processed this run'
          },
          { 
            label: 'Saved (Sources)', 
            value: (counters?.saved ?? metrics?.saved ?? 0) as number,
            description: 'Total saved in DB',
            highlight: true
          },
          { 
            label: 'Heroes', 
            value: (counters?.heroes ?? heroData?.readyHeroes ?? 0) as number,
            description: 'Ready heroes',
            highlight: true
          },
          { 
            label: 'De-duped', 
            value: streamCounters?.duplicates ?? (counters?.deduped ?? metrics?.duplicates ?? 0) as number
          },
          { 
            label: 'Skipped', 
            value: streamCounters?.skipped ?? (metrics?.skipped ?? 0) as number
          },
          { 
            label: 'Paywall', 
            value: (counters?.paywall ?? metrics?.paywallBlocked ?? 0) as number
          },
          { 
            label: 'Extract OK', 
            value: (counters?.extractOk ?? metrics?.extractOk ?? 0) as number
          },
          { 
            label: 'Render OK', 
            value: (counters?.renderOk ?? 0) as number,
            description: 'Items rendered with Playwright'
          },
          { 
            label: 'Promoted', 
            value: (counters?.promoted ?? 0) as number,
            description: 'Sources promoted to heroes'
          },
          { 
            label: 'Hero Errors', 
            value: heroData?.errorHeroes ?? 0
          }
        ].map((metric) => (
          <div
            key={metric.label}
            className={`rounded-xl border border-slate-200 px-3 py-2 ${
              metric.highlight ? 'bg-blue-50 border-blue-300' : 'bg-slate-50'
            }`}
            title={metric.description}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {metric.label}
            </p>
            <p className={`text-lg font-semibold ${
              metric.highlight ? 'text-blue-900' : 'text-slate-900'
            }`}>
              {isLoading ? '...' : metric.value ?? 0}
            </p>
          </div>
        ))}
      </div>
      {(error || (data && !data.success)) && (
        <div className="mt-2 rounded-md bg-yellow-50 border border-yellow-200 px-2 py-1">
          <p className="text-xs text-yellow-800">
            ⚠️ Metrics unavailable: {error instanceof Error ? error.message : (data?.message || 'Unknown error')}
          </p>
        </div>
      )}
    </div>
  )
}

