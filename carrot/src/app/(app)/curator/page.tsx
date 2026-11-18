import { notFound } from 'next/navigation'
import { curatorAllowed } from '@/lib/curator/access'
import { readJournal, type Kept } from '@/lib/curator/hunt'
import { DAILY_CAP, DESKS } from '@/lib/curator/desks'
import { RunPass } from './RunPass'

export const dynamic = 'force-dynamic'

function keptSoFar(items: Kept[]): Kept[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.url)) return false
    seen.add(item.url)
    return true
  })
}

export default async function CuratorPage() {
  if (!(await curatorAllowed())) notFound()
  const journal = await readJournal()
  const latest = journal?.hunts[0]
  const kept = keptSoFar((journal?.hunts || []).flatMap((hunt) => hunt.desks.flatMap((desk) => desk.kept)))

  return (
    <main className="min-h-screen bg-[#F6F3EE] text-[#1C1917]">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs uppercase tracking-[0.16em] text-[#9A3412]">Audit</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">What the desks found</h1>
        <p className="mt-4 text-base leading-7 text-[#44403C]">
          This page is only for checking the desks. It is not the feed. A video is posted only after its captions are read. A page is posted only after the article is read. Anything too short, a pitch, or already used is rejected here. Posted items show up in the home feed under the desk’s name, mixed with other posts. Each desk can post up to {DAILY_CAP} times a day. Four desks hunt at a time, oldest turn first, for as long as the app is on.
        </p>
        <div className="mt-6">
          <RunPass />
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">The desks</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {DESKS.map((desk) => (
              <li key={desk.id} className="rounded-lg border border-[#E7E0D6] bg-white px-3 py-2">
                <a className="font-medium underline decoration-[#E7E0D6] underline-offset-2" href={`/patch/${desk.handle}`}>{desk.name}</a>
                <p className="text-sm text-[#57534E]">{desk.beat}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Posted</h2>
          {kept.length === 0 ? (
            <p className="mt-3 text-sm text-[#57534E]">Nothing has been kept yet. The first pass is still reading.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {kept.map((item) => (
                <li key={item.url} className="rounded-xl border border-[#E7E0D6] bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-[#9A3412]">{item.from} · {item.kind} · {item.words} words read</p>
                  <h3 className="mt-1 text-lg font-semibold leading-snug">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#44403C]">{item.why}</p>
                  <blockquote className="mt-3 border-l-2 border-[#C2410C] pl-3 text-sm leading-6">{item.excerpt}</blockquote>
                  <p className="mt-3 flex flex-wrap gap-3 text-sm">
                    <a className="underline" href={item.topicUrl}>Open the topic</a>
                    <a className="underline" href={item.url}>Source</a>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Latest pass, including what was rejected</h2>
          {!latest ? (
            <p className="mt-3 text-sm text-[#57534E]">No pass has finished.</p>
          ) : (
            <div className="mt-4 space-y-6">
              <p className="text-sm text-[#57534E]">{new Date(latest.at).toLocaleString()}</p>
              {latest.desks.map((desk) => (
                <article key={`${latest.at}-${desk.id}`} className="rounded-xl border border-[#E7E0D6] bg-white p-4">
                  <h3 className="font-semibold">{desk.name}</h3>
                  <p className="mt-2 text-sm text-[#44403C]">Looked at {desk.looked.join(' · ') || 'nothing'}.</p>
                  {desk.dropped.length > 0 && (
                    <ul className="mt-3 space-y-2 text-sm leading-6">
                      {desk.dropped.map((drop, index) => (
                        <li key={`${drop.title}-${index}`}>
                          <span className="font-medium">{drop.title}</span>
                          <span className="text-[#57534E]"> — {drop.reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {desk.kept.length === 0 && desk.dropped.length === 0 && (
                    <p className="mt-2 text-sm text-[#57534E]">Nothing new on this list.</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
