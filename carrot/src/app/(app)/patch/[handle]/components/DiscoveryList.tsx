'use client'

import React, { useMemo, useState } from 'react'
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
  const [visibleItemsCount, setVisibleItemsCount] = useState(INITIAL_BATCH)
  const [selectedItem, setSelectedItem] = useState<DiscoveryCardPayload | null>(null)

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
    return items.filter((item) => {
      if (seen.has(item.canonicalUrl)) {
        return false
      }
      seen.add(item.canonicalUrl)
      return true
    })
  }, [items])

  const visibleItems = dedupedItems.slice(0, visibleItemsCount)
  const hasMoreItems = dedupedItems.length > visibleItemsCount

  const handleLoadMore = () => {
    setVisibleItemsCount((prev) => Math.min(prev + INITIAL_BATCH, dedupedItems.length))
  }

  const handleSelect = (item: DiscoveryCardPayload) => {
    setSelectedItem(item)
  }

  const handleCloseModal = () => {
    setSelectedItem(null)
  }

  const showEmptyState = !state.isActive && dedupedItems.length === 0 && !state.error

  return (
    <section className="space-y-6">
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
                Discovery stalled
              </div>
              <p className="mt-2">{state.error}</p>
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