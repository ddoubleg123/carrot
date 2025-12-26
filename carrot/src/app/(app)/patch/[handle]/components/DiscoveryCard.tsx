'use client'

import { Button } from '@/components/ui/button'
import { DiscoveryCardPayload } from '@/types/discovery-card'
import { Share2, AlertTriangle } from 'lucide-react'
import React, { useState } from 'react'

interface DiscoveryCardProps {
  item: DiscoveryCardPayload
  onSelect?: (item: DiscoveryCardPayload) => void
}

export function DiscoveryCard({ item, onSelect }: DiscoveryCardProps) {
  // Check multiple sources for hero image: hero object, mediaAssets, or fallback
  // mediaAssets.hero is a string URL, not an object
  const mediaAssetsHero = (item as any).mediaAssets?.hero
  const heroObjectUrl = item.hero && typeof item.hero === 'object' ? item.hero.url : null
  const heroStringUrl = typeof item.hero === 'string' ? item.hero : null
  const heroUrl = heroObjectUrl ?? heroStringUrl ?? 
                  (mediaAssetsHero && typeof mediaAssetsHero === 'string' ? mediaAssetsHero : null) ??
                  null
  
  // Track if hero image failed to load
  const [heroImageError, setHeroImageError] = useState(false)
  
  // Log for debugging
  if (!heroUrl) {
    console.log('[DiscoveryCard] No hero URL found for item:', {
      id: item.id,
      title: item.title,
      hero: item.hero,
      mediaAssets: (item as any).mediaAssets
    })
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
        {heroUrl && !heroImageError ? (
          <img
            src={
              // Handle data URIs (SVG placeholders) directly
              heroUrl.startsWith('data:image/') 
                ? heroUrl
                // Handle Wikimedia URLs through proxy
                : (heroUrl.includes('wikimedia.org') || heroUrl.includes('upload.wikimedia.org') || heroUrl.includes('commons.wikimedia.org'))
                  ? `/api/img?url=${encodeURIComponent(heroUrl)}`
                  // All other URLs (including external images) go through proxy for CORS
                  : `/api/img?url=${encodeURIComponent(heroUrl)}`
            }
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            onError={(e) => {
              console.error('[DiscoveryCard] Hero image failed to load:', {
                heroUrl,
                error: e,
                itemId: item.id,
                title: item.title
              })
              setHeroImageError(true)
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-600 to-orange-500 px-6 text-center text-lg font-semibold text-white">
            {item.title}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-5">
        <h3 className="text-lg font-semibold text-slate-900 line-clamp-2">
          {(item as any).displayTitle || item.title}
        </h3>
        
        <div className="mt-auto" onClick={(event) => event.stopPropagation()}>
          <Button variant="outline" size="sm" className="w-full" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>
      </div>
    </div>
  )
}