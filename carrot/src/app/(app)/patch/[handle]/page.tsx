import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getPatchThemeClass } from '@/lib/patch-theme'
import BreadcrumbBar from '@/components/patch/BreadcrumbBar'
import PatchHeader from '@/components/patch/PatchHeader'
import PatchTabs from '@/components/patch/PatchTabs'
import Sidebar from '@/components/patch/Sidebar'
import TimelineView from '@/components/patch/TimelineView'
import Overview from '@/components/patch/Overview'
import ResourcesList from '@/components/patch/ResourcesList'
import PostFeed from '@/components/patch/PostFeed'

interface PatchPageProps {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PatchPage({ params, searchParams }: PatchPageProps) {
  try {
    const { handle } = await params
    const search = await searchParams
    const activeTab = (search.tab as string) || 'overview'

    console.log('[PatchPage] Loading patch with handle:', handle)

    // Use Rome template for Rome handle
    if (handle === 'rome') {
      const RomePage = (await import('./page-rome')).default;
      return <RomePage params={params} searchParams={searchParams} />;
    }

    // Use Repository template for History handle
    if (handle === 'history') {
      const RepositoryPage = (await import('./page-repository-v2')).default;
      return <RepositoryPage params={params} searchParams={searchParams} />;
    }

    // Use Astros template for Houston Astros handle
    if (handle === 'houston-astros') {
      const AstrosPage = (await import('./page-astros')).default;
      return <AstrosPage params={params} searchParams={searchParams} />;
    }

    // Simple patch query with counts
    let patch = await prisma.patch.findUnique({
      where: { handle },
      select: {
        id: true,
        handle: true,
        name: true,
        description: true,
        theme: true,
        tags: true,
        createdBy: true,
        createdAt: true,
        _count: {
          select: {
            members: true,
            posts: true,
            events: true,
            sources: true,
          }
        }
      }
    });

    if (!patch) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Patch Not Found</h1>
            <p className="text-gray-600">The patch "{handle}" does not exist.</p>
          </div>
        </div>
      );
    }

    // Get theme class
    const themeClass = getPatchThemeClass(patch.theme as string | null);

    return (
      <div className={`min-h-screen ${themeClass}`}>
        {/* Breadcrumb Bar */}
        <BreadcrumbBar />
        
        {/* Header */}
        <PatchHeader 
          patch={patch}
          isMember={false}
          onJoin={() => console.log('Join clicked')}
          onLeave={() => console.log('Leave clicked')}
          onShare={() => console.log('Share clicked')}
          onThemeChange={(theme) => console.log('Theme changed to:', theme)}
        />

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content Area */}
            <div className="lg:col-span-2">
              <PatchTabs activeTab={activeTab} patch={patch}>
                {activeTab === 'overview' && <Overview patch={patch} />}
                {activeTab === 'timeline' && <TimelineView events={[]} />}
                {activeTab === 'resources' && <ResourcesList patch={patch} />}
                {activeTab === 'posts' && <PostFeed patch={patch} />}
              </PatchTabs>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <Sidebar patch={patch} />
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Patch page error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      handle: await params.then(p => p.handle).catch(() => 'unknown')
    });
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Patch</h1>
          <p className="text-gray-600 mb-4">There was an error loading this patch page.</p>
          <p className="text-sm text-gray-500">Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
          <p className="text-sm text-gray-500">Please try refreshing the page or contact support if the issue persists.</p>
        </div>
      </div>
    );
  }
}

export async function generateMetadata({ params }: PatchPageProps): Promise<Metadata> {
  const { handle } = await params;

  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: {
      name: true,
      description: true,
      tags: true,
    }
  });

  if (!patch) {
    return {
      title: 'Patch Not Found',
    };
  }

  return {
    title: `${patch.name} - Carrot Patch`,
    description: patch.description,
    keywords: patch.tags.join(', '),
  };
}