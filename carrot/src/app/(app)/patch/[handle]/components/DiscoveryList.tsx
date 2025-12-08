'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2, Plus, Search } from 'lucide-react'
import { DiscoveryCard } from './DiscoveryCard'
import { DiscoveryCardPayload } from '@/types/discovery-card'
import ContentModal from './ContentModal'
import { useDiscoveryStream } from '@/app/(app)/patch/[handle]/hooks/useDiscoveryStream'
import LivePanel from './LivePanel'
import DiscoverySkeleton from './DiscoverySkeleton'

interface DiscoveryListProps {
  patchHandle: string
}

const INITIAL_BATCH = 6

export default function DiscoveryList({ patchHandle }: DiscoveryListProps) {
  const router = useRouter()
  const [visibleItemsCount, setVisibleItemsCount] = useState(INITIAL_BATCH)
  const [selectedItem, setSelectedItem] = useState<DiscoveryCardPayload | null>(null)
  const [healthData, setHealthData] = useState<any>(null)
  const searchParams = useSearchParams()
  const showDebug = searchParams?.get('debug') === '1'
  
  // Fetch health/debug data if debug mode
  useEffect(() => {
    if (showDebug) {
      // The new API shape includes debug info in the response
      // We can also fetch metrics for additional debug info
      Promise.all([
        fetch(`/api/patches/${patchHandle}/discovered-content?limit=1&debug=1`)
          .then(res => res.json())
          .then(data => ({ api: data }))
          .catch(err => ({ api: null, error: err.message })),
        fetch(`/api/patches/${patchHandle}/metrics`)
          .then(res => res.json())
          .then(data => ({ metrics: data }))
          .catch(err => ({ metrics: null, error: err.message }))
      ]).then(([apiData, metricsData]) => {
        setHealthData({
          api: apiData.api,
          metrics: metricsData.metrics,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.error('[DiscoveryList] Debug fetch failed:', err))
    }
  }, [showDebug, patchHandle])

  const {
    state,
    items,
    start,
    pause,
    stop,
    refresh
  } = useDiscoveryStream(patchHandle)

  const dedupedItems = useMemo(() => {
    const seen = new Set<string>()
    const filtered = items.filter((item) => {
      if (seen.has(item.canonicalUrl)) {
        return false
      }
      seen.add(item.canonicalUrl)
      return true
    })
    
    // Debug logging
    if (showDebug) {
      console.log('[DiscoveryList] Items processing:', {
        rawCount: items.length,
        dedupedCount: filtered.length,
        patchHandle,
        sampleIds: filtered.slice(0, 3).map(i => i.id)
      })
    }
    
    return filtered
  }, [items, showDebug, patchHandle])

  const visibleItems = dedupedItems.slice(0, visibleItemsCount)
  const hasMoreItems = dedupedItems.length > visibleItemsCount

  const handleLoadMore = () => {
    setVisibleItemsCount((prev) => Math.min(prev + INITIAL_BATCH, dedupedItems.length))
  }

  const handleSelect = (item: DiscoveryCardPayload) => {
    // Try to extract urlSlug from item (may be in metadata or other fields)
    const itemAny = item as any
    const urlSlug = itemAny.metadata?.urlSlug || 
                    itemAny.urlSlug || 
                    (itemAny.metadata?.contentUrl?.split('/').pop())
    
    // If item has urlSlug, navigate to detail page; otherwise open modal
    if (urlSlug) {
      router.push(`/patch/${patchHandle}/content/${urlSlug}`)
    } else {
      setSelectedItem(item)
    }
  }

  const handleCloseModal = () => {
    setSelectedItem(null)
  }

  // Show empty state only if no items AND no error (error means run failed, but items may still exist in DB)
  // Decouple UI: show items from DB even if current run failed
  const showEmptyState = !state.isActive && dedupedItems.length === 0 && !state.error

  // Debug panel
  const debugInfo = showDebug ? {
    patchHandle,
    rawItemsCount: items.length,
    dedupedCount: dedupedItems.length,
    visibleCount: visibleItems.length,
    state: {
      isActive: state.isActive,
      itemsFound: state.itemsFound,
      totalSaved: state.totalSaved,
      totalSkipped: state.totalSkipped,
      totalDuplicates: state.totalDuplicates
    },
    health: healthData
  } : null

  return (
    <section className="space-y-6">
      {showDebug && debugInfo && (
        <div className="rounded-lg border-2 border-orange-500 bg-orange-50 p-4 text-sm">
          <h3 className="font-bold mb-2">🐛 Debug Panel (?debug=1)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="font-semibold">Patch Handle</div>
              <div className="text-xs font-mono">{debugInfo.patchHandle}</div>
            </div>
            <div>
              <div className="font-semibold">Raw Items</div>
              <div className="text-lg font-bold">{debugInfo.rawItemsCount}</div>
            </div>
            <div>
              <div className="font-semibold">Deduped</div>
              <div className="text-lg font-bold">{debugInfo.dedupedCount}</div>
            </div>
            <div>
              <div className="font-semibold">Visible</div>
              <div className="text-lg font-bold">{debugInfo.visibleCount}</div>
            </div>
            <div>
              <div className="font-semibold">Total Saved</div>
              <div className="text-lg font-bold">{debugInfo.state.totalSaved}</div>
            </div>
            <div>
              <div className="font-semibold">Total Skipped</div>
              <div className="text-lg font-bold">{debugInfo.state.totalSkipped}</div>
            </div>
            <div>
              <div className="font-semibold">Total Duplicates</div>
              <div className="text-lg font-bold">{debugInfo.state.totalDuplicates}</div>
            </div>
            <div>
              <div className="font-semibold">Is Active</div>
              <div className="text-lg font-bold">{debugInfo.state.isActive ? 'Yes' : 'No'}</div>
            </div>
            {debugInfo.health && (
              <>
                {debugInfo.health.api && (
                  <>
                    <div>
                      <div className="font-semibold">API Success</div>
                      <div className="text-lg font-bold">{debugInfo.health.api.success ? 'Yes' : 'No'}</div>
                    </div>
                    <div>
                      <div className="font-semibold">API Totals</div>
                      <div className="text-lg font-bold">{debugInfo.health.api.totals?.total || 0}</div>
                    </div>
                    <div>
                      <div className="font-semibold">Is Active</div>
                      <div className="text-lg font-bold">{debugInfo.health.api.isActive ? 'Yes' : 'No'}</div>
                    </div>
                    {debugInfo.health.api.debug && (
                      <>
                        <div>
                          <div className="font-semibold">Build SHA</div>
                          <div className="text-xs font-mono">{debugInfo.health.api.debug.buildSha || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="font-semibold">Last Run ID</div>
                          <div className="text-xs font-mono">{debugInfo.health.api.debug.lastRunId || 'N/A'}</div>
                        </div>
                        {debugInfo.health.api.debug.reasonWhenEmpty && (
                          <div>
                            <div className="font-semibold">Empty Reason</div>
                            <div className="text-xs">{debugInfo.health.api.debug.reasonWhenEmpty}</div>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
                {debugInfo.health.metrics && (
                  <>
                    <div>
                      <div className="font-semibold">Metrics Success</div>
                      <div className="text-lg font-bold">{debugInfo.health.metrics.success ? 'Yes' : 'No'}</div>
                    </div>
                    <div>
                      <div className="font-semibold">DB Saved</div>
                      <div className="text-lg font-bold">{debugInfo.health.metrics.counters?.saved || 0}</div>
                    </div>
                    <div>
                      <div className="font-semibold">DB Heroes</div>
                      <div className="text-lg font-bold">{debugInfo.health.metrics.counters?.heroes || 0}</div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          {debugInfo.health && (
            <div className="mt-4 pt-4 border-t border-orange-300">
              <div className="font-semibold mb-2">Debug Data (API + Metrics):</div>
              <div className="text-xs font-mono bg-white p-2 rounded overflow-auto max-h-48">
                <pre>{JSON.stringify(debugInfo.health, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <LivePanel
          isActive={state.isActive}
          isPaused={state.isPaused}
          stage={state.currentStage}
          currentStatus={state.currentStatus}
          itemsFound={state.itemsFound}
          lastItemTitle={state.lastItemTitle}
          error={state.error}
          runId={state.runId}
          runState={state.runState}
          frontierSize={state.frontierSize}
          totalDuplicates={state.totalDuplicates}
          totalSkipped={state.totalSkipped}
          totalSaved={state.totalSaved}
          patchHandle={patchHandle}
          onStart={start}
          onPause={pause}
          onStop={stop}
          onRefresh={refresh}
          className="h-full"
        />

        <div className="space-y-6">
          {state.isActive && (
            <DiscoverySkeleton
              id="discovery-skeleton"
              className="w-full"
              isActive={state.isActive}
              currentStatus={state.currentStatus}
              stage={state.currentStage}
            />
          )}

          {state.error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Last discovery run failed
              </div>
              <p className="mt-2">{state.error}</p>
              <p className="mt-1 text-xs text-red-600">
                Showing saved items from previous runs. Click Retry to start a new discovery run.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={refresh} variant="outline">
                  Retry
                </Button>
              </div>
            </div>
          )}

          {showEmptyState && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-sm">
              <Search className="h-10 w-10 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No discoveries yet</h3>
              <p className="mt-2 max-w-sm text-sm text-slate-500">
                Kick off a discovery run to pull in high-signal coverage with minority viewpoints and sourced facts.
              </p>
              <p className="mt-4 text-xs uppercase tracking-wide text-slate-400">
                Use the Discovery Live panel to start
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {visibleItems.map((item) => (
              <DiscoveryCard
                key={item.canonicalUrl || item.id}
                item={item}
                onSelect={() => handleSelect(item)}
              />
            ))}
          </div>

          {state.isActive && visibleItems.length === 0 && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for first card…
            </div>
          )}

          {hasMoreItems && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={handleLoadMore} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Load more ({dedupedItems.length - visibleItemsCount} remaining)
              </Button>
            </div>
          )}
        </div>
      </div>

      <ContentModal
        item={selectedItem}
        isOpen={Boolean(selectedItem)}
        onClose={handleCloseModal}
      />
    </section>
  )
}