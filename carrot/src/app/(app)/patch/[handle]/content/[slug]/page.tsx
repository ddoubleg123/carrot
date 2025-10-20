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
    select: { id: true, name: true, handle: true, description: true, tags: true }
  });

  if (!patch) {
    notFound();
  }

  // Find content directly by slug using JSON query
  const content = await prisma.discoveredContent.findFirst({
    where: {
      patchId: patch.id,
      status: 'ready',
      metadata: {
        path: ['urlSlug'],
        equals: slug
      }
    },
    include: {
      patch: {
        select: {
          id: true,
          name: true,
          handle: true,
          description: true,
          tags: true
        }
      }
    }
  });

  if (!content) {
    notFound();
  }

  // Server-side guard: verify source before rendering. If broken, 404 the page.
  try {
    const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/internal/links/verify?url=${encodeURIComponent(content.sourceUrl || '')}`
    const res = await fetch(verifyUrl, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      if (!data?.ok) {
        notFound()
      }
    }
  } catch {}

  // Transform to DiscoveredItem format
  const discoveredItem = {
    id: content.id,
    type: content.type as 'article' | 'video' | 'pdf' | 'image' | 'text',
    title: content.title,
    displayTitle: content.title,
    url: content.sourceUrl || '',
    canonicalUrl: content.canonicalUrl || content.sourceUrl || '',
    matchPct: content.relevanceScore ? content.relevanceScore / 100 : 0.8,
    status: content.status as 'queued' | 'fetching' | 'enriching' | 'pending_audit' | 'ready' | 'failed',
    media: {
      hero: (content.mediaAssets as any)?.hero,
      gallery: (content.mediaAssets as any)?.gallery || [],
      videoThumb: (content.mediaAssets as any)?.videoThumb,
      pdfPreview: (content.mediaAssets as any)?.pdfPreview,
      blurDataURL: (content.mediaAssets as any)?.blurDataURL,
      dominant: (content.mediaAssets as any)?.dominant,
      source: (content.mediaAssets as any)?.source || 'generated',
      license: (content.mediaAssets as any)?.license || 'generated'
    },
    content: {
      summary150: content.content?.substring(0, 150) || '',
      keyPoints: (content.enrichedContent as any)?.keyPoints || [],
      notableQuote: (content.enrichedContent as any)?.notableQuote,
      readingTimeMin: (content.enrichedContent as any)?.readingTimeMin
    },
    meta: {
      sourceDomain: content.sourceUrl ? new URL(content.sourceUrl).hostname : 'unknown',
      favicon: (content.metadata as any)?.favicon,
      author: (content.metadata as any)?.author,
      publishDate: (content.metadata as any)?.publishDate
    },
    metadata: {
      contentUrl: (content.metadata as any)?.contentUrl,
      urlSlug: (content.metadata as any)?.urlSlug
    }
  };

  return <ContentPageClient item={discoveredItem} />;
}

export async function generateMetadata({ params }: ContentPageProps) {
  const { handle, slug } = await params;
  
  // Find the patch first
  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: { id: true, name: true }
  });

  if (!patch) {
    return {
      title: 'Content Not Found',
    };
  }

  // Find content directly by slug using JSON query
  const content = await prisma.discoveredContent.findFirst({
    where: {
      patchId: patch.id,
      status: 'ready',
      metadata: {
        path: ['urlSlug'],
        equals: slug
      }
    },
    select: {
      title: true,
      content: true,
      metadata: true,
      patch: {
        select: {
          name: true
        }
      }
    }
  });

  if (!content) {
    return {
      title: 'Content Not Found',
    };
  }

  return {
    title: `${content.title} | ${content.patch.name}`,
    description: content.content?.substring(0, 160) || '',
    openGraph: {
      title: content.title,
      description: content.content?.substring(0, 160) || '',
      type: 'article',
    },
  };
}
