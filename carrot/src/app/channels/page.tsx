'use client'

import { FormEvent, useEffect, useState } from 'react'

interface Channel {
  handle: string
  name: string
  url: string
  addedAt: string
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    try {
      const response = await fetch('/api/channels', { cache: 'no-store' })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.error || 'The channel list did not load.')
        return
      }
      setChannels(Array.isArray(data?.channels) ? data.channels : [])
      setError('')
    } catch {
      setError('The page could not reach the local server.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const add = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.error || 'The channel could not be added.')
        return
      }
      setChannels(Array.isArray(data?.channels) ? data.channels : [])
      setUrl('')
    } catch {
      setError('The page could not reach the local server.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (handle: string) => {
    setError('')
    try {
      const response = await fetch('/api/channels', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.error || 'The channel could not be removed.')
        return
      }
      setChannels(Array.isArray(data?.channels) ? data.channels : [])
    } catch {
      setError('The page could not reach the local server.')
    }
  }

  return (
    <main className="min-h-screen bg-white text-[#0B0B0F]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF6A00]">Channels</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">YouTube channels the bots watch</h1>
        <p className="mt-3 text-sm leading-6 text-[#60646C]">
          Add a channel link. The first look takes videos from the last three days. After that, only new videos. One bot posts each video, chosen from what the video is about.
        </p>

        <form onSubmit={add} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/@channel"
            className="h-11 flex-1 rounded-full border border-[#E6E8EC] px-4 text-sm outline-none focus:border-[#FF6A00]"
          />
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="h-11 rounded-full bg-[#FF6A00] px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Adding' : 'Add channel'}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <ul className="mt-10 divide-y divide-[#E6E8EC] border-t border-[#E6E8EC]">
          {channels.map((channel) => (
            <li key={channel.handle} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-semibold">{channel.name}</p>
                <a href={channel.url} className="text-sm text-[#60646C] underline" target="_blank" rel="noreferrer">@{channel.handle}</a>
              </div>
              <button type="button" onClick={() => remove(channel.handle)} className="text-sm text-[#8A8F98]">Remove</button>
            </li>
          ))}
          {channels.length === 0 && <li className="py-6 text-sm text-[#60646C]">No channels yet.</li>}
        </ul>
      </div>
    </main>
  )
}
