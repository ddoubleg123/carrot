'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
// Modular right-rail cards
import CarrotsCard from './Widgets/CarrotsCard';
import TrendingTopicsCard from './Widgets/TrendingTopicsCard';
import NewConnectionsCard from './Widgets/NewConnectionsCard';
import WeekInReviewCard from './Widgets/WeekInReviewCard';
import { RailLive } from '@/components/live/LiveFeedCard';

// Simple error message component
function ErrorMessage() {
  return (
    <div className="p-4 bg-red-50 text-red-700 rounded-lg">
      <p>Something went wrong loading this widget.</p>
    </div>
  );
}

// Helper component to safely render widgets with error boundaries
function SafeWidget({ children }: { children: React.ReactNode }) {
  try {
    return <>{children}</>;
  } catch (error) {
    console.error('Widget error:', error);
    return <ErrorMessage />;
  }
}

type RailStory = {
  id: string
  name: string
  office: string
  place: string
  party: string
  line: string
  source: string
  kind: 'bill' | 'hearing' | 'news' | 'post' | 'mention'
  url: string
}

const STORY_KIND: Record<RailStory['kind'], string> = {
  bill: 'Legislation',
  hearing: 'Hearing',
  news: 'News',
  post: 'Their post',
  mention: 'People are saying'
}

function partyTone(party: string) {
  if (party === 'D') return 'bg-[#1D4E89]'
  if (party === 'R') return 'bg-[#8C2F39]'
  return 'bg-[#78716C]'
}

function PolWatchRail() {
  const [items, setItems] = useState<RailStory[]>([])
  const [followed, setFollowed] = useState<number | null>(null)
  const [pending, setPending] = useState(true)
  const [index, setIndex] = useState(0)
  useEffect(() => {
    let stop = false
    let timer = 0
    let tries = 0
    const pull = () => {
      fetch('/api/pol-watch?part=rail', { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { count?: number; items?: RailStory[]; pending?: boolean } | null) => {
          if (stop || !data) return
          setFollowed(typeof data.count === 'number' ? data.count : 0)
          setPending(data.pending === true)
          const next = Array.isArray(data.items) ? data.items : []
          if (next.length) {
            setItems((current) => {
              const same = current.length === next.length && current.every((item, itemIndex) => item.id === next[itemIndex]?.id)
              return same ? current : next
            })
            setIndex((current) => (current >= next.length ? 0 : current))
          }
          if (data.pending && tries < 5) {
            tries += 1
            timer = window.setTimeout(pull, 8000)
          }
        })
        .catch(() => { if (!stop) { setFollowed(0); setPending(false) } })
    }
    timer = window.setTimeout(pull, 6000)
    return () => { stop = true; window.clearTimeout(timer) }
  }, [])
  useEffect(() => {
    if (items.length < 2) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), 10000)
    return () => window.clearInterval(timer)
  }, [items.length])
  const story = items[index] || null
  const names = [...new Map(items.map((item) => [item.name, item.name])).values()]
  return (
    <section className="overflow-hidden rounded-2xl border border-[#E6E8EC] bg-white">
      <style>{`
        @keyframes pol-story-in {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes pol-hold {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .pol-story, .pol-hold { animation: none !important; }
        }
      `}</style>
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <h2 className="font-semibold text-[#1C1917]">Pol Watch</h2>
        <Link href="/pol-watch" className="text-xs font-medium text-[#57534E] hover:text-[#1C1917]">Open</Link>
      </div>
      {story ? (
        <>
          <div className="mx-4 mt-3 h-0.5 overflow-hidden rounded-full bg-[#E6E8EC]">
            <div key={`hold-${story.id}`} className="pol-hold h-full origin-left bg-[#0e1a2b]" style={{ animation: 'pol-hold 10s linear' }} />
          </div>
          <div key={story.id} className="pol-story px-4 py-3" style={{ animation: 'pol-story-in 0.45s ease' }}>
            <div className="flex items-center gap-3">
              <span className={`h-8 w-1 shrink-0 rounded-full ${partyTone(story.party)}`} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#1C1917]">{story.name}</span>
                <span className="block truncate text-xs text-[#78716C]">{story.office}{story.place ? ` · ${story.place}` : ''}</span>
              </span>
            </div>
            <a href={story.url} target="_blank" rel="noreferrer" className="mt-3 block font-serif text-[15px] leading-snug text-[#1C1917] line-clamp-4 hover:underline">{story.line}</a>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A8A29E]">{STORY_KIND[story.kind]}{story.source ? ` · ${story.source}` : ''}</p>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-[#E6E8EC] px-4 py-2.5">
            <ol className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px]">
              {names.map((name) => (
                <li key={name} className={name === story.name ? 'font-semibold text-[#1C1917]' : 'text-[#A8A29E]'}>
                  {name.split(' ').slice(-1)}
                </li>
              ))}
            </ol>
            <span className="shrink-0 text-[11px] tabular-nums text-[#A8A29E]">{index + 1} / {items.length}</span>
          </div>
        </>
      ) : (
        <p className="px-4 py-3 text-sm text-[#78716C]">
          {followed === null || (pending && items.length === 0) ? 'Looking for what they have been up to.' : followed === 0 ? 'The representatives you follow show up here.' : 'Nothing new from the people you follow.'}
        </p>
      )}
    </section>
  )
}

export default function Widgets() {
  return (
    <>
      <div className="space-y-3.5">
        <SafeWidget>
          <CarrotsCard />
        </SafeWidget>

        <SafeWidget>
          <TrendingTopicsCard />
        </SafeWidget>

        <SafeWidget>
          <NewConnectionsCard />
        </SafeWidget>

        <SafeWidget>
          <WeekInReviewCard />
        </SafeWidget>
      </div>
      <div className="sticky top-6 mt-3.5 space-y-3.5">
        <RailLive />
        <PolWatchRail />
      </div>
    </>
  );
}
