'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DiscoveryCardPayload } from '@/types/discovery-card'
import { ExternalLink, Share2, Link as LinkIcon, AlertTriangle } from 'lucide-react'
import React, { useMemo } from 'react'

interface DiscoveryCardProps {
  item: DiscoveryCardPayload
  onSelect?: (item: DiscoveryCardPayload) => void
}

export function DiscoveryCard({ item, onSelect }: DiscoveryCardProps) {
  // Check multiple sources for hero image: hero object, mediaAssets, or fallback
  const heroUrl = item.hero?.url ?? 
                  (item as any).mediaAssets?.hero ?? 
                  null
  const qualityBadge = useMemo(() => {
    if (item.qualityScore >= 85) return { label: 'High quality', className: 'bg-emerald-100 text-emerald-700' }
    if (item.qualityScore >= 70) return { label: 'Good quality', className: 'bg-blue-100 text-blue-700' }
    return { label: 'Needs review', className: 'bg-amber-100 text-amber-700' }
  }, [item.qualityScore])

  const relevanceBadge = useMemo(() => {
    if (item.relevanceScore >= 0.9) return { label: 'Highly relevant', className: 'bg-emerald-100 text-emerald-700' }
    if (item.relevanceScore >= 0.8) return { label: 'Relevant', className: 'bg-blue-100 text-blue-700' }
    return { label: 'Borderline', className: 'bg-amber-100 text-amber-700' }
  }, [item.relevanceScore])

  const handleViewSource = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (item.viewSourceOk) {
      window.open(item.canonicalUrl || item.url, '_blank', 'noopener,noreferrer')
    }
  }

  const handleShare = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    const shareUrl = item.canonicalUrl || item.url
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, text: item.whyItMatters, url: shareUrl })
      } else {
        await navigator.clipboard.writeText(shareUrl)
        alert('Link copied to clipboard')
      }
    } catch (error) {
      console.error('[DiscoveryCard] Share failed', error)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect?.(item)
        }
      }}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
    >
      {item.contested && (
         <div className="flex items-center gap-2 bg-amber-50 px-4 py-3 text-sm text-amber-800">
           <AlertTriangle className="h-4 w-4" />
           <div className="flex flex-col gap-1">
            <span className="font-semibold">
              Contested{item.contestedClaim ? ` · ${item.contestedClaim}` : ''}
            </span>
            <span>{item.contested.note}</span>
            <div className="flex flex-wrap gap-3 text-xs">
              {item.contested.supporting && (
                <a
                  href={item.contested.supporting}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                  onClick={(event) => event.stopPropagation()}
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
                  onClick={(event) => event.stopPropagation()}
                >
                  Counter evidence
                </a>
              )}
            </div>
           </div>
         </div>
       )}

      <div className="relative aspect-[16/9] w-full overflow-hidden">
        {heroUrl ? (
          <img
            src={heroUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-600 to-orange-500 px-6 text-center text-lg font-semibold text-white">
            {item.title}
          </div>
        )}
        <div className="absolute right-3 top-3 flex gap-2">
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${relevanceBadge.className}`}>
            {relevanceBadge.label}
          </span>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${qualityBadge.className}`}>
            {qualityBadge.label}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          <span className="rounded bg-slate-100 px-2 py-1 text-slate-700">{item.domain}</span>
          {item.sourceType && <Badge variant="secondary" className="bg-blue-50 text-blue-700">{item.sourceType}</Badge>}
          {typeof item.credibilityTier === 'number' && <Badge variant="secondary">Tier {item.credibilityTier}</Badge>}
          {item.angle && <Badge variant="outline" className="border-dashed text-slate-700">{item.angle}</Badge>}
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
          <p className="text-sm text-slate-600">{item.whyItMatters}</p>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-800">Key facts</h4>
            <ul className="space-y-2 text-sm text-slate-700">
              {item.facts.map((fact) => (
                <li key={`${item.id}-${fact.label}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{fact.label}</span>
                  <span>{fact.value}</span>
                </li>
              ))}
            </ul>
          </div>

          {item.quotes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-800">Quotes</h4>
              <div className="space-y-2">
                {item.quotes.map((quote, index) => (
                  <blockquote
                    key={`${item.id}-quote-${index}`}
                    className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900"
                  >
                    <p className="italic">“{quote.text}”</p>
                    <footer className="mt-1 text-xs font-medium text-blue-700">
                      {quote.speaker ? `${quote.speaker} · ` : ''}
                      <a href={quote.citation || item.canonicalUrl} target="_blank" rel="noreferrer" className="underline">
                        citation
                      </a>
                    </footer>
                  </blockquote>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {item.provenance.map((url, index) => (
            <a
              key={`${item.id}-prov-${index}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:border-slate-300 hover:text-slate-800"
              onClick={(event) => event.stopPropagation()}
            >
              <LinkIcon className="h-3 w-3" /> Source {index + 1}
            </a>
          ))}
        </div>

        <div className="mt-auto flex gap-3" onClick={(event) => event.stopPropagation()}>
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            disabled={!item.viewSourceOk}
            title={item.viewSourceOk ? 'View source' : 'Source unavailable'}
            onClick={handleViewSource}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View Source
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>
      </div>
    </div>
  )
}