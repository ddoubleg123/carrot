'use client'

import { useEffect, useLayoutEffect, useRef, useState, type LegacyRef, type RefObject } from 'react'
import { peekRail } from '@/components/live/LiveFeedCard'
import { FeedRectangle, LivePosterAd } from '@/components/search/HalfPageAd'
import { embedParent } from '@/lib/live/embed'
import { uncheckedRail, type RailItem } from '@/lib/live/now'
import type { RecentVideo } from '@/lib/live/recent'
import type { ChannelHit } from '@/lib/live/search'
import { CATEGORY_LABEL, CATEGORY_ORDER, PLATFORM_LABEL, type ShowCategory } from '@/lib/live/streams'

const SAVED = 'carrot-live-added'

export default function LiveDashboard() {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const chosen = useRef(false)
  const [parent, setParent] = useState('localhost')
  const [rail, setRail] = useState<RailItem[]>([])
  const [ready, setReady] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [added, setAdded] = useState<RailItem[]>([])
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<ChannelHit[]>([])
  const [searchNote, setSearchNote] = useState('')
  const [watchId, setWatchId] = useState<string | null>(null)
  const [recent, setRecent] = useState<RecentVideo[]>([])
  const [kind, setKind] = useState<ShowCategory | 'all'>('all')
  const items = [...rail, ...added.filter((item) => !rail.some((row) => row.id === item.id || row.url === item.url))]
  const selected = items.find((item) => item.id === selectedId) || items[0]
  const kinds = CATEGORY_ORDER.filter((cat) => items.some((item) => item.category === cat))
  const shown = items.filter((item) => kind === 'all' || item.category === kind)
  const live = shown.filter((item) => item.presence === 'live').sort(byViewers)
  const upcoming = shown.filter((item) => item.presence === 'upcoming').sort((a, b) => (a.startsAt || '').localeCompare(b.startsAt || ''))
  const waiting = shown.filter((item) => item.presence === 'offline')
  const notLive = [...upcoming, ...waiting]
  const clips = recent.filter((clip) => shown.some((item) => item.channelId && item.channelId === clip.channelId))
  const addedIds = new Set(added.map((item) => item.id))

  useEffect(() => { setParent(window.location.hostname || 'localhost') }, [])

  useLayoutEffect(() => {
    const show = new URLSearchParams(window.location.search).get('show')
    const cached = peekRail()
    if (show && show !== 'sxb') {
      chosen.current = true
      setSelectedId(show)
    }
    if (!cached?.items.length) return
    const items = cached.items.filter((item) => item.id !== 'sxb')
    if (items.length === 0) return
    setRail(items)
    setReady(true)
  }, [])

  useEffect(() => {
    let stop = false
    const apply = (items: RailItem[]) => {
      setRail(items)
      setReady(true)
      if (!chosen.current) {
        const top = randomLive(items)
        if (top) {
          chosen.current = true
          setSelectedId(top.id)
        }
      }
    }
    let tries = 0
    let replays = false
    const load = () => fetch('/api/live/status?page=1', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (stop || !Array.isArray(data.items)) return
        const items = (data.items as RailItem[]).filter((item) => item.id !== 'sxb')
        const partial = data.partial === true
        if (!(partial && uncheckedRail(items))) apply(items)
        if (partial && tries < 80) {
          tries += 1
          window.setTimeout(() => { if (!stop) load() }, 3000)
          return
        }
        if (!replays) {
          replays = true
          fetch('/api/live/recent').then((response) => response.json()).then((replay) => {
            if (!stop && Array.isArray(replay.videos)) setRecent(replay.videos)
          }).catch(() => {})
        }
      })
      .catch(() => { if (!stop) setReady(true) })
    load()
    return () => { stop = true }
  }, [])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return
    const current = getComputedStyle(shell).fontFamily
    if (current.includes('Emoji')) return
    shell.style.fontFamily = `"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", ${current}`
  }, [])

  useEffect(() => {
    fetch('/api/live/recent').then((response) => response.json()).then((data) => {
      if (Array.isArray(data.videos)) setRecent(data.videos)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const raw = window.localStorage.getItem(SAVED)
    if (!raw) return
    let shows: { name?: string; url?: string }[] = []
    try { shows = JSON.parse(raw) } catch { return }
    if (!Array.isArray(shows) || shows.length === 0) return
    fetch('/api/live/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shows })
    }).then((response) => response.json()).then((data) => {
      if (Array.isArray(data.items)) setAdded(data.items)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      setSearchNote('')
      return
    }
    const control = new AbortController()
    const timer = window.setTimeout(() => {
      fetch(`/api/live/search?q=${encodeURIComponent(q)}`, { signal: control.signal })
        .then((response) => response.json())
        .then((data) => {
          setHits(Array.isArray(data.hits) ? data.hits : [])
          setSearchNote(data.note === 'x'
            ? 'X lives stay on X. There is no player to put on this page.'
            : data.note === 'link'
              ? 'Paste a YouTube, Twitch, Kick, or Rumble channel link.'
              : '')
        })
        .catch(() => {})
    }, 350)
    return () => {
      window.clearTimeout(timer)
      control.abort()
    }
  }, [query])

  useEffect(() => {
    const frame = frameRef.current
    return () => {
      if (!frame) return
      // Strict mode and a refresh run this while the frame is still on the page.
      // Blanking it then sticks, because React will not rewrite an unchanged src.
      queueMicrotask(() => {
        if (!frame.isConnected) frame.src = 'about:blank'
      })
    }
  }, [])

  function choose(item: RailItem) {
    chosen.current = true
    setWatchId(null)
    setSelectedId(item.id)
    const frame = frameRef.current
    if (frame) {
      if (item.playId) {
        frame.src = playerSrc(item, window.location.hostname || parent, null)
        startWithSound(frame)
      } else {
        frame.src = 'about:blank'
      }
    }
    scrollCenterToTop()
  }

  function scrollCenterToTop() {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0
  }

  function playClip(clip: RecentVideo) {
    const channel = items.find((item) => item.channelId === clip.channelId)
    setWatchId(clip.videoId)
    if (channel) setSelectedId(channel.id)
    const frame = frameRef.current
    if (frame) {
      frame.src = youtubeSrc(clip.videoId)
      startWithSound(frame)
    }
    scrollCenterToTop()
  }

  async function addHit(hit: ChannelHit) {
    const existing = items.find((item) => item.url.replace(/\/$/, '') === hit.url.replace(/\/$/, ''))
    if (existing) {
      setQuery('')
      setHits([])
      choose(existing)
      return
    }
    const response = await fetch('/api/live/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shows: [{ name: hit.name, url: hit.url }] })
    })
    const data = await response.json()
    const item = data.items?.[0] as RailItem | undefined
    if (!item) return
    if (!item.thumb && hit.thumb) item.thumb = hit.thumb
    setAdded((current) => {
      const next = [item, ...current.filter((row) => row.id !== item.id && row.url !== item.url)]
      window.localStorage.setItem(SAVED, JSON.stringify(next.map((row) => ({ name: row.name, url: row.url }))))
      return next
    })
    setQuery('')
    setHits([])
    choose(item)
  }

  function removeAdded(id: string) {
    setAdded((current) => {
      const next = current.filter((item) => item.id !== id)
      window.localStorage.setItem(SAVED, JSON.stringify(next.map((row) => ({ name: row.name, url: row.url }))))
      return next
    })
    if (selectedId === id) {
      const fallback = randomLive(rail) || rail.find((item) => item.id !== 'sxb') || rail[0]
      if (fallback) choose(fallback)
    }
  }

  return (
    <div ref={shellRef} className="lg:grid lg:h-screen lg:grid-cols-[minmax(0,1fr)_384px] lg:overflow-x-hidden">
      <div id="live-stage" ref={scrollerRef} className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto px-4 pb-10 pt-6 sm:px-8 lg:h-screen">
          <header className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#FF6A00]">Carrot Live</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{ready && selected ? selected.name : 'Live'}</h1>
          </header>
          {!ready ? (
            <div className="flex aspect-video w-full items-end rounded-2xl bg-[#16161A] p-6">
              <p className="text-lg font-semibold">Checking who's on.</p>
            </div>
          ) : selected ? <Stage item={selected} parent={parent} frameRef={frameRef} watchId={watchId} clipTitle={recent.find((clip) => clip.videoId === watchId)?.title || null} /> : <p className="text-sm text-white/60">No channels on this rail yet.</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <FilterChip label="All" on={kind === 'all'} onPick={() => setKind('all')} />
            {kinds.map((cat) => (
              <FilterChip key={cat} label={CATEGORY_LABEL[cat]} on={kind === cat} onPick={() => setKind(cat)} />
            ))}
          </div>
          <PosterGrid title="Live now" items={ready ? live : []} onChoose={choose} empty={ready ? (kind === 'all' ? 'Nobody on this list is live.' : `Nobody in ${CATEGORY_LABEL[kind]} is live.`) : 'Checking who\'s on.'} />
          {ready ? <PosterGrid title="Not live" items={notLive} onChoose={choose} empty={kind === 'all' ? 'Everyone on this list is live.' : `Nobody in ${CATEGORY_LABEL[kind]} is off.`} /> : null}
          {clips.length > 0 ? <ReplayGrid clips={clips} onPlay={playClip} /> : null}
      </div>

      <aside className="min-w-0 overflow-x-hidden border-t border-white/10 bg-[#101014] lg:h-screen lg:overflow-y-auto lg:border-l lg:border-t-0">
        <div className="px-4 py-5">
          <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-white/10 bg-[#101014] px-4 pb-4 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Ad</p>
            <FeedRectangle />
          </div>
          <h2 className="text-sm font-semibold">Channels</h2>
          <form className="mt-3" onSubmit={(event) => { event.preventDefault(); if (hits[0]) addHit(hits[0]) }}>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Add a channel"
              className="w-full rounded-full bg-black/50 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
            />
          </form>
          {searchNote ? <p className="mt-2 text-xs text-white/60">{searchNote}</p> : <p className="mt-2 text-[11px] text-white/40">YouTube, Twitch, and Kick by name. Rumble needs the channel link.</p>}
          {hits.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {hits.map((hit) => (
                <li key={`${hit.platform}-${hit.url}`}>
                  <button type="button" onClick={() => addHit(hit)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5">
                    <span className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-white/10">
                      {hit.thumb ? <img src={hit.thumb} alt="" className="h-full w-full object-cover" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{hit.name}</span>
                      <span className="block text-[11px] text-white/45">{PLATFORM_LABEL[hit.platform]}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-xs text-white/50">{ready ? `${live.length} on now. ${upcoming.length === 0 ? 'None of the others have a start time.' : `${upcoming.length} scheduled.`}` : 'Checking who\'s on.'}</p>
          {ready ? (
            <>
              <RailGroup title="On now" items={live} selectedId={selected?.id || ''} addedIds={addedIds} onChoose={choose} onRemove={removeAdded} />
              <RailGroup title="Coming up" items={upcoming} selectedId={selected?.id || ''} addedIds={addedIds} onChoose={choose} onRemove={removeAdded} empty="No scheduled start times yet." />
              <RailGroup title="Not on" items={waiting} selectedId={selected?.id || ''} addedIds={addedIds} onChoose={choose} onRemove={removeAdded} empty="Everyone on this list is live or scheduled." />
            </>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

function Stage({ item, parent, frameRef, watchId, clipTitle }: { item: RailItem; parent: string; frameRef: RefObject<HTMLIFrameElement | null>; watchId: string | null; clipTitle: string | null }) {
  const src = watchId ? youtubeSrc(watchId) : item.playId ? playerSrc(item, parent, null) : 'about:blank'
  const showing = Boolean(watchId || item.playId)
  const platform = watchId ? 'youtube' : item.platform
  const commandable = platform === 'youtube' || platform === 'twitch'
  const clickable = commandable || platform === 'kick' || platform === 'rumble'
  const [paused, setPaused] = useState(false)
  useEffect(() => { setPaused(false) }, [src])
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = readPlayerMessage(event.data)
      const state = data?.event === 'infoDelivery' ? data.info?.playerState : undefined
      if (typeof state !== 'number') return
      setPaused(state === 2 || state === 0)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  const toggle = () => {
    if (commandable) {
      const frame = frameRef.current
      if (frame) sendPlayback(frame, platform, paused)
    }
    setPaused((on) => !on)
  }
  const frameSrc = paused && !commandable ? 'about:blank' : src
  return (
    <div>
      <div className={`relative overflow-hidden rounded-2xl bg-black ${showing ? '' : 'hidden'}`}>
        <div className="aspect-video w-full">
          <iframe
            ref={frameRef as LegacyRef<HTMLIFrameElement>}
            src={frameSrc}
            title={item.name}
            className={`h-full w-full ${paused && !commandable ? 'invisible' : ''}`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => {
              if (!item.playId && !watchId) return
              if (platform === 'youtube') listenToYoutube(frameRef.current)
              if (item.playId) startWithSound(frameRef.current)
            }}
          />
          {paused && !commandable ? (
            <div className="absolute inset-0 bg-black">
              {item.thumb ? <img src={item.thumb} alt="" className="h-full w-full object-cover" /> : null}
            </div>
          ) : null}
        </div>
        {showing && clickable ? (
          <button
            type="button"
            aria-label={paused ? 'Play' : 'Pause'}
            onClick={toggle}
            className="absolute inset-x-0 top-0 bottom-14 z-10 cursor-pointer"
          >
            {paused ? (
              <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-white">
                <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8" aria-hidden="true">
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                </svg>
              </span>
            ) : null}
          </button>
        ) : null}
        {!watchId && item.presence === 'live' ? <span className="pointer-events-none absolute left-3 top-3 z-20 rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold tracking-wide">LIVE</span> : null}
      </div>
      {showing ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">{PLATFORM_LABEL[item.platform]}</span>
          {!watchId && item.presence === 'upcoming' && item.startsAt ? <span className="text-sm text-white/70">Goes live {whenLabel(item.startsAt)}</span> : null}
          {!watchId && item.presence === 'offline' ? <span className="text-sm text-white/50">Latest show</span> : null}
          {!watchId && item.viewers != null ? <span className="text-sm text-white/70">{item.viewers.toLocaleString()} watching</span> : null}
          {watchId && clipTitle ? <p className="w-full text-sm text-white/80">{clipTitle}</p> : item.title ? <p className="w-full text-sm text-white/80">{item.title}</p> : null}
        </div>
      ) : (
        <div className="flex aspect-video w-full flex-col items-start justify-end rounded-2xl bg-[#16161A] p-6">
          <p className="text-lg font-semibold">{item.name} isn't on.</p>
          <p className="mt-2 max-w-md text-sm text-white/60">This row stays on the rail and will play here the next time the channel goes live.</p>
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, on, onPick }: { label: string; on: boolean; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className={`rounded-full px-3 py-1 text-xs font-medium ${on ? 'bg-white text-black' : 'bg-white/10 text-white/70'}`}>
      {label}
    </button>
  )
}

type PosterCell<T> = { kind: 'ad'; key: string } | { kind: 'item'; key: string; item: T }

/** One ad cell in each full group of 10. The ad's place in the group is chosen once per list. */
function usePosterCells<T>(items: T[], keyOf: (item: T) => string) {
  const cache = useRef<{ signature: string; cells: PosterCell<T>[] } | null>(null)
  const signature = items.map(keyOf).join('|')
  if (cache.current?.signature !== signature) {
    const cells: PosterCell<T>[] = []
    let index = 0
    let group = 0
    while (index < items.length) {
      if (items.length - index < 9) {
        for (; index < items.length; index++) cells.push({ kind: 'item', key: keyOf(items[index]), item: items[index] })
        break
      }
      const adAt = Math.floor(Math.random() * 10)
      for (let slot = 0; slot < 10; slot++) {
        if (slot === adAt) cells.push({ kind: 'ad', key: `ad-${group}` })
        else cells.push({ kind: 'item', key: keyOf(items[index]), item: items[index++] })
      }
      group += 1
    }
    cache.current = { signature, cells }
  }
  return cache.current.cells
}

function ReplayGrid({ clips, onPlay }: { clips: RecentVideo[]; onPlay: (clip: RecentVideo) => void }) {
  const cells = usePosterCells(clips, (clip) => clip.videoId)
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold">Replays</h2>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 xl:grid-cols-4">
        {cells.map((cell) => cell.kind === 'ad' ? <LivePosterAd key={cell.key} /> : (
          <button key={cell.key} type="button" onClick={() => onPlay(cell.item)} className="min-w-0 text-left">
            <span className="block aspect-video overflow-hidden rounded-lg bg-white/10">
              <img src={cell.item.thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </span>
            <span className="mt-1 block truncate text-[11px] text-white/45">{cell.item.channel}</span>
            <span className="block truncate text-xs">{cell.item.title}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function PosterGrid({ title, items, onChoose, empty }: { title: string; items: RailItem[]; onChoose: (item: RailItem) => void; empty: string }) {
  const cells = usePosterCells(items, (item) => item.id)
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold">{title}</h2>
      {items.length === 0 ? <p className="mt-3 text-sm text-white/45">{empty}</p> : (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 xl:grid-cols-4">
          {cells.map((cell) => cell.kind === 'ad'
            ? <LivePosterAd key={cell.key} />
            : <ChannelPoster key={cell.key} item={cell.item} onChoose={onChoose} />)}
        </div>
      )}
    </section>
  )
}

function initials(name: string) {
  const parts = name.split(' ').filter((part) => part.length > 1 && part[0] === part[0].toUpperCase())
  const letters = parts.slice(0, 2).map((part) => part[0]).join('')
  return letters || name.slice(0, 1).toUpperCase()
}

function ChannelPoster({ item, onChoose }: { item: RailItem; onChoose: (item: RailItem) => void }) {
  const [failed, setFailed] = useState(false)
  return (
    <button type="button" onClick={() => onChoose(item)} className="min-w-0 text-left">
      <span className="relative block aspect-video overflow-hidden rounded-lg bg-white/10">
        {item.thumb && !failed ? (
          <img src={item.thumb} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white/70">{initials(item.name)}</span>
        )}
        {item.presence === 'live' ? <span className="absolute left-2 top-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold">LIVE</span> : null}
      </span>
      <span className="mt-1 block truncate text-xs font-medium">{item.name}</span>
      <span className="block truncate text-[11px] text-white/45">
        {PLATFORM_LABEL[item.platform]}
        {item.category ? ` · ${CATEGORY_LABEL[item.category]}` : ''}
        {item.viewers != null ? ` · ${item.viewers.toLocaleString()}` : ''}
        {item.presence === 'upcoming' && item.startsAt ? ` · ${whenLabel(item.startsAt)}` : ''}
      </span>
    </button>
  )
}

function RailGroup({ title, items, selectedId, addedIds, onChoose, onRemove, empty }: {
  title: string
  items: RailItem[]
  selectedId: string
  addedIds: Set<string>
  onChoose: (item: RailItem) => void
  onRemove: (id: string) => void
  empty?: string
}) {
  return (
    <section className="mt-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">{title}</h3>
      {items.length === 0 && empty ? <p className="mt-2 text-xs text-white/40">{empty}</p> : null}
      <ul className="mt-2 space-y-1">
        {items.map((item) => {
          const on = item.id === selectedId
          return (
            <li key={item.id}>
              <div className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 ${on ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                <button
                  type="button"
                  onClick={() => onChoose(item)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-md bg-white/10">
                    {item.thumb ? <img src={item.thumb} alt="" className="h-full w-full object-cover" /> : null}
                    <span className={`absolute left-1 top-1 h-1.5 w-1.5 rounded-full ${item.presence === 'live' ? 'bg-red-500' : item.presence === 'upcoming' ? 'bg-amber-400' : 'bg-white/70'}`} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.name}</span>
                    <span className="block text-[11px] text-white/45">
                      {item.presence === 'upcoming' && item.startsAt ? whenLabel(item.startsAt) : PLATFORM_LABEL[item.platform]}
                      {item.viewers != null ? ` · ${item.viewers.toLocaleString()}` : ''}
                      {item.presence === 'offline' ? (item.playId ? ' · Latest' : ' · Not live') : ''}
                    </span>
                  </span>
                </button>
                {addedIds.has(item.id) ? (
                  <button type="button" onClick={() => onRemove(item.id)} className="shrink-0 text-[11px] text-white/45">Remove</button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function randomLive(items: RailItem[]): RailItem | undefined {
  const live = items.filter((item) => item.presence === 'live' && item.playId && item.id !== 'sxb')
  if (live.length === 0) return undefined
  return live[Math.floor(Math.random() * live.length)]
}

function byViewers(a: RailItem, b: RailItem): number {
  return (b.viewers || 0) - (a.viewers || 0)
}

function whenLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function readPlayerMessage(data: unknown): { event?: string; info?: { playerState?: number } } | null {
  if (!data) return null
  if (typeof data === 'string') {
    try { return JSON.parse(data) } catch { return null }
  }
  return typeof data === 'object' ? data as { event?: string; info?: { playerState?: number } } : null
}

function listenToYoutube(frame: HTMLIFrameElement | null) {
  const win = frame?.contentWindow
  if (!win) return
  win.postMessage(JSON.stringify({ event: 'listening', id: 'carrot-live' }), '*')
  win.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }), '*')
}

function sendPlayback(frame: HTMLIFrameElement, platform: string, paused: boolean) {
  const win = frame.contentWindow
  if (!win) return
  if (platform === 'youtube') {
    win.postMessage(JSON.stringify({ event: 'command', func: paused ? 'playVideo' : 'pauseVideo', args: [] }), '*')
    return
  }
  if (platform === 'twitch') {
    win.postMessage({ eventName: paused ? 'Play' : 'Pause', params: null, namespace: 'twitch-embed-player-proxy' }, '*')
  }
}

function inCursorBrowser(): boolean {
  return typeof navigator !== 'undefined' && /Cursor\//.test(navigator.userAgent)
}

function startWithSound(frame: HTMLIFrameElement | null) {
  if (inCursorBrowser()) return
  const win = frame?.contentWindow
  if (!win) return
  const send = (func: string, args: unknown[] = []) => {
    win.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
  }
  send('playVideo')
  send('unMute')
  send('setVolume', [100])
}

function youtubeSrc(videoId: string): string {
  const mute = inCursorBrowser() ? '1' : '0'
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=${mute}&playsinline=1&enablejsapi=1&cc_load_policy=1&cc_lang_pref=en`
}

function playerSrc(item: RailItem, host: string, watchId: string | null): string {
  if (item.platform === 'youtube') return youtubeSrc(watchId || item.playId || '')
  const muted = inCursorBrowser() ? 'true' : 'false'
  if (item.platform === 'twitch') {
    const parent = encodeURIComponent(embedParent(host))
    return `https://player.twitch.tv/?channel=${encodeURIComponent(item.playId || '')}&parent=${parent}&muted=${muted}&autoplay=true`
  }
  if (item.platform === 'rumble') return `https://rumble.com/embed/${item.playId}/`
  return `https://player.kick.com/${encodeURIComponent(item.playId || '')}?autoplay=true&muted=${muted}`
}
