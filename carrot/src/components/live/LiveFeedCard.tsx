'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { embedParent } from '@/lib/live/embed'
import type { RailItem } from '@/lib/live/now'
import { CATEGORY_LABEL, PLATFORM_LABEL } from '@/lib/live/streams'

/** A few live rooms for the home feed: a counted room, then a channel with no public count, and so on. */
export function pickFeedLives(items: RailItem[]): RailItem[] {
  const live = items.filter((item) => item.presence === 'live' && item.playId && item.id !== 'sxb')
  const counted = live.filter((item) => typeof item.viewers === 'number').sort((a, b) => (b.viewers || 0) - (a.viewers || 0))
  const open = live.filter((item) => item.viewers == null)
  const mixed: RailItem[] = []
  let countedIndex = 0
  let openIndex = 0
  while (mixed.length < 4 && (countedIndex < counted.length || openIndex < open.length)) {
    if (countedIndex < counted.length) mixed.push(counted[countedIndex++])
    if (mixed.length < 4 && openIndex < open.length) mixed.push(open[openIndex++])
  }
  return mixed
}

export default function LiveFeedCard({ item }: { item: RailItem }) {
  const [host, setHost] = useState('localhost')
  useEffect(() => { setHost(window.location.hostname || 'localhost') }, [])
  const src = mutedSrc(item, host)
  if (!src) return null
  const watching = typeof item.viewers === 'number' ? `${item.viewers.toLocaleString()} watching` : 'On now'
  return (
    <article className="overflow-hidden rounded-2xl border border-[#E7E5E4] bg-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">LIVE</span>
            <h3 className="truncate text-sm font-semibold text-[#1C1917]">{item.name}</h3>
          </div>
          <p className="mt-1 text-xs text-[#78716C]">{PLATFORM_LABEL[item.platform]} · {CATEGORY_LABEL[item.category]} · {watching}</p>
        </div>
        <Link href={`/live?show=${encodeURIComponent(item.id)}`} className="shrink-0 rounded-full bg-[#1C1917] px-3 py-1.5 text-xs font-semibold text-white">
          Open
        </Link>
      </div>
      <div className="aspect-video bg-black">
        <iframe
          src={src}
          title={item.name}
          className="h-full w-full"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </article>
  )
}

type RailSnap = { items: RailItem[]; partial: boolean }
const railListeners = new Set<(snap: RailSnap) => void>()
let railSnap: RailSnap | null = null
let railTimer = 0
let railTries = 0
let railFlight = false

const RAIL_KEY = 'carrot-live-rail'

function publishRail(next: RailSnap) {
  railSnap = next
  try { sessionStorage.setItem(RAIL_KEY, JSON.stringify({ at: Date.now(), items: next.items, partial: next.partial })) } catch {}
  railListeners.forEach((listener) => listener(next))
  window.clearTimeout(railTimer)
  if (!next.partial || railTries >= 8) return
  railTries += 1
  railTimer = window.setTimeout(() => refreshRail(), 4000)
}

/** The rail the home page already loaded, so Live can open on it without waiting. */
export function peekRail(): RailSnap | null {
  if (railSnap?.items.length) return railSnap
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(RAIL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: number; items?: RailItem[]; partial?: boolean }
    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) return null
    if (!parsed.at || Date.now() - parsed.at > 2 * 60 * 1000) return null
    return { items: parsed.items, partial: parsed.partial === true }
  } catch {
    return null
  }
}

function refreshRail() {
  if (railFlight) return
  railFlight = true
  fetch('/api/live/status', { cache: 'no-store' })
    .then((response) => response.json())
    .then((data: { items?: RailItem[]; partial?: boolean }) => {
      publishRail({
        items: Array.isArray(data.items) ? data.items : [],
        partial: data.partial === true
      })
    })
    .catch(() => {})
    .finally(() => { railFlight = false })
}

/** One status read for the home feed and the rail. A partial read retries after the check finishes. */
export function subscribeRail(listener: (snap: RailSnap) => void) {
  railListeners.add(listener)
  if (railSnap) listener(railSnap)
  else refreshRail()
  return () => { railListeners.delete(listener) }
}

export function RailLive() {
  const router = useRouter()
  const [item, setItem] = useState<RailItem | null>(null)
  const [host, setHost] = useState('localhost')
  useEffect(() => {
    setHost(window.location.hostname || 'localhost')
    router.prefetch('/live')
    return subscribeRail((snap) => {
      const lives = pickFeedLives(snap.items)
      setItem((current) => {
        if (current && lives.some((item) => item.id === current.id)) return current
        if (lives.length === 0) return null
        return lives[Math.floor(Math.random() * lives.length)]
      })
    })
  }, [router])
  useEffect(() => {
    if (!item) return
    router.prefetch(`/live?show=${encodeURIComponent(item.id)}`)
  }, [item, router])
  if (!item) {
    return (
      <Link href="/live" className="block rounded-2xl border border-[#E6E8EC] bg-white p-4">
        <p className="text-sm font-semibold text-[#1C1917]">Live</p>
        <p className="mt-1 text-xs text-[#78716C]">See who is on.</p>
      </Link>
    )
  }
  const src = mutedSrc(item, host)
  return (
    <Link href={`/live?show=${encodeURIComponent(item.id)}`} className="block overflow-hidden rounded-2xl border border-[#E6E8EC] bg-white">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">LIVE</span>
        <span className="truncate text-sm font-semibold text-[#1C1917]">{item.name}</span>
      </div>
      <div className="aspect-video bg-black">
        {src ? (
          <iframe
            src={src}
            title={item.name}
            className="pointer-events-none h-full w-full"
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : null}
      </div>
    </Link>
  )
}

function mutedSrc(item: RailItem, host: string): string | null {
  if (!item.playId) return null
  if (item.platform === 'youtube') return `https://www.youtube-nocookie.com/embed/${item.playId}?autoplay=1&mute=1&playsinline=1`
  if (item.platform === 'twitch') {
    return `https://player.twitch.tv/?channel=${encodeURIComponent(item.playId)}&parent=${encodeURIComponent(embedParent(host))}&muted=true&autoplay=true`
  }
  if (item.platform === 'kick') return `https://player.kick.com/${encodeURIComponent(item.playId)}?autoplay=true&muted=true`
  if (item.platform === 'rumble') return `https://rumble.com/embed/${item.playId}/`
  return null
}
