'use client'

import { useEffect, useState } from 'react'

const people = [
  { name: 'Brian Kemp', office: 'Governor', place: 'Georgia', party: 'R' },
  { name: 'Raphael G. Warnock', office: 'U.S. Senate', place: 'Georgia', party: 'D' },
  { name: 'Jon Ossoff', office: 'U.S. Senate', place: 'Georgia', party: 'D' },
  { name: 'Barry Loudermilk', office: 'U.S. House, district 11', place: 'Georgia', party: 'R' }
]

function partyTone(party: string) {
  if (party === 'D') return 'bg-[#1D4E89]'
  if (party === 'R') return 'bg-[#8C2F39]'
  return 'bg-[#78716C]'
}

export default function PolRailSamples() {
  return (
    <main className="min-h-screen bg-[#F6F3EE] px-6 py-10 text-[#1C1917]">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#78716C]">Sample only</p>
        <h1 className="mt-2 font-serif text-3xl">Pol Watch on the home rail</h1>
        <p className="mt-2 max-w-xl text-sm text-[#57534E]">Five ways the same four people can sit under the live video. Nothing here is wired to the feed.</p>
        <div className="mt-8">
          <Sample title="5 · Story" note="One story holds for 10 seconds, then the next person flashes in.">
            <StoryRail />
          </Sample>
        </div>
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <Sample title="1 · Roster" note="Name, office, and a party mark. One row each.">
            <section className="rounded-2xl border border-[#E6E8EC] bg-white p-4">
              <Header />
              <ul className="mt-3 divide-y divide-[#E6E8EC]">
                {people.map((person) => (
                  <li key={person.name} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <span className={`h-8 w-1 shrink-0 rounded-full ${partyTone(person.party)}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{person.name}</span>
                      <span className="block truncate text-xs text-[#78716C]">{person.office}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </Sample>

          <Sample title="2 · By chamber" note="Governor, Senate, and House stay in their own groups.">
            <section className="rounded-2xl border border-[#E6E8EC] bg-white p-4">
              <Header />
              <Group label="Governor" rows={people.filter((person) => person.office === 'Governor')} />
              <Group label="Senate" rows={people.filter((person) => person.office === 'U.S. Senate')} />
              <Group label="House" rows={people.filter((person) => person.office.startsWith('U.S. House'))} />
            </section>
          </Sample>

          <Sample title="3 · Initials" note="A mark for each person, then the office on the same line.">
            <section className="rounded-2xl border border-[#E6E8EC] bg-white p-4">
              <Header />
              <ul className="mt-3 space-y-2.5">
                {people.map((person) => (
                  <li key={person.name} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0e1a2b] text-[11px] font-semibold text-[#f2ede4]">
                      {initials(person.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{person.name}</span>
                      <span className="block truncate text-xs text-[#78716C]">{person.office} · {person.place}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </Sample>

          <Sample title="4 · Desk" note="The office is the label. The name is the line you scan.">
            <section className="overflow-hidden rounded-2xl bg-[#0e1a2b] text-[#f2ede4]">
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="font-serif text-lg">Pol Watch</h2>
                <span className="text-[11px] uppercase tracking-[0.14em] text-[#edae49]">Georgia</span>
              </div>
              <ul>
                {people.map((person) => (
                  <li key={person.name} className="border-t border-[#f2ede4]/15 px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#edae49]">{person.office}</p>
                    <p className="mt-0.5 text-sm">{person.name}</p>
                  </li>
                ))}
              </ul>
            </section>
          </Sample>
        </div>
      </div>
    </main>
  )
}

const stories = [
  { ...people[0], line: 'A budget note is the latest item on the governor’s desk.' },
  { ...people[1], line: 'A Senate schedule lists a vote for later this week.' },
  { ...people[2], line: 'A committee hearing is the newest item on the calendar.' },
  { ...people[3], line: 'A district update is the latest House item.' }
]

function StoryRail() {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % stories.length), 10000)
    return () => window.clearInterval(timer)
  }, [])
  const person = stories[index]
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
        <h2 className="font-semibold">Pol Watch</h2>
        <span className="text-xs font-medium text-[#57534E]">Open</span>
      </div>
      <div className="mx-4 mt-3 h-0.5 overflow-hidden rounded-full bg-[#E6E8EC]">
        <div key={`hold-${index}`} className="pol-hold h-full origin-left bg-[#0e1a2b]" style={{ animation: 'pol-hold 10s linear' }} />
      </div>
      <div key={person.name} className="pol-story px-4 py-3" style={{ animation: 'pol-story-in 0.45s ease' }}>
        <div className="flex items-center gap-3">
          <span className={`h-8 w-1 shrink-0 rounded-full ${partyTone(person.party)}`} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{person.name}</span>
            <span className="block truncate text-xs text-[#78716C]">{person.office} · {person.place}</span>
          </span>
        </div>
        <p className="mt-3 font-serif text-[15px] leading-snug text-[#1C1917]">{person.line}</p>
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A8A29E]">Sample</p>
      </div>
      <ol className="flex gap-3 border-t border-[#E6E8EC] px-4 py-2.5 text-[11px]">
        {stories.map((item, itemIndex) => (
          <li key={item.name} className={itemIndex === index ? 'font-semibold text-[#1C1917]' : 'text-[#A8A29E]'}>
            {item.name.split(' ').slice(-1)}
          </li>
        ))}
      </ol>
    </section>
  )
}

function Header() {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-semibold">Pol Watch</h2>
      <span className="text-xs font-medium text-[#57534E]">Open</span>
    </div>
  )
}

function Group({ label, rows }: { label: string; rows: typeof people }) {
  return (
    <div className="mt-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#A8A29E]">{label}</p>
      <ul className="mt-1">
        {rows.map((person) => (
          <li key={person.name} className="flex items-baseline justify-between gap-3 py-1">
            <span className="truncate text-sm font-medium">{person.name}</span>
            <span className="shrink-0 text-[11px] text-[#78716C]">{person.party}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Sample({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-3 mt-1 text-xs text-[#78716C]">{note}</p>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  )
}

function initials(name: string) {
  return name.split(' ').filter((part) => part.length > 1 && part[0] === part[0].toUpperCase()).slice(0, 2).map((part) => part[0]).join('')
}
