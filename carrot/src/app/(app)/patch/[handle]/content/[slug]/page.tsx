import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ContentPageClient from './ContentPageClient';

interface ContentPageProps {
  params: Promise<{
    handle: string;
    slug: string;
  }>;
}

// Enable ISR caching for better performance
export const revalidate = 300; // 5 minutes

export default async function ContentPage({ params }: ContentPageProps) {
  const { handle, slug } = await params;

  // Find the patch first
  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: { id: true, title: true, handle: true, description: true, tags: true }
  });

  if (!patch) {
    notFound();
  }

  const contentSelect = {
      id: true,
      patchId: true,
      title: true,
      sourceUrl: true,
      canonicalUrl: true,
      relevanceScore: true,
      qualityScore: true,
      whyItMatters: true,
      summary: true,
      facts: true,
      quotes: true,
      provenance: true,
      hero: true,
      isControversy: true,
      isHistory: true,
      category: true,
      metadata: true,
      patch: {
        select: {
          id: true,
          title: true,
          handle: true,
          description: true,
          tags: true
        }
      }
    } as const

  // The card links by the row id. Fall back to the older slug for links already opened.
  let content = await prisma.discoveredContent.findUnique({
    where: { id: slug },
    select: contentSelect
  })
  if (content && content.patchId !== patch.id) {
    content = null
  }

  if (!content) {
  content = await prisma.discoveredContent.findFirst({
    where: {
      patchId: patch.id,
      metadata: {
        path: ['urlSlug'],
        equals: slug
      }
    },
    select: contentSelect
  });
  }

  // Fallback: If JSON query fails, fetch all content and filter in memory
  // This handles cases where Prisma JSON queries don't work or metadata structure differs
  if (!content) {
    console.warn(`[ContentPage] JSON query failed for slug "${slug}", trying fallback approach`)
    const allContent = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id
      },
      select: contentSelect
    })

    // Filter in memory to find matching slug
    content = allContent.find(item => {
      const metadata = item.metadata as any
      const itemSlug = metadata?.urlSlug
      return itemSlug === slug
    }) || null

    if (!content) {
      console.error(`[ContentPage] Content not found for slug "${slug}" in patch "${handle}"`)
      console.error(`[ContentPage] Available slugs:`, allContent.map(item => {
        const metadata = item.metadata as any
        return metadata?.urlSlug || 'NO_SLUG'
      }).slice(0, 10))
      notFound()
    }
  }

  if (!content) {
    notFound();
  }

  const hero = (content.hero as any) || null
  const facts = Array.isArray(content.facts as any) ? (content.facts as any) : []
  const quotes = Array.isArray(content.quotes as any) ? (content.quotes as any) : []
  const provenance = Array.isArray(content.provenance as any) ? (content.provenance as any) : []
  const metadata = (content.metadata as any) || {}
  const summary = content.summary || content.whyItMatters || ''
  const categoryValue = typeof content.category === 'string' ? content.category : 'article'
  const allowedTypes = new Set(['article', 'video', 'pdf', 'image', 'text'])
  const normalizedType = allowedTypes.has(categoryValue) ? categoryValue : 'article'

  const discoveredItem = {
    id: content.id,
    type: normalizedType as 'article' | 'video' | 'pdf' | 'image' | 'text',
    title: content.title,
    displayTitle: content.title,
    url: content.sourceUrl || '',
    canonicalUrl: content.canonicalUrl || content.sourceUrl || '',
    matchPct: content.relevanceScore ?? 0,
    status: 'ready' as const,
    media: {
      hero: hero?.url,
      gallery: [],
      videoThumb: hero?.videoThumb,
      pdfPreview: hero?.pdfPreview,
      blurDataURL: hero?.blurHash,
      dominant: hero?.dominantColor,
      source: hero?.source ?? 'generated',
      license: hero?.license ?? 'generated'
    },
    content: {
      summary150: summary.substring(0, 150),
      keyPoints: facts.map((fact: any) => typeof fact?.value === 'string' ? fact.value : JSON.stringify(fact)).slice(0, 5),
      notableQuote: quotes.length ? quotes[0]?.text : undefined,
      readingTimeMin: undefined
    },
    meta: {
      sourceDomain: content.sourceUrl ? new URL(content.sourceUrl).hostname : 'unknown',
      favicon: metadata?.favicon,
      author: metadata?.author,
      publishDate: metadata?.publishDate
    },
    metadata: {
      contentUrl: metadata?.contentUrl,
      urlSlug: metadata?.urlSlug
    }
  };

  return <ContentPageClient item={discoveredItem} />;
}

export async function generateMetadata({ params }: ContentPageProps) {
  const { handle, slug } = await params;
  
  // Find the patch first
  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: { id: true, title: true }
  });

  if (!patch) {
    return {
      title: 'Content Not Found',
    };
  }

  let content = await prisma.discoveredContent.findUnique({
    where: { id: slug },
    select: {
      patchId: true,
      title: true,
      summary: true,
      whyItMatters: true
    }
  })
  if (content && content.patchId !== patch.id) {
    content = null
  }

  if (!content) {
    content = await prisma.discoveredContent.findFirst({
      where: {
        patchId: patch.id,
        metadata: {
          path: ['urlSlug'],
          equals: slug
        }
      },
      select: {
        patchId: true,
        title: true,
        summary: true,
        whyItMatters: true
      }
    })
  }

  if (!content) {
    return {
      title: 'Content Not Found',
    };
  }

  return {
    title: `${patch.title} · ${content.title}`,
    description: (content.summary || content.whyItMatters || '').substring(0, 160),
    openGraph: {
      title: content.title,
      description: (content.summary || content.whyItMatters || '').substring(0, 160),
      type: 'article',
    },
  };
}
