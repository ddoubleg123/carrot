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
    description: content.content || '',
    relevanceScore: content.relevanceScore || 0,
    status: content.status,
    createdAt: content.createdAt,
    enrichedContent: content.enrichedContent as any,
    mediaAssets: content.mediaAssets as any,
    metadata: content.metadata as any,
    qualityScore: content.qualityScore,
    freshnessScore: content.freshnessScore,
    diversityBucket: content.diversityBucket,
    contentUrl: (content.metadata as any)?.contentUrl,
    urlSlug: (content.metadata as any)?.urlSlug
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
