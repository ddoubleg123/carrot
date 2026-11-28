'use client'

import { useEffect, useState } from 'react'
import { CarrotsIcon } from '@/components/icons/SidebarIcons'
import { BunchIcon, InviteIcon, RANK_ICONS, RelayIcon, StreakIcon } from '@/components/icons/RankIcons'
import { PATCH_RANKS, patchRank } from '@/lib/patchRank'

const AMOUNTS = [10, 25, 50]

const PLAYS = [
  { pay: '+50', name: 'Invite', line: 'A new person joins from you and comes back.', Icon: InviteIcon },
  { pay: '+25', name: 'Relay', line: 'Someone you brought in brings another.', Icon: RelayIcon },
  { pay: '+15', name: 'Streak', line: 'You show up on a new day.', Icon: StreakIcon },
  { pay: '+10', name: 'Play', line: 'Someone takes part on a page you sent.', Icon: CarrotsIcon },
  { pay: '+40', name: 'Bunch', line: 'Five people take part on a page you sent today.', Icon: BunchIcon },
]

export default function FundsPage() {
  const [earned, setEarned] = useState<number | null>(null)
  const [ahead, setAhead] = useState<number | null>(null)
  const [peers, setPeers] = useState<number | null>(null)
  const [cents, setCents] = useState<number | null>(null)
  const [payments, setPayments] = useState<boolean | null>(null)
  const [dollars, setDollars] = useState('25')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    fetch('/api/user/stats')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setEarned(typeof data?.totalCarrots === 'number' ? data.totalCarrots : 0))
      .catch(() => setEarned(0))
    fetch('/api/user/standing')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setPeers(typeof data?.peers === 'number' ? data.peers : 0)
        setAhead(typeof data?.ahead === 'number' ? data.ahead : null)
      })
      .catch(() => setPeers(0))
    fetch('/api/user/funds')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setCents(typeof data?.cents === 'number' ? data.cents : 0)
        setPayments(data?.payments === true)
      })
      .catch(() => {
        setCents(0)
        setPayments(false)
      })
  }, [])

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id')
    if (!sessionId) return
    window.history.replaceState({}, '', '/dashboard/funds')
    setNote('Checking the payment…')
    fetch(`/api/user/funds/confirm?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setNote(typeof data?.error === 'string' ? data.error : 'Payment did not finish.')
          return
        }
        if (typeof data?.cents === 'number') setCents(data.cents)
        setNote('Added to your balance.')
      })
      .catch(() => setNote('Payment did not finish.'))
  }, [])

  const addFunds = async () => {
    const amount = Number(dollars)
    if (!Number.isFinite(amount) || amount < 1 || amount > 500) {
      setNote('Enter an amount from $1 to $500.')
      return
    }
    setBusy(true)
    setNote('')
    try {
      const res = await fetch('/api/user/funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dollars: amount }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || typeof data?.url !== 'string') {
        setNote(typeof data?.error === 'string' ? data.error : 'Could not open Stripe.')
        setBusy(false)
        return
      }
      window.location.href = data.url
    } catch {
      setNote('Could not open Stripe.')
      setBusy(false)
    }
  }

  const rank = patchRank(earned ?? 0)
  const balance = cents == null ? null : `$${(cents / 100).toFixed(2)}`
  const picked = AMOUNTS.find((amount) => String(amount) === dollars)
  const standing = peers == null
    ? null
    : peers === 0
      ? 'No one else on the board yet.'
      : ahead == null
        ? null
        : ahead === 100
          ? 'Ahead of everyone here.'
          : `Ahead of ${ahead}% of people here.`

  return (
    <div className="max-w-xl pt-2">
      <div>
        <p className="text-sm font-medium text-orange-600">{earned == null ? 'Carrots' : rank.name}</p>
        <div className="mt-2 flex items-center gap-3">
          <CarrotsIcon className="h-9 w-9 text-orange-600" width={36} height={36} />
          {earned == null ? (
            <span className="inline-block h-10 w-16 animate-pulse rounded bg-gray-200" />
          ) : (
            <p className="text-5xl font-semibold tabular-nums tracking-tight text-gray-900">
              {earned.toLocaleString()}
            </p>
          )}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {earned == null ? 'Loading your row' : rank.next ? `${rank.left} to ${rank.next}` : 'Top of the patch'}
        </p>
        {standing && <p className="mt-1 text-sm font-medium text-gray-900">{standing}</p>}
      </div>

      <ol className="mt-6 grid grid-cols-5 gap-2">
        {PATCH_RANKS.map((step) => {
          const Icon = RANK_ICONS[step.name as keyof typeof RANK_ICONS]
          const now = earned != null && step.name === rank.name
          const done = earned != null && step.at < rank.at
          return (
            <li key={step.name} className="flex flex-col items-center text-center">
              <span
                className={
                  now
                    ? 'flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-white'
                    : done
                      ? 'flex h-11 w-11 items-center justify-center rounded-full bg-orange-100 text-orange-600'
                      : 'flex h-11 w-11 items-center justify-center rounded-full bg-white text-gray-300 ring-1 ring-gray-200'
                }
              >
                <Icon className={now ? 'h-7 w-7' : 'h-5 w-5'} />
              </span>
              <span className={`mt-2 text-xs ${now ? 'font-semibold text-orange-600' : done ? 'text-gray-700' : 'text-gray-300'}`}>
                {step.name}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="mt-5 flex gap-2" aria-hidden="true">
        {Array.from({ length: rank.plots }, (_, index) => (
          <CarrotsIcon
            key={index}
            width={22}
            height={22}
            className={index < (earned == null ? 0 : rank.filled) ? 'h-5 w-5 text-orange-600' : 'h-5 w-5 text-gray-300'}
          />
        ))}
      </div>

      <ul className="mt-8 divide-y divide-gray-200 border-t border-gray-200">
        {PLAYS.map((play) => (
          <li key={play.name} className="flex items-center gap-3 py-3">
            <play.Icon className="h-5 w-5 shrink-0 text-orange-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{play.name}</p>
              <p className="text-sm text-gray-500">{play.line}</p>
            </div>
            <p className="text-lg font-semibold tabular-nums text-orange-600">{play.pay}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 border-t border-gray-200 pt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Balance</p>
            {balance == null ? (
              <span className="mt-1 inline-block h-7 w-16 animate-pulse rounded bg-gray-200" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">{balance}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setDollars(String(amount))}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  picked === amount ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200'
                }`}
              >
                ${amount}
              </button>
            ))}
            <label className="sr-only" htmlFor="add-funds">Custom amount in dollars</label>
            <input
              id="add-funds"
              inputMode="decimal"
              value={picked ? '' : dollars}
              placeholder="Other"
              onChange={(event) => setDollars(event.target.value)}
              className="w-20 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900"
            />
            <button
              type="button"
              onClick={addFunds}
              disabled={busy}
              className="rounded-full bg-orange-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Opening' : 'Add funds'}
            </button>
          </div>
        </div>
        {payments === false && (
          <p className="mt-3 text-sm text-gray-500">Stripe test key is not in the environment yet.</p>
        )}
        {note && <p className="mt-3 text-sm text-gray-600">{note}</p>}
      </div>
    </div>
  )
}
