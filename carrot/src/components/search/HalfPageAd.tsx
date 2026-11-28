'use client'

import Script from 'next/script'
import { useEffect, useRef } from 'react'
import { pickBoardSlot } from '@/lib/boardSlot'

const CLIENT = 'ca-pub-6546894980230517'
const HALF_PAGE = '5431444472'
const IN_ARTICLE = '2609840012'
const FEED = '9103222486'
const LIVE_POSTER = '7517536436'
const LIVE_POSTER_LAYOUT = '-7f+eo+1+2-5'

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[]
  }
}

function useAdSlot() {
  const pushed = useRef(false)
  useEffect(() => {
    if (pushed.current) return
    pushed.current = true
    try {
      const queue = window.adsbygoogle || []
      window.adsbygoogle = queue
      queue.push({})
    } catch {
      pushed.current = false
    }
  }, [])
}

function AdScript() {
  return (
    <Script
      id="adsbygoogle-js"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  )
}

/** One half-page shape, the same 1:2 tile as the cards around it. */
export function HalfPageAd() {
  useAdSlot()
  return (
    <div className="aspect-[1/2] w-full overflow-hidden rounded-md">
      <AdScript />
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '100%' }}
        data-ad-client={CLIENT}
        data-ad-slot={HALF_PAGE}
      />
    </div>
  )
}

/** One slot per result set. A new signature picks again. The same set keeps its place. */
export function useBoardAdSlot(signature: string, count: number) {
  const picked = useRef<{ signature: string; slot: number } | null>(null)
  if (count < 1) picked.current = null
  else if (picked.current?.signature !== signature) picked.current = { signature, slot: pickBoardSlot(count) }
  return picked.current?.slot ?? -1
}

/** In-article unit under Sources. Width stays 336px. Height follows the ad. */
export function InArticleAd() {
  useAdSlot()
  return (
    <div className="my-4 w-[336px] max-w-full">
      <AdScript />
      <ins
        className="adsbygoogle"
        style={{ display: 'block', textAlign: 'center' }}
        data-ad-layout="in-article"
        data-ad-format="fluid"
        data-ad-client={CLIENT}
        data-ad-slot={IN_ARTICLE}
      />
    </div>
  )
}

/** In-feed unit styled like a channel poster. The box keeps a variable height. */
export function LivePosterAd() {
  useAdSlot()
  return (
    <div className="min-w-0">
      <AdScript />
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-format="fluid"
        data-ad-layout-key={LIVE_POSTER_LAYOUT}
        data-ad-client={CLIENT}
        data-ad-slot={LIVE_POSTER}
      />
    </div>
  )
}

/** 336×280 rectangle between posts in the home feed. */
export function FeedRectangle() {
  useAdSlot()
  return (
    <div className="flex justify-center py-2">
      <AdScript />
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: 336, height: 280 }}
        data-ad-client={CLIENT}
        data-ad-slot={FEED}
      />
    </div>
  )
}
