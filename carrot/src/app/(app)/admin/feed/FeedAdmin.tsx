'use client'

import { useEffect, useState } from 'react'
import type { FeedRankConfig } from '@/lib/feedRank'

type Ask = { label: string; terms: string[]; count: number }
type Group = { id: string; name: string }

const FIELDS: { key: keyof FeedRankConfig; label: string }[] = [
  { key: 'group', label: 'Group you joined (hours)' },
  { key: 'follow', label: 'Person you follow (hours)' },
  { key: 'share', label: 'Share (hours)' },
  { key: 'save', label: 'Save (hours)' },
  { key: 'post', label: 'Post you write (hours)' },
  { key: 'comment', label: 'Comment (hours)' },
  { key: 'search', label: 'Search, fading over 7 days (hours)' },
  { key: 'carrot', label: 'Carrot (hours)' },
  { key: 'open', label: 'Open (hours)' },
  { key: 'stick', label: 'Not interested (hours)' },
  { key: 'dwell', label: 'Dwell, 8–90 seconds (hours)' },
  { key: 'skip', label: 'Skip under 1.5 seconds (hours)' },
  { key: 'mediaRun', label: 'Same media type in a row' },
  { key: 'bucketRun', label: 'Same topic in a row' },
  { key: 'polEvery', label: 'Pol Watch card every N posts (0 is off)' }
]

export default function FeedAdmin() {
  const [config, setConfig] = useState<FeedRankConfig | null>(null)
  const [asks, setAsks] = useState<Ask[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [message, setMessage] = useState('')
  const [deskFor, setDeskFor] = useState<Record<string, string>>({})

  const load = () => {
    fetch('/api/admin/feed')
      .then((res) => res.json())
      .then((body) => {
        setConfig(body.config)
        setAsks(body.asks || [])
        setGroups(body.groups || [])
      })
      .catch(() => setMessage('Could not load the feed settings.'))
  }

  useEffect(() => { load() }, [])

  const send = async (payload: unknown) => {
    setMessage('')
    const res = await fetch('/api/admin/feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(body?.error || 'Could not save.')
      return
    }
    setConfig(body.config)
    setAsks(body.asks || [])
    setMessage('Saved. The next home load uses these numbers.')
  }

  if (!config) return <p className="text-sm text-[#60646C]">Loading…</p>

  return (
    <div className="space-y-8">
      <form
        key={FIELDS.map((field) => config[field.key]).join(',')}
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          const data = new FormData(event.currentTarget)
          const next: Record<string, number> = {}
          for (const field of FIELDS) next[field.key] = Number(data.get(String(field.key)))
          void send({ config: { ...config, ...next } })
        }}
      >
        {FIELDS.map((field) => (
          <label key={String(field.key)} className="flex items-center justify-between gap-4 text-sm">
            <span>{field.label}</span>
            <input
              name={String(field.key)}
              type="number"
              defaultValue={Number(config[field.key])}
              className="w-24 rounded-lg border border-[#E6E8EC] px-2 py-1"
            />
          </label>
        ))}
        <div className="flex gap-2 pt-2">
          <button type="submit" className="rounded-lg bg-[#FF6A00] px-4 py-2 text-sm font-semibold text-white">Save</button>
          <button type="button" className="rounded-lg border border-[#E6E8EC] px-4 py-2 text-sm" onClick={() => void send({ action: 'reset' })}>Reset</button>
        </div>
      </form>
      {message && <p className="text-sm text-[#0B0B0F]">{message}</p>}
      <section>
        <h2 className="text-lg font-semibold">Topics people asked for</h2>
        <p className="mt-1 text-sm text-[#60646C]">Three similar asks are worth a decision. Filing adds the word to that group and moves those accounts onto it.</p>
        <ul className="mt-4 space-y-3">
          {asks.length === 0 && <li className="text-sm text-[#60646C]">No personal topics yet.</li>}
          {asks.map((ask) => (
            <li key={ask.label} className="rounded-[16px] border border-[#E6E8EC] bg-white px-4 py-3">
              <p className="font-medium">{ask.label} · {ask.count}</p>
              {ask.terms.length > 0 && <p className="text-xs text-[#60646C]">{ask.terms.join(', ')}</p>}
              <div className="mt-2 flex gap-2">
                <select
                  className="rounded-lg border border-[#E6E8EC] px-2 py-1 text-sm"
                  value={deskFor[ask.label] || ''}
                  onChange={(event) => setDeskFor((current) => ({ ...current, [ask.label]: event.target.value }))}
                >
                  <option value="">File under…</option>
                  {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
                <button
                  type="button"
                  className="rounded-lg bg-[#0B0B0F] px-3 py-1 text-sm text-white"
                  onClick={() => void send({ action: 'file', label: ask.label, deskId: deskFor[ask.label] })}
                >
                  File
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
