import { existsSync } from 'fs'
import path from 'path'
import QuoteLooks from '@/components/QuoteLooks'
import { prisma } from '@/lib/prisma'
import { readQuote } from '@/lib/curator/quoteCard'
import { isFinishedQuote, oneQuoteCard } from '@/lib/curator/quoteCardPick'

export const dynamic = 'force-dynamic'

function imagesOf(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
  } catch {
    /* stored as one address */
  }
  return raw.startsWith('http') || raw.startsWith('/') ? [raw] : []
}

/** A local picture that is not on this machine is left off, so the card does not request a missing file. */
function present(url: string): string {
  const clean = url.split('?')[0]
  if (clean.startsWith('/curator-thumbs/') || clean.startsWith('/quote-cards/')) {
    return existsSync(path.join(process.cwd(), 'public', clean.slice(1))) ? url : ''
  }
  return url
}

export default async function CardLabPage() {
  const posts = await prisma.post.findMany({
    where: { content: { startsWith: 'kind: quote' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, content: true, imageUrls: true, thumbnailUrl: true }
  }).catch(() => [])

  const saved = posts.flatMap((post) => {
    const quote = readQuote(post.content)
    if (!quote) return []
    const urls = imagesOf(post.imageUrls)
    if (post.thumbnailUrl) urls.push(post.thumbnailUrl)
    const ready = urls.map(present).filter(Boolean)
    const finished = ready.filter(isFinishedQuote)
    return [{
      id: post.id,
      quote,
      card: finished.length ? oneQuoteCard(finished) : '',
      photo: ready.find((url) => !isFinishedQuote(url)) || ''
    }]
  })

  return (
    <main className="min-h-screen bg-[#F6F3EE] px-6 py-8 text-[#1C1917]">
      <h1 className="font-serif text-4xl">Quote cards</h1>
      <p className="mt-3 max-w-3xl text-[#44403C]">
        {saved.length === 0 ? 'No quote has been saved yet.' : `${saved.length} saved. The sentence is set on the card.`}
      </p>
      <div className="mt-8 grid max-w-5xl gap-8">
        {saved.map((post) => (
          <section key={post.id} className="max-w-[420px]">
            {post.card ? (
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <img src={post.card} alt="" className="w-full" />
              </div>
            ) : (
              <QuoteLooks
                sentence={post.quote.sentence}
                source={post.quote.source}
                date={post.quote.date}
                image={post.photo || null}
                seed={post.id}
              />
            )}
          </section>
        ))}
      </div>
    </main>
  )
}
