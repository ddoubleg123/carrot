'use client'

import { Fragment, useEffect, useState } from 'react'
import { officeHandle } from '@/lib/officeHandle'
import type { FeedItem, Official } from '@/lib/polWatch'
import { FeedRectangle } from '@/components/search/HalfPageAd'

const WATCH_CACHE = 'carrot-pol-watch-v1'

function partyMark(party: string) {
  if (/dem/i.test(party)) return 'Democrat'
  if (/rep/i.test(party)) return 'Republican'
  return party
}

const KIND: Record<FeedItem['kind'], string> = {
  bill: 'Legislation',
  hearing: 'Hearing',
  news: 'News',
  post: 'Their post',
  mention: 'People are saying'
}

function ago(value: string) {
  const time = Date.parse(value || '')
  if (!Number.isFinite(time)) return ''
  const mins = Math.max(0, Math.round((Date.now() - time) / 60000))
  if (mins < 60) return mins < 1 ? 'just now' : `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

function StoryPicture({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!/^https?:\/\//i.test(url)) {
      setSrc('')
      return
    }
    let gone = false
    setSrc(null)
    fetch(`/api/internal/preview-image?url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (gone) return
        const next = typeof data?.image === 'string' ? data.image : ''
        setSrc(next ? `${next}?v=${Date.now()}` : '')
      })
      .catch(() => {
        if (!gone) setSrc('')
      })
    return () => {
      gone = true
    }
  }, [url])
  if (src === '') return null
  return (
    <div className="relative h-[150px] w-full overflow-hidden bg-[#F6F3EE]">
      {src ? <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover object-center" /> : null}
    </div>
  )
}

function sameStaff(a: { name?: string; email?: string }, b: { name?: string; email?: string }) {
  const email = (a.email || '').toLowerCase().replace(/\s+/g, '')
  const other = (b.email || '').toLowerCase().replace(/\s+/g, '')
  if (email && other && email === other) return true
  const key = (name: string) => {
    const bits = name.toLowerCase().split(/[^a-z]+/).filter((part) => part.length > 1)
    if (!bits.length) return ''
    if (bits.length === 1) return bits[0]
    return `${bits[0][0]}:${bits[bits.length - 1]}`
  }
  const who = key(a.name || '')
  return Boolean(who) && who === key(b.name || '')
}

function WatchCard({ item, photo, onPass }: { item: FeedItem; photo?: string; onPass: () => void }) {
  const body = item.detail && item.detail !== item.title ? item.detail : item.title
  const when = ago(item.at)
  return (
    <article className="flex flex-col overflow-hidden rounded-[18px] border border-[#E6E8EC] bg-white sm:flex-row">
      <div className="min-w-0 flex-1 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          {photo ? (
            <img src={photo} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E7E5E4] text-sm font-semibold text-[#44403C]">{item.personName.slice(0, 1)}</span>
          )}
          <div className="min-w-0">
            <span className="font-semibold text-[#1C1917]">{item.personName}</span>
            {when && <span className="text-[#A8A29E]"> · {when}</span>}
          </div>
        </div>
        <p className="mt-3 text-[15.5px] leading-6 text-[#44403C]">{body}</p>
        <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-xl border border-[#E7E5E4]">
          <StoryPicture url={item.url} />
          <div className="px-3 py-2.5">
            <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#78716C]">{KIND[item.kind]}{item.source ? ` · ${item.source}` : ''}</div>
            <div className="mt-1 text-[15px] font-semibold leading-5 text-[#1C1917]">{item.title}</div>
          </div>
        </a>
      </div>
      <div className="flex flex-row items-center justify-center gap-1 border-t border-[#F0EEE9] bg-[#FFFcf8] px-2 py-2 sm:w-[92px] sm:flex-col sm:self-stretch sm:border-l sm:border-t-0 sm:py-3">
        <a href={item.url} target="_blank" rel="noreferrer" aria-label="Open this story" title="Open" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#78716C] hover:bg-[#F4F1EC] hover:text-[#1C1917]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /></svg>
        </a>
        <button type="button" aria-label="Not interested" onClick={onPass} className="mt-1 flex w-[76px] flex-col items-center gap-1 rounded-xl px-1 py-2 text-[#78716C] hover:bg-[#F4F1EC] hover:text-[#1C1917]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 3l18 18M10.6 6.1A8 8 0 0 1 20 12c-.6 1-1.5 2-2.6 2.8M6.7 6.7C5 8 3.8 9.8 3 12c1.3 2.4 4.4 6 9 6 1.5 0 2.8-.4 4-.9" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
          <span className="text-center text-[11px] font-semibold leading-tight">Not interested</span>
        </button>
      </div>
    </article>
  )
}

