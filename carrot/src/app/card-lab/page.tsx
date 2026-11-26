import { readdir } from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

const NAME = /^([a-z0-9-]+)__([a-z]+)__p(\d+)\.png$/

const SENTENCES: { id: string; title: string }[] = [
  { id: 'house-floor', title: 'House floor' },
  { id: 'lake', title: 'The lake' },
  { id: 'measles', title: 'Measles' },
  { id: 'two-wars', title: 'Two wars' },
  { id: 'one-point-five', title: 'One point five' },
  { id: 'hearing', title: 'The hearing' },
]

const ORDER = ['documentary', 'cinematic', 'duotone', 'editorial', 'stat', 'broadsheet', 'typeonly', 'transcript', 'backdrop', 'pullquote']

async function cardsIn(dir: string) {
  const found: string[] = []
  let names: string[] = []
  try {
    names = await readdir(dir)
  } catch {
    return found
  }
  for (const name of names) {
    if (NAME.test(name)) {
      found.push(name)
      continue
    }
    try {
      const nested = await readdir(path.join(dir, name))
      for (const file of nested) {
        if (NAME.test(file)) found.push(file)
      }
    } catch {
      /* a file, not a folder */
    }
  }
  return found
}

function group(names: string[]) {
  const bySentence = new Map<string, { direction: string; palette: string; file: string }[]>()
  for (const file of names) {
    const match = file.match(NAME)
    if (!match) continue
    const row = bySentence.get(match[1]) || []
    row.push({ direction: match[2], palette: match[3], file })
    bySentence.set(match[1], row)
  }
  for (const row of bySentence.values()) {
    row.sort((a, b) => ORDER.indexOf(a.direction) - ORDER.indexOf(b.direction) || Number(a.palette) - Number(b.palette))
  }
  return bySentence
}

function Section({ title, note, cards }: { title: string; note: string; cards: Map<string, { direction: string; palette: string; file: string }[]> }) {
  const known = SENTENCES.filter((sentence) => cards.has(sentence.id))
  const extra = [...cards.keys()].filter((id) => !SENTENCES.some((sentence) => sentence.id === id))
  const rows = [...known, ...extra.map((id) => ({ id, title: id }))]
  if (rows.length === 0) {
    return (
      <section className="mt-10">
        <h2 className="font-serif text-2xl">{title}</h2>
        <p className="mt-2 text-[#57534E]">{note}</p>
      </section>
    )
  }
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl">{title}</h2>
      <p className="mt-2 max-w-3xl text-[#57534E]">{note}</p>
      {rows.map((sentence) => (
        <div key={sentence.id} className="mt-8">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#9A3412]">{sentence.title}</h3>
          <div className="mt-3 flex gap-4 overflow-x-auto pb-3">
            {(cards.get(sentence.id) || []).map((card) => (
              <a key={card.file} href={`/api/card-lab/${card.file}`} target="_blank" rel="noreferrer" className="w-[240px] shrink-0">
                <img src={`/api/card-lab/${card.file}`} alt="" className="w-full rounded-2xl bg-white shadow-sm" />
                <p className="mt-2 text-sm text-[#44403C]">{card.direction} · {card.palette}</p>
              </a>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

export default async function CardLabPage() {
  const review = group(await cardsIn(path.join(process.cwd(), 'quote-review', 'kit', 'kit', 'build', 'cards')))
  const made = group(await cardsIn(path.join(process.cwd(), 'public', 'quote-cards')))
  return (
    <main className="min-h-screen bg-[#F6F3EE] px-6 py-8 text-[#1C1917]">
      <h1 className="font-serif text-4xl">Quote cards</h1>
      <p className="mt-3 max-w-3xl text-[#44403C]">
        Each row is one sentence. The pictures across the row are the layouts that passed.
        A full-bleed card is not here when the photo was too small to fill the frame.
      </p>
      <Section
        title="From the server"
        note="Nothing has been written here yet. New cards from the server show up in this row."
        cards={made}
      />
      <Section
        title="The review set"
        note="Forty-eight cards from the six sentences. Documentary and cinematic are absent because those photos were under 1080 pixels on the short side."
        cards={review}
      />
    </main>
  )
}
