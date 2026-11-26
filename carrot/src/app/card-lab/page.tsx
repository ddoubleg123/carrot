import { prisma } from '@/lib/prisma'
import { readQuote } from '@/lib/curator/quoteCard'
import { isFinishedQuote, oneQuoteCard } from '@/lib/curator/quoteCardPick'

export const dynamic = 'force-dynamic'

/** The v2 kit commit. Cards drawn before this stay off this page. */
const INSTALLED = new Date('2026-11-26T17:12:00.000Z')

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

export default async function CardLabPage() {
  const posts = await prisma.post.findMany({
    where: {
      content: { startsWith: 'kind: quote' },
      createdAt: { gte: INSTALLED },
      OR: [
        { imageUrls: { contains: 'quote-cards' } },
        { thumbnailUrl: { contains: 'quote-cards' } }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { id: true, content: true, imageUrls: true, thumbnailUrl: true, createdAt: true }
  }).catch(() => [])

  const visible = posts
    .map((post) => ({ ...post, imageUrls: imagesOf(post.imageUrls) }))
    .filter((post) => post.imageUrls.some(isFinishedQuote) || isFinishedQuote(post.thumbnailUrl))

  return (
    <main className="min-h-screen bg-[#F6F3EE] px-6 py-8 text-[#1C1917]">
      <h1 className="font-serif text-4xl">Quote cards</h1>
      <p className="mt-3 max-w-3xl text-[#44403C]">
        {visible.length === 0
          ? 'No new quote card has been posted yet. Each quote gets one card.'
          : `${visible.length} live. One card per quote.`}
      </p>
      <div className="mt-8 grid max-w-5xl gap-8">
        {visible.map((post) => {
          const quote = readQuote(post.content)
          if (!quote) return null
          const urls = post.imageUrls.length ? post.imageUrls : post.thumbnailUrl ? [post.thumbnailUrl] : []
          const src = oneQuoteCard(urls)
          return (
            <section key={post.id} className="max-w-[420px]">
              <img src={src} alt="" className="w-full rounded-2xl bg-white shadow-sm" />
              <p className="mt-3 text-base">{quote.sentence}</p>
              <p className="mt-1 text-sm text-[#44403C]">{quote.source}{quote.date ? ` · ${quote.date}` : ''}</p>
            </section>
          )
        })}
      </div>
    </main>
  )
}
