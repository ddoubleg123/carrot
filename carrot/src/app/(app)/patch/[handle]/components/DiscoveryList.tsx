'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2, Plus, Search } from 'lucide-react'
import { DiscoveryCard } from './DiscoveryCard'
import { DiscoveryCardPayload } from '@/types/discovery-card'
import ContentModal from './ContentModal'
import { useDiscoveryStream } from '@/app/(app)/patch/[handle]/hooks/useDiscoveryStream'
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
  const [linkUrl, setLinkUrl] = useState('')
  const [linkMessage, setLinkMessage] = useState<string | null>(null)
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
    refresh,
    readLink
  } = useDiscoveryStream(patchHandle)

  const handleReadLink = async (event: React.FormEvent) => {
    event.preventDefault()
    const url = linkUrl.trim()
    if (!url) return
    setLinkMessage(null)
    const message = await readLink(url)
    setLinkMessage(message)
    if (message?.startsWith('Saved')) {
      setLinkUrl('')
    }
  }

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
    if (item.id) {
      router.push(`/patch/${patchHandle}/content/${item.id}`)
      return
    }
    setSelectedItem(item)
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
      <div className="space-y-6">
          <form onSubmit={handleReadLink} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor="learn-link">Read a public page or PDF</label>
            <input
              id="learn-link"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="Paste a public page or PDF link"
              className="h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-orange-400"
            />
            <Button type="submit" disabled={state.isActive || !linkUrl.trim()} className="h-11 bg-[#FF6A00] text-white hover:bg-[#E55A00]">
              Read link
            </Button>
          </form>
          {linkMessage && (
            <p className="text-sm text-slate-600">{linkMessage}</p>
          )}
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
                {state.currentStatus || 'Ask a question on the Ask tab. Saved sources show up here.'}
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

      <ContentModal
        item={selectedItem}
        isOpen={Boolean(selectedItem)}
        onClose={handleCloseModal}
      />
    </section>
  )
}