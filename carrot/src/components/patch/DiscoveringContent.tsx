'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DiscoveryCardPayload } from '@/types/discovery-card'
import { DiscoveryCard } from '@/app/(app)/patch/[handle]/components/DiscoveryCard'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles, RotateCcw, AlertTriangle, Link as LinkIcon } from 'lucide-react'

interface DiscoveringContentProps {
  patchHandle: string
}

const formatSeconds = (ms?: number) => {
  if (!ms) return '—'
  return `${(ms / 1000).toFixed(1)}s`
}

const formatTimestamp = (iso: string) => {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

type DiscoverySseEvent =
  | { type: 'start'; timestamp: number; data?: { runId?: string; groupId?: string } }
  | { type: 'searching'; timestamp: number; data?: { source?: string } }
  | { type: 'saved'; timestamp: number; data: { item: DiscoveryCardPayload } }
  | { type: 'idle'; timestamp: number; message?: string }
  | { type: 'stop'; timestamp: number }
  | { type: 'error'; timestamp: number; message?: string; data?: any }
  | { type: 'skipped:duplicate' | 'skipped:low_relevance' | 'skipped:near_dup'; timestamp: number; data?: any }

export default function DiscoveringContent({ patchHandle }: DiscoveringContentProps) {
  const [cards, setCards] = useState<DiscoveryCardPayload[]>([])
  const [statusMessage, setStatusMessage] = useState<string>('Ready to start discovery')
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeToFirst, setTimeToFirst] = useState<number | undefined>()
  const [coveredAngles, setCoveredAngles] = useState<Set<string>>(new Set())
  const [contestedCovered, setContestedCovered] = useState<number>(0)
  const [selectedCard, setSelectedCard] = useState<DiscoveryCardPayload | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const addCard = useCallback((card: DiscoveryCardPayload) => {
    setCards((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === card.id)
      if (existingIndex !== -1) {
        const updated = [...prev]
        updated[existingIndex] = card
        return updated
      }
      return [card, ...prev]
    })
  }, [])

  const loadInitial = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch(`/api/patches/${patchHandle}/discovered-content?limit=40`, {
        headers: { 'Cache-Control': 'no-cache' }
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const data = await response.json()
      if (Array.isArray(data.items)) {
        setCards(data.items as DiscoveryCardPayload[])
      }
    } catch (error) {
      console.error('[Discovery] Failed to load initial cards', error)
      setError('Failed to load discovery results. Please try again.')
    }
  }, [patchHandle])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  useEffect(() => {
    setContestedCovered(cards.filter((item) => Boolean(item.contested)).length)
  }, [cards])

  useEffect(() => {
    const source = new EventSource(`/api/patches/${patchHandle}/discovery/stream`)
    eventSourceRef.current = source

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as DiscoverySseEvent
        handleSseEvent(payload)
      } catch (error) {
        console.error('[Discovery SSE] Failed to parse event', error, event.data)
      }
    }

    source.onerror = (event) => {
      console.error('[Discovery SSE] Error', event)
      setError('Discovery stream interrupted. Attempting to recover…')
      setStatusMessage('Connection lost')
    }

    return () => {
      source.close()
      eventSourceRef.current = null
    }
  }, [patchHandle])

  const handleSseEvent = useCallback((event: DiscoverySseEvent) => {
    switch (event.type) {
      case 'start':
        startTimeRef.current = performance.now()
        setIsDiscovering(true)
        setStatusMessage('Discovery engine warming up…')
        setError(null)
        break
      case 'searching':
        setIsDiscovering(true)
        setStatusMessage(`Searching ${event.data?.source || 'sources'}…`)
        break
      case 'saved':
        if (event.data?.item) {
          addCard(event.data.item)
          setStatusMessage(event.data.item.contested ? 'Saved contested viewpoint coverage' : `Saved evidence from ${event.data.item.domain}`)
          if (event.data.item.angle) {
            setCoveredAngles((prev) => {
              const next = new Set(prev)
              next.add(event.data.item.angle as string)
              return next
            })
          }
          if (!timeToFirst && startTimeRef.current) {
            setTimeToFirst(performance.now() - startTimeRef.current)
          }
        }
        break
      case 'idle':
        setIsDiscovering(false)
        setStatusMessage(event.message || 'Discovery idle')
        break
      case 'stop':
        setIsDiscovering(false)
        setStatusMessage('Discovery stopped')
        break
      case 'skipped:duplicate':
        setStatusMessage('Skipped duplicate')
        break
      case 'skipped:low_relevance':
        setStatusMessage('Skipped low relevance source')
        break
      case 'skipped:near_dup':
        setStatusMessage('Skipped near-duplicate')
        break
      case 'error':
        setIsDiscovering(false)
        setError(event.message || 'Discovery error encountered.')
        setStatusMessage('Error encountered')
        break
      default:
        break
    }
  }, [addCard, timeToFirst])

  const handleRefresh = useCallback(() => {
    loadInitial()
  }, [loadInitial])

  const stats = useMemo(() => ({
    saved: cards.length,
    anglesCovered: coveredAngles.size,
    contestedCovered,
    status: statusMessage,
    timeToFirst: timeToFirst ? formatSeconds(timeToFirst) : '—'
  }), [cards.length, coveredAngles.size, contestedCovered, statusMessage, timeToFirst])

  const skeletonState = useMemo(() => {
    if (error) return { message: error, icon: <AlertTriangle className="h-4 w-4 text-amber-600" /> }
    if (isDiscovering) return { message: 'Processing next source…', icon: <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> }
    return { message: 'Start discovery to stream new evidence.', icon: <Sparkles className="h-4 w-4 text-slate-400" /> }
  }, [isDiscovering, error])

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Discovery Live</h2>
              <p className="text-sm text-slate-600">{stats.status}</p>
            </div>
            {isDiscovering && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
          </header>

          <div className="mt-4 grid grid-cols-1 gap-4 text-sm text-slate-600">
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Items saved</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{stats.saved}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Angles covered</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{stats.anglesCovered}</p>
              {coveredAngles.size > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Array.from(coveredAngles).map((angle) => (
                    <Badge key={angle} variant="outline" className="border-slate-200 text-slate-700">
                      {angle}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Time to first</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{stats.timeToFirst}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Contested viewpoints</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{stats.contestedCovered}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <Button variant="ghost" size="sm" onClick={handleRefresh} className="gap-2 text-slate-600">
              <RotateCcw className="h-4 w-4" /> Refresh
            </Button>
            {error && <span className="text-xs text-amber-600">{error}</span>}
          </div>
        </div>

        <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
          <div className="flex flex-col items-center gap-3 text-center">
            {skeletonState.icon}
            <p>{skeletonState.message}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {cards.map((card) => (
          <DiscoveryCard key={card.id} item={card} onSelect={setSelectedCard} />
        ))}
      </div>

      <Dialog open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
        <DialogContent className="max-w-4xl">
          {selectedCard && (
            <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="space-y-4">
                <DialogHeader>
                  <DialogTitle className="text-xl font-semibold">{selectedCard.title}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-slate-600">{selectedCard.whyItMatters}</p>
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800">Facts</h3>
                  <ul className="space-y-2 text-sm text-slate-700">
                    {selectedCard.facts.map((fact) => (
                      <li key={`${selectedCard.id}-modal-${fact.label}`} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{fact.label}</span>
                        <span>{fact.value}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                {selectedCard.quotes.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-800">Quotes</h3>
                    <div className="space-y-2">
                      {selectedCard.quotes.map((quote, index) => (
                        <blockquote key={`${selectedCard.id}-modal-quote-${index}`} className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                          <p className="italic">“{quote.text}”</p>
                          <footer className="mt-1 text-xs font-medium text-blue-700">
                            {quote.speaker ? `${quote.speaker} · ` : ''}
                            <a href={quote.citation || selectedCard.canonicalUrl} target="_blank" rel="noreferrer" className="underline">
                              citation
                            </a>
                          </footer>
                        </blockquote>
                      ))}
                    </div>
                  </section>
                )}
              </div>
              <aside className="flex flex-col gap-4 border-t border-slate-200 pt-4 md:border-l md:border-t-0 md:pl-6">
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Source</p>
                  <p className="text-sm font-medium text-slate-800">{selectedCard.domain}</p>
                  <p className="text-xs text-slate-500">Saved {formatTimestamp(selectedCard.savedAt)}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-800">Provenance</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedCard.provenance.map((url, idx) => (
                      <a key={`${selectedCard.id}-modal-prov-${idx}`} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-slate-300 hover:text-slate-800">
                        <LinkIcon className="h-3 w-3" /> Source {idx + 1}
                      </a>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-slate-800">Scores</h4>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="border-slate-200 text-slate-700">
                      Relevance {Math.round(selectedCard.relevanceScore * 100)}%
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 text-slate-700">
                      Quality {Math.round(selectedCard.qualityScore)}
                    </Badge>
                  </div>
                </div>
                {selectedCard.contested && (
                  <div className="space-y-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <h4 className="text-xs font-semibold uppercase tracking-wide">Contested viewpoint</h4>
                    {selectedCard.contestedClaim && <p className="text-xs font-medium text-amber-700">{selectedCard.contestedClaim}</p>}
                    <p>{selectedCard.contested.note}</p>
                    <div className="flex flex-wrap gap-3 text-xs">
                      {selectedCard.contested.supporting && (
                        <a href={selectedCard.contested.supporting} target="_blank" rel="noreferrer" className="underline">
                          Supporting evidence
                        </a>
                      )}
                      {selectedCard.contested.counter && (
                        <a href={selectedCard.contested.counter} target="_blank" rel="noreferrer" className="underline">
                          Counter evidence
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