export default function PolWatch() {
  const [zip, setZip] = useState('')
  const [place, setPlace] = useState('')
  const [lineup, setLineup] = useState<Official[]>([])
  const [chosen, setChosen] = useState<Record<string, boolean>>({})
  const [watching, setWatching] = useState<Official[]>([])
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [focus, setFocus] = useState('')
  const [view, setView] = useState<string[]>([])
  const [passed, setPassed] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [looking, setLooking] = useState(false)
  const [updated, setUpdated] = useState('')
  const [ready, setReady] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [topic, setTopic] = useState('')
  const [activeTopic, setActiveTopic] = useState('')
  const [topicFeed, setTopicFeed] = useState<FeedItem[] | null>(null)
  const [searching, setSearching] = useState(false)

  const remember = (people: Official[], nextFocus: string, nextZip: string) => {
    try {
      localStorage.setItem(WATCH_CACHE, JSON.stringify({ people, focus: nextFocus, zip: nextZip }))
    } catch {}
  }

  const loadPeople = async () => {
    const res = await fetch('/api/pol-watch?part=people', { cache: 'no-store' })
    if (!res.ok) return
    const body = await res.json()
    const people = Array.isArray(body.people) ? body.people as Official[] : []
    setWatching(people)
    setFocus((current) => current && people.some((person) => person.id === current) ? current : '')
    setConfirmed(true)
  }

  const loadFeed = async () => {
    const res = await fetch('/api/pol-watch?part=feed', { cache: 'no-store' })
    if (!res.ok) return
    const body = await res.json()
    setFeed(Array.isArray(body.feed) ? body.feed : [])
    setUpdated(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
  }

  useEffect(() => {
    fetch('/api/pol-watch/badge', { method: 'POST' }).catch(() => {});
    try {
      const raw = localStorage.getItem(WATCH_CACHE)
      const saved = raw ? JSON.parse(raw) as { people?: Official[]; focus?: string; zip?: string } : null
      if (saved && Array.isArray(saved.people) && saved.people.length) {
        setWatching(saved.people)
        if (saved.focus) setFocus(saved.focus)
      }
      if (saved?.zip) setZip(saved.zip)
    } catch {}
    setReady(true)
    loadPeople().then(() => loadFeed()).catch(() => {})
    const timer = window.setInterval(() => { loadFeed().catch(() => {}) }, 45000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!confirmed) return
    remember(watching, focus, zip)
  }, [confirmed, watching, focus, zip])

  const lookup = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/pol-watch?zip=${encodeURIComponent(zip)}`)
      const body = await res.json()
      if (!res.ok) {
        setError(body.error || 'That zip code could not be looked up.')
        setLineup([])
        return
      }
      const people = Array.isArray(body.people) ? body.people as Official[] : []
      setPlace(body.place || '')
      setLineup(people)
      setChosen(Object.fromEntries(people.map((person) => [person.id, true])))
      setLooking(true)
    } catch {
      setError('That zip code could not be looked up.')
    } finally {
      setBusy(false)
    }
  }

  const persist = async (next: Official[]) => {
    setSaving(true)
    const res = await fetch('/api/pol-watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ people: next })
    })
    setSaving(false)
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    if (!res.ok) return
    const body = await res.json()
    const people = Array.isArray(body.people) ? body.people as Official[] : next
    setWatching(people)
    setLooking(false)
    setConfirmed(true)
  }

  const addChosen = () => {
    const adding = lineup.filter((person) => chosen[person.id]).map((person) => ({ ...person, zip, place }))
    const byId = new Map(watching.map((person) => [person.id, person]))
    for (const person of adding) byId.set(person.id, { ...byId.get(person.id), ...person })
    persist([...byId.values()])
    setLooking(false)
  }

  const searchTopic = async (value: string, personIds = view) => {
    const query = value.trim()
    if (!query) {
      setActiveTopic('')
      setTopicFeed(null)
      return
    }
    setSearching(true)
    const params = new URLSearchParams({ topic: query })
    if (personIds.length === 1) params.set('person', personIds[0])
    const res = await fetch(`/api/pol-watch?${params}`, { cache: 'no-store' })
    const body = res.ok ? await res.json() : { feed: [] }
    setTopicFeed(Array.isArray(body.feed) ? body.feed : [])
    setActiveTopic(query)
    setSearching(false)
  }

  const showAll = () => {
    setView([])
    setFocus('')
    if (activeTopic) searchTopic(activeTopic, [])
  }

  const toggleView = (id: string) => {
    const next = view.includes(id) ? view.filter((item) => item !== id) : (view.length === 0 ? [id] : [...view, id])
    setView(next)
    setFocus(next.includes(id) ? id : (next[0] || ''))
    if (activeTopic) searchTopic(activeTopic, next)
  }

  const stopTracking = (id: string) => {
    const next = view.filter((item) => item !== id)
    setView(next)
    if (focus === id) setFocus(next[0] || '')
    persist(watching.filter((item) => item.id !== id))
  }

  const allOn = lineup.length > 0 && lineup.every((person) => chosen[person.id])
  const chosenCount = lineup.filter((person) => chosen[person.id]).length
  const inView = (item: FeedItem) => !passed[item.id] && (view.length === 0 || view.includes(item.personId))
  const shown = (topicFeed ?? feed).filter(inView)
  const selected = watching.find((person) => person.id === focus) || null
  const viewLabel = view.length === 0 ? 'All' : view.length === 1 ? (selected?.name || '1 person') : `${view.length} people`

  return (
    <div className="px-4 py-6 md:px-8">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-[#1C1917]">Pol Watch</h1>
        <p className="mt-1 text-sm text-[#78716C]">
          {ready ? `${watching.length} ${watching.length === 1 ? 'person' : 'people'} on this watch` : 'Opening your watch…'}
          {updated ? ` · record checked ${updated}` : ''}
        </p>
      </div>
      <section className="mt-5 rounded-3xl bg-white p-4">
        <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              lookup()
            }}
          >
            <label htmlFor="pol-zip" className="text-xs font-semibold uppercase tracking-wide text-[#A8A29E]">Add a zip</label>
            <div className="mt-2 flex gap-2">
              <input
                id="pol-zip"
                value={zip}
                onChange={(event) => setZip(event.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                inputMode="numeric"
                placeholder="30115"
                aria-label="Zip code"
                className="h-11 w-full rounded-xl border border-[#E7E5E4] px-3 tracking-widest text-[#1C1917] outline-none focus:border-[#1C1917]"
              />
              <button type="submit" disabled={busy || zip.length !== 5} className="h-11 shrink-0 rounded-xl bg-[#1C1917] px-4 text-sm font-semibold text-white disabled:opacity-40">
                {busy ? 'Looking…' : 'Add'}
              </button>
            </div>
          </form>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              searchTopic(topic)
            }}
          >
            <label htmlFor="pol-topic" className="text-xs font-semibold uppercase tracking-wide text-[#A8A29E]">
              {view.length === 1 && selected ? `Search ${selected.name}` : view.length > 1 ? 'Search this group' : 'Search this watch'}
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="pol-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder={view.length === 1 && selected ? 'A bill, a hearing, a place' : 'A topic across this feed'}
                aria-label="Topic"
                className="h-11 min-w-0 flex-1 rounded-xl border border-[#E7E5E4] px-3 text-sm text-[#1C1917] outline-none focus:border-[#1C1917]"
              />
              <button type="submit" disabled={searching || topic.trim().length < 2} className="h-11 shrink-0 rounded-xl bg-[#1C1917] px-4 text-sm font-semibold text-white disabled:opacity-40">
                {searching ? 'Searching…' : 'Search'}
              </button>
              {activeTopic && (
                <button
                  type="button"
                  className="h-11 shrink-0 rounded-xl px-3 text-sm text-[#57534E]"
                  onClick={() => {
                    setTopic('')
                    setActiveTopic('')
                    setTopicFeed(null)
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>
      </section>
      {error && <p className="mt-3 text-sm text-[#9F1239]">{error}</p>}

      {looking && (
        <section className="mt-5 rounded-3xl border border-[#E7E5E4] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[#1C1917]">{place}</h2>
              <p className="text-sm text-[#78716C]">{zip}</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-[#1C1917]">
              <input
                type="checkbox"
                checked={allOn}
                onChange={() => setChosen(Object.fromEntries(lineup.map((person) => [person.id, !allOn])))}
                className="h-4 w-4 accent-[#1C1917]"
              />
              Select all
            </label>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {lineup.map((person) => (
              <label key={person.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#E7E5E4] px-4 py-3">
                <input
                  type="checkbox"
                  checked={Boolean(chosen[person.id])}
                  onChange={() => setChosen((current) => ({ ...current, [person.id]: !current[person.id] }))}
                  className="h-4 w-4 accent-[#1C1917]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-[#1C1917]">{person.name}</span>
                  <span className="block truncate text-sm text-[#78716C]">{person.office}{person.phone ? ` · ${person.phone}` : ''}</span>
                </span>
                {person.party && <span className="text-xs text-[#57534E]">{partyMark(person.party)}</span>}
              </label>
            ))}
          </div>
          <button type="button" disabled={saving || chosenCount === 0} onClick={addChosen} className="mt-4 h-11 rounded-full bg-[#C2410C] px-5 text-sm font-semibold text-white disabled:opacity-40">
            {saving ? 'Saving…' : `Watch ${chosenCount}`}
          </button>
        </section>
      )}

      <div className="mt-6 grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="rounded-3xl bg-white p-3">
          <button type="button" onClick={showAll} className={`mb-1 w-full rounded-2xl px-3 py-2 text-left text-sm ${view.length === 0 ? 'bg-[#1C1917] font-semibold text-white' : 'text-[#57534E]'}`}>
            All · {watching.length}
          </button>
          <p className="px-3 pb-2 text-[11px] leading-4 text-[#A8A29E]">Tap names to limit this feed. × stops tracking.</p>
          {watching.map((person) => {
            const on = view.includes(person.id)
            return (
              <div key={person.id} className={`mb-1 flex items-center gap-2 rounded-2xl px-2 py-2 ${on ? 'bg-[#1C1917] text-white' : 'hover:bg-[#FAFAF9]'}`}>
                <a href={`/people/${person.username || officeHandle(person.id)}`} className="shrink-0" title={`${person.name} profile`}>
                  {person.photo ? (
                    <img src={person.photo} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${on ? 'bg-white/15' : 'bg-[#F5F5F4] text-[#57534E]'}`}>{person.name.slice(0, 1)}</span>
                  )}
                </a>
                <button
                  type="button"
                  onClick={() => toggleView(person.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-semibold">{person.name}</span>
                  <span className={`block truncate text-xs ${on ? 'text-white/70' : 'text-[#A8A29E]'}`}>{person.office}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Stop tracking ${person.name}`}
                  title={`Stop tracking ${person.name}`}
                  onClick={() => stopTracking(person.id)}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base leading-none ${on ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-[#A8A29E] hover:bg-[#F5F5F4] hover:text-[#1C1917]'}`}
                >
                  ×
                </button>
              </div>
            )
          })}
          {!ready && watching.length === 0 && <p className="px-3 py-4 text-sm text-[#78716C]">Opening your watch…</p>}
          {ready && watching.length === 0 && <p className="px-3 py-4 text-sm text-[#78716C]">Nobody is on this watch yet. Add a zip above. The people you add stay here when you come back.</p>}
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#1C1917]">{activeTopic ? `${viewLabel} · ${activeTopic}` : view.length === 0 ? 'What is moving' : viewLabel}</h2>
            <p className="text-xs text-[#A8A29E]">{activeTopic ? 'From the public record' : 'Refreshes every minute'}</p>
          </div>
          <div className="space-y-3">
            {shown.length === 0 && <p className="rounded-[18px] border border-[#E6E8EC] bg-white px-5 py-8 text-sm text-[#78716C]">{activeTopic ? `Nothing public matches ${activeTopic} for this feed.` : 'Nothing new is on the public record for this watch yet.'}</p>}
            {shown.map((item, index) => (
              <Fragment key={item.id}>
                <WatchCard item={item} photo={watching.find((person) => person.id === item.personId)?.photo} onPass={() => setPassed((current) => ({ ...current, [item.id]: true }))} />
                {index === 1 && <FeedRectangle />}
              </Fragment>
            ))}
          </div>
        </section>

        <aside className="max-h-[80vh] overflow-y-auto rounded-3xl bg-[#1C1917] p-5 text-white">
          {!selected && <p className="text-sm leading-6 text-white/70">Pick a person to see the office phone, the public email, and every staff contact the office has published.</p>}
          {selected && (
            <>
              <p className="text-xs uppercase tracking-[0.16em] text-white/50">{selected.office}</p>
              <h2 className="mt-1 text-2xl font-semibold">{selected.name}</h2>
              <a className="mt-2 inline-block text-sm text-[#FDBA74]" href={`/people/${selected.username || officeHandle(selected.id)}`}>Public profile</a>
              {selected.party && <p className="mt-1 text-sm text-white/60">{partyMark(selected.party)}{selected.zip ? ` · ${selected.zip}` : ''}</p>}
              <div className="mt-4 space-y-2 text-sm">
                {selected.phone && <a className="block text-white" href={`tel:${selected.phone}`}>{selected.phone}</a>}
                {selected.email && <a className="block break-all text-[#FDBA74]" href={`mailto:${selected.email}`}>{selected.email}</a>}
                {selected.address && <p className="text-white/70">{selected.address}</p>}
                {selected.contactForm && <a className="block text-[#FDBA74]" href={selected.contactForm} target="_blank" rel="noreferrer">Contact form</a>}
                {selected.website && <a className="block text-white/80" href={selected.website} target="_blank" rel="noreferrer">{selected.website.replace(/^https?:\/\//, '')}</a>}
              </div>
              {(selected.offices || []).length > 0 && (
                <div className="mt-5">
                  <p className="text-xs uppercase tracking-wide text-white/50">District offices</p>
                  <ul className="mt-2 space-y-2">
                    {(selected.offices || []).map((office) => (
                      <li key={`${office.city}-${office.phone}`} className="text-sm">
                        <span className="block font-medium">{office.city}</span>
                        <a href={`tel:${office.phone}`}>{office.phone}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-5">
                <p className="text-xs uppercase tracking-wide text-white/50">Staff on the public record</p>
                {(selected.staff || []).length === 0 && <p className="mt-2 text-sm text-white/60">This office has not published staff emails.</p>}
                <ul className="mt-2 space-y-3">
                  {(selected.staff || []).filter((member, index, rows) => rows.findIndex((item) => sameStaff(item, member)) === index).map((member, index) => (
                    <li key={`${index}:${member.name}:${member.role}:${member.email}`} className="text-sm">
                      <span className="block font-medium">{member.name || 'Office'}</span>
                      {member.role && <span className="block text-white/50">{member.role}</span>}
                      {member.email && <a className="block break-all text-[#FDBA74]" href={`mailto:${member.email}`}>{member.email}</a>}
                      {member.phone && <a className="block text-white/80" href={`tel:${member.phone}`}>{member.phone}</a>}
                    </li>
                  ))}
                </ul>
              </div>
              <button type="button" className="mt-5 text-sm text-white/50" onClick={() => persist(watching.filter((item) => item.id !== selected.id))}>
                Remove from watch
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
