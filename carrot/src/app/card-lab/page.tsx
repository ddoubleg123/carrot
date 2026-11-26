import { readdir } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { readQuote } from '@/lib/curator/quoteCard'
import { isFinishedQuote } from '@/lib/curator/quoteCardPick'

export const dynamic = 'force-dynamic'

const NAME = /^([a-z0-9-]+)__([a-z]+)__p(\d+)\.png$/
const ORDER = ['documentary', 'cinematic', 'duotone', 'editorial', 'stat', 'broadsheet', 'typeonly', 'transcript', 'backdrop', 'pullquote']

const SENTENCES: { id: string; title: string }[] = [
  { id: 'house-floor', title: 'House floor' },
  { id: 'lake', title: 'The lake' },
  { id: 'measles', title: 'Measles' },
  { id: 'two-wars', title: 'Two wars' },
  { id: 'one-point-five', title: 'One point five' },
  { id: 'hearing', title: 'The hearing' },
]

function label(url: string): string {
  const file = decodeURIComponent(url.split('?')[0].split('/').pop() || '')
  const match = file.match(NAME)
  if (!match) return 'card'
  return `${match[2]} · ${match[3]}`
}

function sortCards(urls: string[]): string[] {
  return [...urls].sort((a, b) => {
    const left = label(a).split(' · ')
    const right = label(b).split(' · ')
    return ORDER.indexOf(left[0]) - ORDER.indexOf(right[0]) || Number(left[1] || 0) - Number(right[1] || 0)
  })
}

function pictureList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string' && isFinishedQuote(item))
  } catch {
    /* a single url */
  }
  return isFinishedQuote(raw) ? [raw] : []
}

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

async function madeCards() {
  const posts = await prisma.post.findMany({
    where: { content: { startsWith: 'kind: quote' } },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { id: true, content: true, imageUrls: true, createdAt: true }
  })
  return posts.flatMap((post) => {
    const quote = readQuote(post.content)
    const pictures = sortCards(pictureList(post.imageUrls))
    if (!quote || pictures.length === 0) return []
    return [{ id: post.id, sentence: quote.sentence, source: quote.source, createdAt: post.createdAt, pictures }]
  })
}

export default async function CardLabPage() {
  const made = await madeCards().catch(() => [])
  const review = group(await cardsIn(path.join(process.cwd(), 'quote-review', 'kit', 'kit', 'build', 'cards')))
  const known = SENTENCES.filter((sentence) => review.has(sentence.id))
  const extra = [...review.keys()].filter((id) => !SENTENCES.some((sentence) => sentence.id === id))
  const reviewRows = [...known, ...extra.map((id) => ({ id, title: id }))]

  return (
    <main className="min-h-screen bg-[#F6F3EE] px-6 py-8 text-[#1C1917]">
      <h1 className="font-serif text-4xl">Quote cards</h1>
      <p className="mt-3 max-w-3xl text-[#44403C]">
        {made.length === 0
          ? 'No card has been saved yet. A new one shows up here after the server draws it.'
          : `${made.length} saved. Each row is one sentence. The pictures across the row are the layouts that passed.`}
      </p>
      {made.map((card) => (
        <section key={card.id} className="mt-10">
          <p className="text-sm text-[#9A3412]">{card.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC{card.source ? ` · ${card.source}` : ''}</p>
          <h2 className="mt-1 max-w-3xl font-serif text-2xl">{card.sentence}</h2>
          <div className="mt-3 flex gap-4 overflow-x-auto pb-3">
            {card.pictures.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="w-[240px] shrink-0">
                <img src={url} alt="" className="w-full rounded-2xl bg-white shadow-sm" />
                <p className="mt-2 text-sm text-[#44403C]">{label(url)}</p>
              </a>
            ))}
          </div>
        </section>
      ))}
      {reviewRows.length > 0 && (
        <section className="mt-16">
          <h2 className="font-serif text-2xl">The review set</h2>
          <p className="mt-2 max-w-3xl text-[#57534E]">The earlier sample cards. New cards from the server are above this.</p>
          {reviewRows.map((sentence) => (
            <div key={sentence.id} className="mt-8">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#9A3412]">{sentence.title}</h3>
              <div className="mt-3 flex gap-4 overflow-x-auto pb-3">
                {(review.get(sentence.id) || []).map((card) => (
                  <a key={card.file} href={`/api/card-lab/${card.file}`} target="_blank" rel="noreferrer" className="w-[240px] shrink-0">
                    <img src={`/api/card-lab/${card.file}`} alt="" className="w-full rounded-2xl bg-white shadow-sm" />
                    <p className="mt-2 text-sm text-[#44403C]">{card.direction} · {card.palette}</p>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  )
}
