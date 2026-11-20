'use client'

import { FormEvent, useEffect, useState } from 'react'

interface Clip {
  title: string
  start: number
  end: number
  quote: string
  src: string
  note?: string
}

interface Job {
  id: string
  status: 'running' | 'completed' | 'failed'
  stage: string
  detail: string
  clips: Clip[]
  error?: string
}

function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(whole / 60)
  const rest = whole % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

export default function TestClipsPage() {
  const [url, setUrl] = useState('')
  const [rights, setRights] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let stop = false
    const pull = async () => {
      try {
        const response = await fetch('/api/test-clips', { cache: 'no-store' })
        const data = await response.json().catch(() => null)
        if (stop) return
        if (data?.job) {
          setJob(data.job)
          setError('')
        }
      } catch {
        if (!stop) setError('The page lost the local server for a moment.')
      }
    }
    void pull()
    const timer = window.setInterval(() => {
      void pull()
    }, 2000)
    return () => {
      stop = true
      window.clearInterval(timer)
    }
  }, [])

  const start = async (event: FormEvent | null, useSaved: boolean) => {
    event?.preventDefault()
    setError('')
    try {
      const response = await fetch('/api/test-clips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(useSaved ? { useSaved: true } : { url, rights: true })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.error || 'The bot did not start.')
        return
      }
      if (data?.job) setJob(data.job)
    } catch {
      setError('The page could not reach the local server.')
    }
  }

  const running = job?.status === 'running'

  return (
    <main className="min-h-screen bg-white text-[#0B0B0F]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF6A00]">Bot test</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">One video, cut by the bot</h1>
        <p className="mt-3 text-sm leading-6 text-[#60646C]">
          The bot reads the timed captions, picks three moments, and cuts the files. Nothing is posted to a group. This page is only on this machine.
        </p>

        <button
          type="button"
          disabled={running}
          onClick={() => start(null, true)}
          className="mt-8 h-11 rounded-full bg-[#FF6A00] px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {running ? 'The bot is working' : 'Run the bot on the saved copy'}
        </button>

        <form onSubmit={(event) => start(event, false)} className="mt-8 flex flex-col gap-3 border-t border-[#E6E8EC] pt-8">
          <p className="text-sm text-[#60646C]">Or give it a short YouTube link.</p>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v="
            className="h-11 rounded-full border border-[#E6E8EC] px-4 text-sm outline-none focus:border-[#FF6A00]"
          />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} className="mt-1" />
            <span>I have the rights to clip this video.</span>
          </label>
          <button
            type="submit"
            disabled={running || !rights || !url.trim()}
            className="h-11 w-fit rounded-full bg-[#0B0B0F] px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Run the bot on this link
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {job && (
          <section className="mt-10">
            <p className="text-sm font-semibold">{job.stage}</p>
            <p className="mt-1 text-sm text-[#60646C]">{job.detail}</p>
            {job.error && <p className="mt-2 text-sm text-red-600">{job.error}</p>}
            <div className="mt-6 space-y-8">
              {job.clips.map((clip) => (
                <article key={clip.src}>
                  <h2 className="text-lg font-semibold">{clip.title}</h2>
                  <p className="mt-1 text-xs text-[#8A8F98]">{clock(clip.start)} – {clock(clip.end)}</p>
                  <video key={clip.src} src={clip.src} controls className="mt-3 w-full rounded-lg bg-black" />
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#60646C]">{clip.quote}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
