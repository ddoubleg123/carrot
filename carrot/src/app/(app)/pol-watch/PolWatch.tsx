'use client'

import { useEffect, useState } from 'react'
import { officeHandle } from '@/lib/officeHandle'
import type { FeedItem, Official } from '@/lib/polWatch'

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

const KIND_TONE: Record<FeedItem['kind'], string> = {
  bill: 'bg-[#FFEDD5] text-[#9A3412]',
  hearing: 'bg-[#1C1917] text-white',
  news: 'bg-[#F5F5F4] text-[#44403C]',
  post: 'bg-[#DBEAFE] text-[#1E3A8A]',
  mention: 'bg-[#DCFCE7] text-[#166534]'
}

export default function PolWatch() {
  const [zip, setZip] = useState('')
  const [place, setPlace] = useState('')
  const [lineup, setLineup] = useState<Official[]>([])
  const [chosen, setChosen] = useState<Record<string, boolean>>({})
  const [watching, setWatching] = useState<Official[]>([])
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [focus, setFocus] = useState('')
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

  const searchTopic = async (value: string, personId = focus) => {
    const query = value.trim()
    if (!query) {
      setActiveTopic('')
      setTopicFeed(null)
      return
    }
    setSearching(true)
    const params = new URLSearchParams({ topic: query })
    if (personId) params.set('person', personId)
    const res = await fetch(`/api/pol-watch?${params}`, { cache: 'no-store' })
    const body = res.ok ? await res.json() : { feed: [] }
    setTopicFeed(Array.isArray(body.feed) ? body.feed : [])
    setActiveTopic(query)
    setSearching(false)
  }

  const allOn = lineup.length > 0 && lineup.every((person) => chosen[person.id])
  const chosenCount = lineup.filter((person) => chosen[person.id]).length
  const live = focus ? feed.filter((item) => item.personId === focus) : feed
  const shown = topicFeed ?? live
  const selected = watching.find((person) => person.id === focus) || null

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
              {selected ? `Search ${selected.name}` : 'Search this watch'}
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="pol-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder={selected ? 'A bill, a hearing, a place' : 'A topic across everyone here'}
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
          <button type="button" onClick={() => { setFocus(''); if (activeTopic) searchTopic(activeTopic, '') }} className={`mb-1 w-full rounded-2xl px-3 py-2 text-left text-sm ${focus ? 'text-[#57534E]' : 'bg-[#1C1917] font-semibold text-white'}`}>
            Everyone · {watching.length}
          </button>
          {watching.map((person) => {
            const on = focus === person.id
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
                  onClick={() => { setFocus(person.id); if (activeTopic) searchTopic(activeTopic, person.id) }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-semibold">{person.name}</span>
                  <span className={`block truncate text-xs ${on ? 'text-white/70' : 'text-[#A8A29E]'}`}>{person.office}</span>
                </button>
              </div>
            )
          })}
          {!ready && watching.length === 0 && <p className="px-3 py-4 text-sm text-[#78716C]">Opening your watch…</p>}
          {ready && watching.length === 0 && <p className="px-3 py-4 text-sm text-[#78716C]">Nobody is on this watch yet. Add a zip above. The people you add stay here when you come back.</p>}
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#1C1917]">{activeTopic ? `${selected ? selected.name : 'Watch'} · ${activeTopic}` : 'What is moving'}</h2>
            <p className="text-xs text-[#A8A29E]">{activeTopic ? 'From the public record' : 'Refreshes every minute'}</p>
          </div>
          <div className="space-y-3">
            {shown.length === 0 && <p className="rounded-3xl bg-white px-5 py-8 text-sm text-[#78716C]">{activeTopic ? `Nothing public matches ${activeTopic} for this search.` : 'Nothing new is on the public record for this watch yet.'}</p>}
            {shown.map((item) => (
              <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="block rounded-3xl bg-white px-5 py-4 transition hover:shadow-md">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_TONE[item.kind]}`}>{KIND[item.kind]}</span>
                  <span className="text-xs text-[#A8A29E]">{item.personName}</span>
                  {item.source && <span className="text-xs text-[#A8A29E]">· {item.source}</span>}
                </div>
                <p className="mt-2 text-[15px] font-medium leading-6 text-[#1C1917]">{item.title}</p>
                {item.detail && item.detail !== item.title && <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#57534E]">{item.detail}</p>}
              </a>
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
                  {(selected.staff || []).map((member) => (
                    <li key={member.email || member.name} className="text-sm">
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
