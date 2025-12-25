'use client'

import React, { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DiscoveryCardPayload } from '@/types/discovery-card'
import { ExternalLink, Share2, Quote, BookOpen, Link as LinkIcon } from 'lucide-react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'

interface ContentModalProps {
  item: DiscoveryCardPayload | null
  isOpen: boolean
  onClose: () => void
}

export default function ContentModal({ item, isOpen, onClose }: ContentModalProps) {
  const [quotesOpen, setQuotesOpen] = useState(true)

  const formattedDate = useMemo(() => {
    if (!item?.savedAt) return ''
    try {
      return new Date(item.savedAt).toLocaleString()
    } catch {
      return ''
    }
  }, [item?.savedAt])

  const handleShare = async () => {
    if (!item) return
    const shareUrl = item.canonicalUrl || item.url
    const payload = {
      title: item.title,
      text: item.whyItMatters,
      url: shareUrl
    }
    try {
      if (navigator.share) {
        await navigator.share(payload)
      } else {
        await navigator.clipboard.writeText(shareUrl)
        alert('Link copied to clipboard')
      }
    } catch (error) {
      console.warn('[ContentModal] Share failed', error)
    }
  }

  const handleViewSource = () => {
    if (!item) return
    const url = item.canonicalUrl || item.url
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (!item) {
    return (
      <Dialog open={false} onOpenChange={onClose}>
        <DialogContent />
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="h-[88vh] w-[92vw] max-w-[1120px] overflow-hidden border-0 bg-white p-0 shadow-2xl">
        <DialogTitle className="sr-only">Discovery item</DialogTitle>
        <div className="flex h-full flex-col">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
            <div className="flex flex-col">
              <span className="text-xs uppercase tracking-wide text-slate-500">View Source</span>
              <span className="text-sm font-semibold text-slate-900">{item.domain}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleViewSource}
                disabled={!item.viewSourceOk}
                title={item.viewSourceOk ? 'Open original source' : 'Source unavailable'}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View Source
              </Button>
              <Button size="sm" variant="outline" onClick={handleShare}>
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </div>
          </header>

          <PanelGroup direction="horizontal" className="flex-1">
            <Panel defaultSize={66} minSize={45} className="flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-6 py-6">
                {item.contested && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    <p className="font-semibold">
                      Contested{item.contestedClaim ? ` · ${item.contestedClaim}` : ''}
                    </p>
                    <p className="mt-1 text-amber-800">{item.contested.note}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs">
                      {item.contested.supporting && (
                        <a
                          href={item.contested.supporting}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline"
                        >
                          Supporting evidence
                        </a>
                      )}
                      {item.contested.counter && (
                        <a
                          href={item.contested.counter}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 underline"
                        >
                          Counter view
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {item.hero?.url && (
                  <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200">
                    <img
                      src={item.hero.url.includes('wikimedia.org') || item.hero.url.includes('upload.wikimedia.org') || item.hero.url.includes('commons.wikimedia.org')
                        ? `/api/img?url=${encodeURIComponent(item.hero.url)}`
                        : item.hero.url}
                      alt={item.title}
                      className="h-auto w-full object-cover"
                    />
                  </div>
                )}

                <h2 className="text-2xl font-semibold leading-snug text-slate-900">{item.title}</h2>
                <p className="mt-3 text-base text-slate-600">{item.whyItMatters}</p>

                <section className="mt-6 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <BookOpen className="h-4 w-4" />
                    Facts &amp; Receipts
                  </div>
                  {item.facts && Array.isArray(item.facts) && item.facts.length > 0 ? (
                    <ul className="space-y-3">
                      {item.facts.map((fact) => (
                        <li
                          key={`${item.id}-${fact.label || fact.value}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800"
                        >
                          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {fact.label || 'Fact'}
                          </span>
                          <span>{fact.value}</span>
                          {fact.citation && (
                            <a
                              href={fact.citation}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 block text-xs font-semibold text-blue-600 underline"
                            >
                              Citation
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No facts available for this content.</p>
                  )}
                </section>

                {item.quotes.length > 0 && (
                  <section className="mt-6">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50"
                      onClick={() => setQuotesOpen((prev) => !prev)}
                    >
                      <span className="flex items-center gap-2">
                        <Quote className="h-4 w-4" />
                        Verbatim Quotes ({item.quotes.length})
                      </span>
                      <span className="text-xs text-slate-500">
                        {quotesOpen ? 'Hide' : 'Show'}
                      </span>
                    </button>
                    {quotesOpen && (
                      <div className="mt-3 space-y-3 text-sm text-slate-800">
                        {item.quotes.map((quote, index) => (
                          <blockquote
                            key={`${item.id}-quote-${index}`}
                            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"
                          >
                            <p className="italic text-blue-900">“{quote.text}”</p>
                            <footer className="mt-2 text-xs text-blue-700">
                              {quote.speaker && <span>{quote.speaker} · </span>}
                              {quote.citation ? (
                                <a
                                  href={quote.citation}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline"
                                >
                                  citation
                                </a>
                              ) : (
                                <span>citation unavailable</span>
                              )}
                            </footer>
                          </blockquote>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                <section className="mt-6 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provenance</h4>
                  <div className="flex flex-wrap gap-2">
                    {item.provenance.map((url, index) => (
                      <a
                        key={`${item.id}-prov-${index}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-slate-300 hover:text-slate-900"
                      >
                        <LinkIcon className="h-3 w-3" />
                        Source {index + 1}
                      </a>
                    ))}
                  </div>
                </section>

                <section className="mt-6 flex flex-wrap items-center gap-2 text-xs">
                  {item.category && (
                    <Badge variant="outline" className="bg-slate-50 text-slate-600">
                      {item.category}
                    </Badge>
                  )}
                  {typeof item.credibilityTier === 'number' && (
                    <Badge variant="secondary">Tier {item.credibilityTier}</Badge>
                  )}
                  {item.isControversy && (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                      Controversy
                    </Badge>
                  )}
                  {item.isHistory && (
                    <Badge variant="outline" className="border-purple-200 text-purple-700">
                      Archive / History
                    </Badge>
                  )}
                </section>
              </div>
            </Panel>

            <PanelResizeHandle className="relative hidden w-2 items-center justify-center bg-slate-100 md:flex">
              <span className="absolute left-1/2 top-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-300" />
            </PanelResizeHandle>

            <Panel defaultSize={34} minSize={20} className="hidden overflow-hidden border-l border-slate-100 bg-slate-50 md:flex md:flex-col">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <h3 className="text-sm font-semibold text-slate-800">Comments &amp; Notes</h3>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  Coming soon
                </Badge>
              </div>
              <div className="flex flex-1 items-center justify-center px-5 text-center text-sm text-slate-500">
                Structured reviewer notes and collaboration threads will live here.
              </div>
            </Panel>
          </PanelGroup>

          <footer className="border-t border-slate-200 bg-white px-6 py-2 text-xs text-slate-500">
            Saved {formattedDate}
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  )
}
