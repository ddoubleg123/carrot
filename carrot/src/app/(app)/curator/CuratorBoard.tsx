'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FloorDesk, FloorSnapshot } from '@/lib/curator/floor'

type Filter = 'all' | 'today' | 'working' | 'quiet' | 'cap'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All desks' },
  { id: 'working', label: 'On the floor' },
  { id: 'today', label: 'Posted today' },
  { id: 'quiet', label: 'Quiet' },
  { id: 'cap', label: 'At the cap' }
]

function ago(iso: string | null, now: number): string {
  if (!iso) return 'no posts in this window'
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (seconds < 15) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 36) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function Avatar({ src, name }: { src: string; name: string }) {
  const [ok, setOk] = useState(Boolean(src))
  return (
    <span className="relative grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[#E7E0D6] text-xs font-semibold text-[#44403C]">
      {name.slice(0, 1)}
      {ok && (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setOk(false)}
        />
      )}
    </span>
  )
}

function Ticks({ today, cap }: { today: number; cap: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${today} of ${cap} posts today`}>
      {Array.from({ length: cap }, (_, index) => (
        <span
          key={index}
          className={`h-1.5 w-3 rounded-sm ${index < Math.min(today, cap) ? 'bg-[#C2410C]' : 'bg-[#E7E0D6]'}`}
        />
      ))}
      <span className="ml-1 tabular-nums text-[#57534E]">{today}/{cap}</span>
    </span>
  )
}

export function CuratorBoard({ initial }: { initial: FloorSnapshot }) {
  const [snap, setSnap] = useState<FloorSnapshot>(initial)
  const [error, setError] = useState('')
  const [fresh, setFresh] = useState<string[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const seen = useRef<Set<string>>(new Set(initial.posts.map((post) => post.id)))

  useEffect(() => {
    let stop = false
    let timer = 0
    const load = async () => {
      try {
        const response = await fetch('/api/curator', { cache: 'no-store' })
        if (!response.ok) throw new Error(response.status === 404 ? 'This page is only for your account.' : 'The floor did not load.')
        const next = await response.json() as FloorSnapshot
        if (stop) return
        const ids = new Set(next.posts.map((post) => post.id))
        setFresh(next.posts.filter((post) => !seen.current.has(post.id)).map((post) => post.id))
        seen.current = ids
        setSnap(next)
        setError('')
        setNow(Date.now())
      } catch (reason) {
        if (!stop) setError(reason instanceof Error ? reason.message : 'The floor did not load.')
      } finally {
        if (!stop) timer = window.setTimeout(load, 8000)
      }
    }
    void load()
    const clock = window.setInterval(() => setNow(Date.now()), 10000)
    return () => {
      stop = true
      window.clearTimeout(timer)
      window.clearInterval(clock)
    }
  }, [])

  const roster = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (snap?.roster || []).filter((desk) => {
      if (filter === 'today' && desk.today === 0) return false
      if (filter === 'quiet' && desk.today > 0) return false
      if (filter === 'cap' && desk.today < desk.cap) return false
      if (filter === 'working') {
        if (!desk.lastAt || now - Date.parse(desk.lastAt) > 15 * 60 * 1000) return false
      }
      if (!needle) return true
      return `${desk.name} ${desk.beat} ${desk.username}`.toLowerCase().includes(needle)
    })
  }, [snap, filter, query, now])

  const latest = snap?.posts[0]
  const pace = snap && snap.postedHour > 0 ? Math.max(1, Math.round(60 / snap.postedHour)) : null
  const peak = Math.max(1, ...(snap?.buckets || [1]))
  const age = snap ? now - Date.parse(snap.at) : 0
  const live = Boolean(snap) && !error && age < 20000

  return (
    <div className="min-h-screen bg-[#F6F3EE] text-[#1C1917]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#9A3412]">Desk floor</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">What the desks are posting</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#57534E]">
              Live posts from the desks on the server. Each one can post {snap?.roster[0]?.cap ?? 4} times today. This page refreshes on its own.
            </p>
          </div>
          <p className="flex items-center gap-2 text-sm text-[#57534E]" aria-live="polite">
            <span className={`h-2 w-2 rounded-full ${live ? 'bg-[#15803D]' : error ? 'bg-[#B91C1C]' : 'bg-[#A8A29E]'}`} />
            {!snap ? (error || 'Loading the floor…') : `Updated ${ago(snap.at, now)}`}
          </p>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Posts today" value={snap ? String(snap.postedToday) : '—'} detail="UTC day, same cutoff as the cap" />
          <Stat label="Last hour" value={snap ? String(snap.postedHour) : '—'} detail={pace ? `About one every ${pace} min` : 'Waiting on the next post'} />
          <Stat label="On the floor" value={snap ? `${snap.desksWorking}/${snap.desksTotal}` : '—'} detail="Posted in the last 15 minutes" />
          <Stat label="Quiet today" value={snap ? String(snap.desksQuiet) : '—'} detail={snap ? `${snap.desksAtCap} already used all ${snap.roster[0]?.cap ?? 4}` : 'Desks with nothing posted'} />
        </section>

        <section className="mt-3 rounded-2xl border border-[#E7E0D6] bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wide text-[#78716C]">
            <span>Last hour</span>
            <span className="normal-case tracking-normal text-[#57534E]">
              {latest ? `${latest.name} posted ${ago(latest.at, now)}` : 'No post in this window yet'}
            </span>
          </div>
          <div className="mt-3 flex h-14 items-end gap-1" aria-hidden="true">
            {(snap?.buckets || Array.from({ length: 12 }, () => 0)).map((count, index) => (
              <div key={index} className="flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-sm bg-[#C2410C]"
                  style={{ height: count === 0 ? 3 : `${Math.max(12, Math.round((count / peak) * 100))}%`, opacity: count === 0 ? 0.25 : 1 }}
                  title={`${count} post${count === 1 ? '' : 's'}`}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="rounded-2xl border border-[#E7E0D6] bg-white">
            <div className="flex items-center justify-between border-b border-[#E7E0D6] px-4 py-3">
              <h2 className="text-sm font-semibold">Posts as they land</h2>
              <span className="text-xs text-[#78716C]">{snap ? `${snap.posts.length} shown` : ''}</span>
            </div>
            {snap.posts.length === 0 ? (
              <p className="px-4 py-8 text-sm text-[#57534E]">Nothing posted in the last day and a half. New posts will show up here.</p>
            ) : (
              <ul className="max-h-[calc(100vh-18rem)] divide-y divide-[#F0EBE3] overflow-auto">
                {snap.posts.map((post) => {
                  const isNew = fresh.includes(post.id)
                  const domain = hostOf(post.source)
                  return (
                    <li key={post.id} className={`px-4 py-3 ${isNew ? 'bg-[#FFF7ED]' : ''}`}>
                      <div className="flex items-start gap-3">
                        <Avatar src={post.avatar} name={post.name} />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                            {post.handle ? (
                              <a className="font-medium underline decoration-[#E7E0D6] underline-offset-2" href={`/patch/${post.handle}`}>{post.name}</a>
                            ) : (
                              <span className="font-medium">{post.name}</span>
                            )}
                            <span className="text-[#78716C]">{ago(post.at, now)}</span>
                            {isNew && <span className="text-xs font-medium uppercase tracking-wide text-[#C2410C]">New</span>}
                          </p>
                          <h3 className="mt-1 text-base font-semibold leading-snug">{post.title}</h3>
                          {post.note && <p className="mt-1 text-sm leading-6 text-[#44403C]">{post.note}</p>}
                          <p className="mt-2 flex flex-wrap gap-3 text-sm">
                            {post.topicUrl && <a className="underline decoration-[#E7E0D6] underline-offset-2" href={post.topicUrl}>Open the topic</a>}
                            {post.source && <a className="underline decoration-[#E7E0D6] underline-offset-2" href={post.source}>{domain || 'Source'}</a>}
                          </p>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-[#E7E0D6] bg-white">
            <div className="border-b border-[#E7E0D6] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Every desk</h2>
                <span className="text-xs text-[#78716C]">{roster.length} shown</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {FILTERS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilter(item.id)}
                    className={`rounded-full px-2.5 py-1 text-xs ${filter === item.id ? 'bg-[#1C1917] text-white' : 'bg-[#F6F3EE] text-[#44403C]'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a desk"
                className="mt-3 w-full rounded-lg border border-[#E7E0D6] bg-[#FFFcf8] px-3 py-2 text-sm outline-none focus:border-[#C2410C]"
              />
            </div>
            <ul className="max-h-[calc(100vh-18rem)] divide-y divide-[#F0EBE3] overflow-auto">
              {roster.map((desk) => (
                <DeskRow key={desk.id} desk={desk} now={now} />
              ))}
              {snap && roster.length === 0 && (
                <li className="px-4 py-8 text-sm text-[#57534E]">No desk matches that.</li>
              )}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-[#E7E0D6] bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-[#78716C]">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#57534E]">{detail}</p>
    </article>
  )
}

function DeskRow({ desk, now }: { desk: FloorDesk; now: number }) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <Avatar src={desk.avatar} name={desk.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {desk.handle ? (
                <a className="font-medium underline decoration-[#E7E0D6] underline-offset-2" href={`/patch/${desk.handle}`}>{desk.name}</a>
              ) : (
                <p className="font-medium">{desk.name}</p>
              )}
              <p className="truncate text-xs text-[#78716C]">{desk.beat}</p>
            </div>
            <Ticks today={desk.today} cap={desk.cap} />
          </div>
          <p className="mt-1 truncate text-sm text-[#44403C]">
            {desk.lastTitle || 'Has not posted in this window.'}
          </p>
          <p className="mt-0.5 text-xs text-[#78716C]">{ago(desk.lastAt, now)}</p>
        </div>
      </div>
    </li>
  )
}
