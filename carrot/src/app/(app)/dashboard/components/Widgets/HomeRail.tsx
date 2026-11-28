'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

type Stats = {
  totalCarrots: number
  weeklyCurrent: number
  weeklyPercentage: number
  breakdown: {
    carrotsFromPosts: number
    engagementCarrots: number
    patchesJoined: number
  }
}

type Person = {
  id: string
  name: string
  username: string
  avatar: string | null
  patch: string
}

const EMPTY: Stats = {
  totalCarrots: 0,
  weeklyCurrent: 0,
  weeklyPercentage: 0,
  breakdown: { carrotsFromPosts: 0, engagementCarrots: 0, patchesJoined: 0 },
}

function inviteLink(username?: string | null) {
  if (!username) return 'https://gotcarrot.com'
  return `https://gotcarrot.com/people/${encodeURIComponent(username)}`
}

export default function HomeRail() {
  const { data: session } = useSession()
  const username = (session?.user as { username?: string } | undefined)?.username
  const link = inviteLink(username)
  const [copied, setCopied] = useState(false)
  const [stats, setStats] = useState<Stats>(EMPTY)
  const [people, setPeople] = useState<Person[] | null>(null)

  useEffect(() => {
    let gone = false
    fetch('/api/user/stats')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Stats | null) => {
        if (!gone && data && typeof data.totalCarrots === 'number') setStats(data)
      })
      .catch(() => undefined)
    fetch('/api/people/suggestions')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { people?: Person[] } | null) => {
        if (!gone) setPeople(Array.isArray(data?.people) && data.people.length === 3 ? data.people : [])
      })
      .catch(() => { if (!gone) setPeople([]) })
    return () => { gone = true }
  }, [])

  async function connect(person: Person) {
    const sent = await fetch(`/api/people/${encodeURIComponent(person.username)}`, { method: 'POST' })
    if (!sent.ok) return
    setPeople((current) => {
      const next = (current || []).filter((row) => row.id !== person.id)
      return next.length === 3 ? next : []
    })
  }

  const ready = people && people.length === 3 ? people : null
  const ledger = [
    ['Carrots on your posts', stats.breakdown?.carrotsFromPosts ?? 0],
    ['Replies, saves, and likes', stats.breakdown?.engagementCarrots ?? 0],
    ['Patches you joined', stats.breakdown?.patchesJoined ?? 0],
  ] as const

  return (
    <>
      <article className="rounded-[22px] border border-[#efeae3] bg-gradient-to-b from-[#fff8f2] to-[#fffcf8] p-5 shadow-[0_10px_30px_rgba(80,48,20,0.04)]">
        <img src="/carrot-logo.png" alt="" width={54} height={54} className="h-[54px] w-[54px] object-contain" />
        <h2 className="mt-3 font-serif text-[28px] font-medium tracking-tight text-[#1c1917]">Bring a friend.</h2>
        <p className="mt-2 text-sm leading-6 text-[#78716c]">The feed is already public. A friend is how it becomes a place you share.</p>
        <div className="mt-4 flex gap-2">
          <input readOnly value={link} aria-label="Invite link" className="min-w-0 flex-1 rounded-full border border-[#f0d7c4] bg-white px-3.5 py-2.5 text-[13px] text-[#1c1917] outline-none" />
          <button
            type="button"
            className="rounded-full bg-[#f26b1d] px-3.5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#d4530c]"
            onClick={() => {
              const done = () => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1200)
              }
              const fallback = () => {
                const node = document.createElement('textarea')
                node.value = link
                node.setAttribute('readonly', '')
                node.style.position = 'fixed'
                node.style.left = '-9999px'
                document.body.appendChild(node)
                node.select()
                const ok = document.execCommand('copy')
                node.remove()
                if (ok) done()
              }
              if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(link).then(done).catch(fallback)
              } else {
                fallback()
              }
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </article>

      <article className="rounded-[22px] border border-[#efeae3] bg-[#fffcf8] px-5 py-4 shadow-[0_10px_30px_rgba(80,48,20,0.04)]">
        <p className="text-[13px] font-semibold text-[#78716c]">Carrots earned</p>
        <div className="mt-1 flex items-end justify-between">
          <p className="text-[64px] font-semibold leading-none tracking-tight text-[#1c1917] tabular-nums">{stats.totalCarrots.toLocaleString()}</p>
          <p className="pb-1.5 text-[13px] text-[#78716c]">all time</p>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-[#78716c]">
          <span>This week</span>
          <span className="tabular-nums">{stats.weeklyCurrent.toLocaleString()}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f3eee8]">
          <div className="h-full rounded-full bg-gradient-to-r from-[#ffb067] to-[#f26b1d]" style={{ width: `${Math.min(100, Math.max(0, stats.weeklyPercentage || 0))}%` }} />
        </div>
      </article>

      {ready ? (
        <article className="rounded-[22px] border border-[#efeae3] bg-[#fffcf8] px-5 py-4 shadow-[0_10px_30px_rgba(80,48,20,0.04)]">
          <p className="text-[13px] font-semibold text-[#78716c]">New connections</p>
          <ul className="mt-3 space-y-3">
            {ready.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {person.avatar ? (
                    <img src={person.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-[#c2410c] text-sm font-semibold text-white">{person.name.slice(0, 1).toUpperCase()}</span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1c1917]">{person.name}</p>
                    <p className="truncate text-xs text-[#78716c]">In {person.patch}</p>
                  </div>
                </div>
                <button type="button" onClick={() => { void connect(person) }} className="shrink-0 rounded-full bg-[#f26b1d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#d4530c]">
                  Connect
                </button>
              </li>
            ))}
          </ul>
        </article>
      ) : (
        <article className="rounded-[22px] border border-[#efeae3] bg-[#fffcf8] px-5 pb-2 pt-4 shadow-[0_10px_30px_rgba(80,48,20,0.04)]">
          <h2 className="text-[15px] font-semibold text-[#1c1917]">Where they come from</h2>
          <p className="mt-1 text-sm leading-5 text-[#78716c]">This sits here until three people are ready to suggest.</p>
          <ul>
            {ledger.map(([label, value]) => (
              <li key={label} className="flex items-center justify-between border-t border-[#efeae3] py-2.5 text-sm first:mt-2">
                <span className="text-[#1c1917]">{label}</span>
                <b className="tabular-nums font-semibold">{value.toLocaleString()}</b>
              </li>
            ))}
          </ul>
        </article>
      )}
    </>
  )
}
