'use client'

import { useEffect, useMemo, useState } from 'react'
import type { InterestPick } from '@/lib/interestCatalog'
import type { InterestMatch, InterestProposal, InterestReading } from '@/lib/readInterest'

type Group = { id: string; name: string; beat: string; terms: string[] }

export default function InterestPicker({
  initial = [],
  onChange
}: {
  initial?: InterestPick[]
  onChange: (picks: InterestPick[]) => void
}) {
  const [groups, setGroups] = useState<Group[]>([])
  const [query, setQuery] = useState('')
  const [checked, setChecked] = useState<Record<string, string[]>>(() => {
    const next: Record<string, string[]> = {}
    for (const pick of initial) if (pick.kind === 'desk') next[pick.id] = pick.terms || []
    return next
  })
  const [asks, setAsks] = useState<InterestPick[]>(() => initial.filter((pick) => pick.kind === 'ask'))
  const [text, setText] = useState('')
  const [reading, setReading] = useState<InterestReading | null>(null)
  const [readingError, setReadingError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/interests/catalog')
      .then((res) => res.json())
      .then((body) => { if (Array.isArray(body?.groups)) setGroups(body.groups) })
      .catch(() => setReadingError('The group list did not load.'))
  }, [])

  const picks = useMemo<InterestPick[]>(() => {
    const chosen = groups.filter((group) => checked[group.id]).map((group) => ({
      id: group.id,
      label: group.name,
      terms: checked[group.id] || [],
      kind: 'desk' as const,
      because: (checked[group.id] || [])[0] ? `${group.name}, including ${(checked[group.id] || [])[0]}.` : undefined
    }))
    return [...chosen, ...asks]
  }, [groups, checked, asks])

  useEffect(() => {
    if (groups.length === 0) return
    onChange(picks)
  }, [picks, groups.length, onChange])

  const shown = groups.filter((group) => {
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    return group.name.toLowerCase().includes(needle) || group.beat.toLowerCase().includes(needle) || group.terms.some((term) => term.includes(needle))
  })

  const toggle = (id: string) => {
    setChecked((current) => {
      const next = { ...current }
      if (next[id]) delete next[id]
      else next[id] = []
      return next
    })
  }

  const applyMatch = (match: InterestMatch) => {
    setChecked((current) => ({ ...current, [match.id]: [...new Set([...(current[match.id] || []), ...match.terms])].slice(0, 5) }))
  }

  const keepProposal = (proposal: InterestProposal) => {
    setAsks((current) => current.some((pick) => pick.id === proposal.id) ? current : [...current, {
      id: proposal.id,
      label: proposal.name,
      terms: proposal.terms,
      kind: 'ask',
      because: 'Nothing filed here yet.'
    }])
    setReading((current) => current && ({ ...current, proposals: current.proposals.filter((item) => item.id !== proposal.id) }))
  }

  const fileProposal = (proposal: InterestProposal) => {
    if (!proposal.nearest) return
    setChecked((current) => ({
      ...current,
      [proposal.nearest as string]: [...new Set([...(current[proposal.nearest as string] || []), ...proposal.terms])].slice(0, 5)
    }))
    setReading((current) => current && ({ ...current, proposals: current.proposals.filter((item) => item.id !== proposal.id) }))
  }

  const read = async () => {
    setBusy(true)
    setReadingError('')
    try {
      const res = await fetch('/api/onboarding/interests/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setReadingError(body?.error || 'Could not read that.')
        return
      }
      const next = body as InterestReading
      next.matches?.forEach(applyMatch)
      setReading(next)
    } catch {
      setReadingError('Could not read that.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="group-search" className="text-xs font-medium text-gray-500">Search groups</label>
        <input
          id="group-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="taxes, measles, bridges"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <ul className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
        {shown.map((group) => {
          const on = Boolean(checked[group.id])
          const term = (checked[group.id] || [])[0]
          return (
            <li key={group.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(group.id)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-orange-50"
              >
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${on ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-300'}`}>{on ? '✓' : ''}</span>
                <span>
                  <span className="block text-sm font-medium text-gray-900">{group.name}</span>
                  <span className="block text-xs text-gray-500">{term ? `${group.beat} Including ${term}.` : group.beat}</span>
                </span>
              </button>
            </li>
          )
        })}
        {shown.length === 0 && <li className="px-2 py-3 text-sm text-gray-500">No group uses those words.</li>}
      </ul>
      {asks.length > 0 && (
        <ul className="space-y-1">
          {asks.map((ask) => (
            <li key={ask.id} className="flex items-center justify-between rounded-lg bg-orange-50 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">Your topic · {ask.label}</span>
                <span className="mt-0.5 block text-xs text-gray-600">Nothing filed here yet.</span>
              </span>
              <button type="button" className="text-xs text-gray-500" onClick={() => setAsks((current) => current.filter((item) => item.id !== ask.id))}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <label htmlFor="interest-text" className="text-xs font-medium text-gray-500">Or say what you like</label>
        <textarea
          id="interest-text"
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, 280))}
          rows={2}
          placeholder="Old bridges, how taxes work, measles outbreaks"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={read}
          disabled={busy || text.trim().length < 3}
          className="mt-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:bg-gray-200 disabled:text-gray-400"
        >
          {busy ? 'Reading…' : 'Read this'}
        </button>
        {readingError && <p className="mt-1 text-xs text-red-600">{readingError}</p>}
      </div>
      {reading && (
        <div className="space-y-2 text-sm">
          {reading.matches.map((match) => (
            <p key={`${match.id}-${match.kind}`} className="rounded-lg bg-green-50 px-3 py-2 text-green-900">{match.because}</p>
          ))}
          {reading.proposals.map((proposal) => (
            <div key={proposal.id} className="rounded-lg border border-gray-200 px-3 py-2">
              <p className="font-medium">{proposal.name}</p>
              <p className="text-xs text-gray-600">{proposal.because}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="rounded-full bg-orange-500 px-3 py-1 text-xs font-medium text-white" onClick={() => keepProposal(proposal)}>Keep this topic</button>
                {proposal.nearest && (
                  <button type="button" className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium" onClick={() => fileProposal(proposal)}>File under {proposal.nearestLabel}</button>
                )}
                <button type="button" className="rounded-full px-3 py-1 text-xs text-gray-500" onClick={() => setReading((current) => current && ({ ...current, proposals: current.proposals.filter((item) => item.id !== proposal.id) }))}>Drop</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500">{picks.length} of 3 topics selected.</p>
    </div>
  )
}
