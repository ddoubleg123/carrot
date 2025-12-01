/**
 * Live Counters Component
 * Fetches and displays real-time discovery metrics from DB and Redis
 * Now focused on Wikipedia deep link extraction KPIs
 */

import React from 'react'
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

interface WikipediaStatusData {
  success?: boolean
  message?: string
  status?: {
    totalPages: number
    scannedPages: number
    pagesWithCitations: number
    totalCitations: number
    processedCitations: number
    savedCitations: number
    deniedCitations: number
    pendingCitations: number
    averagePriorityScore: number | null
    agentMemoryCount?: number
    progress?: {
      pagesProgress: number
      citationsProgress: number
      overallProgress: number
    }
  }
  timestamp?: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  // Always return JSON, even on error (API returns 200 with success:false)
  const data = await res.json()
  // If API returned success:false, return default values instead of throwing
  if (!data.success && res.status === 200) {
    return {
      success: false,
      status: {
        totalPages: 0,
        scannedPages: 0,
        pagesWithCitations: 0,
        totalCitations: 0,
        processedCitations: 0,
        savedCitations: 0,
        deniedCitations: 0,
        pendingCitations: 0,
        averagePriorityScore: null,
        agentMemoryCount: 0,
        progress: {
          pagesProgress: 0,
          citationsProgress: 0,
          overallProgress: 0
        }
      }
    }
  }
  if (!res.ok) {
    throw new Error('Failed to fetch metrics')
  }
  return data
}

export default function LiveCounters({ patchHandle, streamCounters }: LiveCountersProps) {
  // Fetch Wikipedia monitoring status
  const { data: wikiData, error: wikiError, isLoading: wikiLoading } = useSWR<WikipediaStatusData>(
    `/api/patches/${patchHandle}/wikipedia-status`,
    fetcher,
    {
      refreshInterval: 3000, // Poll every 3 seconds
      revalidateOnFocus: true,
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        if (error.status === 200) return
        if (retryCount >= 3) return
        setTimeout(() => revalidate({ retryCount }), 5000)
      }
    }
  )

  // AgentMemory count is now included in the main Wikipedia status response

  const status = wikiData?.status
  const isLoading = wikiLoading

  // Wikipedia discovery KPIs in order of process
  const kpis = [
    {
      label: 'Wikipedia Pages Monitored',
      value: status?.totalPages ?? 0,
      description: 'Total Wikipedia pages found and stored for monitoring',
      highlight: false
    },
    {
      label: 'Pages Scanned',
      value: status?.scannedPages ?? 0,
      description: 'Pages with content scanned',
      highlight: false
    },
    {
      label: 'Citations Extracted',
      value: status?.totalCitations ?? 0,
      description: 'Total citations found across all Wikipedia pages',
      highlight: true
    },
    {
      label: 'Citations Processed',
      value: status?.processedCitations ?? 0,
      description: 'Citations verified and fetched',
      highlight: false
    },
    {
      label: 'Citations Saved',
      value: status?.savedCitations ?? 0,
      description: 'Citations saved to DiscoveredContent',
      highlight: true
    },
    {
      label: 'Agent Memories',
      value: status?.agentMemoryCount ?? 0,
      description: 'Relevant citations saved to AgentMemory',
      highlight: true
    },
    {
      label: 'Pending Citations',
      value: status?.pendingCitations ?? 0,
      description: 'Citations awaiting processing',
      highlight: false
    },
    {
      label: 'Avg Priority Score',
      value: status?.averagePriorityScore 
        ? Math.round(status.averagePriorityScore * 10) / 10 
        : 0,
      description: 'Average AI relevance score (0-100)',
      highlight: false,
      suffix: status?.averagePriorityScore ? '' : 'N/A'
    }
  ]

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Wikipedia Discovery KPIs</h3>
      <p className="text-xs text-gray-500 mb-3">Live metrics from Wikipedia deep link extraction</p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`rounded-xl border px-3 py-2 ${
              kpi.highlight 
                ? 'bg-blue-50 border-blue-300' 
                : 'bg-slate-50 border-slate-200'
            }`}
            title={kpi.description}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 truncate">
              {kpi.label}
            </p>
            <p className={`text-lg font-semibold ${
              kpi.highlight ? 'text-blue-900' : 'text-slate-900'
            }`}>
              {isLoading ? '...' : kpi.suffix || kpi.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
      {status?.progress && (
        <div className="mt-3 space-y-2">
          <div className="flex justify-between text-xs text-gray-600">
            <span>Overall Progress</span>
            <span className="font-semibold">{status.progress.overallProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${status.progress.overallProgress}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            <div>Pages: {status.progress.pagesProgress}%</div>
            <div>Citations: {status.progress.citationsProgress}%</div>
          </div>
        </div>
      )}
      {(wikiError || (wikiData && !wikiData.success)) && (
        <div className="mt-2 rounded-md bg-yellow-50 border border-yellow-200 px-2 py-1">
          <p className="text-xs text-yellow-800">
            ⚠️ Wikipedia metrics unavailable: {wikiError instanceof Error ? wikiError.message : (wikiData?.message || 'Unknown error')}
          </p>
        </div>
      )}
    </div>
  )
}

