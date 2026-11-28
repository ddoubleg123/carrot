'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import MinimalNav from '@/components/MinimalNav'
import InterestPicker from '@/components/interests/InterestPicker'
import type { InterestPick } from '@/lib/interestCatalog'

export default function TopicsPage() {
  const [initial, setInitial] = useState<InterestPick[] | null>(null)
  const [picks, setPicks] = useState<InterestPick[]>([])
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/interests')
      .then((res) => res.json())
      .then((body) => {
        const rows = Array.isArray(body?.picks) ? body.picks as InterestPick[] : []
        setInitial(rows)
        setPicks(rows)
      })
      .catch(() => setInitial([]))
  }, [])

  const save = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks })
      })
      const body = await res.json().catch(() => ({}))
      setMessage(res.ok ? 'Saved. Home will use these the next time it loads.' : (body?.error || 'Could not save.'))
    } catch {
      setMessage('Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="sticky top-0 h-screen w-20 shrink-0 self-start border-r border-gray-200 bg-gray-50">
        <MinimalNav />
      </aside>
      <main className="mx-auto w-full max-w-xl px-6 py-8">
        <p className="text-sm font-medium text-orange-600">Account</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">Topics</h1>
        <p className="mt-1 text-sm text-gray-500">These are the starting subjects on your home feed. A topic you added yourself stays yours until it is filed under a group.</p>
        <p className="mt-3 text-sm"><Link href="/settings" className="text-orange-700 underline">Back to settings</Link></p>
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
          {initial === null ? <p className="text-sm text-gray-500">Loading…</p> : <InterestPicker initial={initial} onChange={setPicks} />}
          <button
            type="button"
            onClick={save}
            disabled={saving || picks.length < 3}
            className="mt-4 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:bg-gray-200 disabled:text-gray-400"
          >
            {saving ? 'Saving…' : 'Save topics'}
          </button>
          {message && <p className="mt-2 text-sm text-gray-700">{message}</p>}
        </div>
      </main>
    </div>
  )
}
