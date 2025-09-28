import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import PatchHeader from '@/components/patch/PatchHeader'
import PatchTabs from '@/components/patch/PatchTabs'
import RightRail from '@/components/patch/RightRail'
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
    const session = await getServerSession(authOptions)

    console.log('[PatchPage] Loading patch with handle:', handle)

    // Use Rome template for Rome handle
    if (handle === 'rome') {
      const RomePage = (await import('./page-rome')).default;
      return <RomePage params={params} searchParams={searchParams} />;
    }

    // Use History template for History handle
    if (handle === 'history') {
      const HistoryPage = (await import('./page-history')).default;
      return <HistoryPage params={params} searchParams={searchParams} />;
    }

    // Use Astros template for Houston Astros handle
    if (handle === 'houston-astros') {
      const AstrosPage = (await import('./page-astros')).default;
      return <AstrosPage params={params} searchParams={searchParams} />;
    }

    // Enhanced patch query with all needed data
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
        updatedAt: true,
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

    // Get user theme if logged in
    let userTheme = null;
    if (session?.user?.id) {
      userTheme = await prisma.userPatchTheme.findUnique({
        where: {
          userId_patchId: {
            userId: session.user.id,
            patchId: patch.id
          }
        }
      });
    }

    // Get followers data
    const followers = await prisma.follower.findMany({
      where: { patchId: patch.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            username: true
          }
        }
      },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    const followerCount = await prisma.follower.count({
      where: { patchId: patch.id }
    });

    // Get bot subscriptions
    const botSubscriptions = await prisma.botSubscription.findMany({
      where: { patchId: patch.id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true
          }
        }
      }
    });

    // Get events for timeline
    const events = await prisma.event.findMany({
      where: { patchId: patch.id },
      include: {
        sources: {
          select: {
            id: true,
            title: true,
            url: true,
            author: true
          }
        }
      },
      orderBy: { dateStart: 'desc' },
      take: 50
    });

    // Check if user is a member
    const isMember = session?.user?.id ? await prisma.patchMember.findUnique({
      where: {
        patchId_userId: {
          patchId: patch.id,
          userId: session.user.id
        }
      }
    }) : null;

    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <PatchHeader 
          patch={patch}
          isMember={!!isMember}
          userTheme={userTheme}
        />

        {/* Main Content */}
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content Area */}
            <div className="lg:col-span-2">
              <PatchTabs activeTab={activeTab} patch={patch}>
                {activeTab === 'overview' && <Overview patch={patch} />}
                {activeTab === 'documents' && <ResourcesList patch={patch} />}
                {activeTab === 'timeline' && <TimelineView events={events} patchId={patch.id} />}
                {activeTab === 'sources' && <ResourcesList patch={patch} />}
                {activeTab === 'discussions' && <PostFeed patch={patch} />}
              </PatchTabs>
            </div>

            {/* Right Rail */}
            <div className="lg:col-span-1">
              <RightRail 
                patch={patch}
                followers={followers}
                botSubscriptions={botSubscriptions}
                followerCount={followerCount}
              />
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