import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import ContentModal from '../../components/ContentModal';

interface ContentPageProps {
  params: Promise<{
    handle: string;
    slug: string;
  }>;
}

export default async function ContentPage({ params }: ContentPageProps) {
  const { handle, slug } = await params;

  // Find the content by URL slug in metadata
  const content = await prisma.discoveredContent.findFirst({
    where: {
      metadata: {
        path: ['urlSlug'],
        equals: slug
      },
      patch: {
        handle: handle
      },
      status: 'ready'
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

  // Transform to DiscoveredItem format
  const discoveredItem = {
    id: content.id,
    title: content.title,
    url: content.sourceUrl || '',
    canonicalUrl: content.canonicalUrl || content.sourceUrl || '',
    type: content.type as 'article' | 'video' | 'pdf' | 'image' | 'text',
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

  return (
    <div className="min-h-screen bg-gray-50">
      <ContentModal 
        item={discoveredItem}
        isOpen={true}
        onClose={() => window.history.back()}
        patchHandle={handle}
      />
    </div>
  );
}

export async function generateMetadata({ params }: ContentPageProps) {
  const { handle, slug } = await params;
  
  const content = await prisma.discoveredContent.findFirst({
    where: {
      metadata: {
        path: ['urlSlug'],
        equals: slug
      },
      patch: {
        handle: handle
      },
      status: 'ready'
    },
    select: {
      title: true,
      content: true,
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
