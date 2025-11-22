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
  metrics: {
    processed: number
    saved: number
    duplicates: number
    paywallBlocked: number
    extractOk: number
    relevanceFail: number
    persistOk: number
    skipped: number
  }
  frontier: any
  timestamp: string
}

const fetcher = async (url: string): Promise<MetricsData> => {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error('Failed to fetch metrics')
  }
  const data = await res.json()
  return data
}

export default function LiveCounters({ patchHandle, streamCounters }: LiveCountersProps) {
  const { data, error, isLoading } = useSWR<MetricsData>(
    `/api/patches/${patchHandle}/discover-metrics`,
    fetcher,
    {
      refreshInterval: 5000, // Poll every 5 seconds
      revalidateOnFocus: true
    }
  )

  const metrics = data?.metrics

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900">Live Counters</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        {[
          { 
            label: 'Processed', 
            value: streamCounters?.processed ?? metrics?.processed ?? 0,
            description: 'Items processed this run'
          },
          { 
            label: 'Saved', 
            value: metrics?.saved ?? 0,
            description: 'Total saved in DB',
            highlight: true
          },
          { 
            label: 'De-duped', 
            value: streamCounters?.duplicates ?? metrics?.duplicates ?? 0
          },
          { 
            label: 'Skipped', 
            value: streamCounters?.skipped ?? metrics?.skipped ?? 0
          },
          { 
            label: 'Paywall', 
            value: metrics?.paywallBlocked ?? 0
          },
          { 
            label: 'Extract OK', 
            value: metrics?.extractOk ?? 0
          },
          { 
            label: 'Relevance Fail', 
            value: metrics?.relevanceFail ?? 0
          },
          { 
            label: 'Persist OK', 
            value: metrics?.persistOk ?? 0
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
              {isLoading ? '...' : error ? '?' : metric.value ?? 0}
            </p>
          </div>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600">
          Failed to load metrics: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      )}
    </div>
  )
}

