import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import PatchHeader from '@/components/patch/PatchHeader'
import PatchTabs from '@/components/patch/PatchTabs'
import RightRail from '@/components/patch/RightRail'
import TimelineView from '@/components/patch/TimelineView'
import Overview from '@/components/patch/Overview'
import DocumentsView from '@/components/patch/DocumentsView'
import SourcesView from '@/components/patch/SourcesView'
import DiscussionsView from '@/components/patch/DiscussionsView'

// Loading skeleton component
function PatchPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <div className="bg-gradient-to-r from-orange-400 to-orange-600 h-64">
        <div className="max-w-7xl mx-auto px-6 md:px-10 pt-8">
          <div className="h-8 bg-white/20 rounded w-1/3 mb-4 animate-pulse"></div>
          <div className="h-4 bg-white/20 rounded w-2/3 mb-6 animate-pulse"></div>
          <div className="flex gap-4">
            <div className="h-10 bg-white/20 rounded w-20 animate-pulse"></div>
            <div className="h-10 bg-white/20 rounded w-20 animate-pulse"></div>
            <div className="h-10 bg-white/20 rounded w-20 animate-pulse"></div>
          </div>
        </div>
      </div>
      
      {/* Content skeleton */}
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-6">
            {/* Tabs skeleton */}
            <div className="flex gap-4 border-b">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
              ))}
            </div>
            
            {/* Content skeleton */}
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
            </div>
          </div>
          
          {/* Right rail skeleton */}
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-48 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PatchPageProps {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Add caching for patch pages
export const revalidate = 300; // Revalidate every 5 minutes

export default async function PatchPage({ params, searchParams }: PatchPageProps) {
  try {
    const { handle } = await params
    const search = await searchParams
    const activeTab = (search.tab as string) || 'overview'
    const session = await auth()

    console.log('[PatchPage] Loading patch with handle:', handle)

    // All patches now use the canonical template

    // Optimized: Single query to get patch with all related data
    const [patch, userTheme, followers, followerCount, botSubscriptions] = await Promise.all([
      // Main patch query
      prisma.patch.findUnique({
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
      }),
      
      // User theme query (only if logged in)
      session?.user?.id ? prisma.userPatchTheme.findUnique({
        where: {
          user_patch_theme_unique: {
            userId: session.user.id,
            patchId: handle // We'll update this after we get the patch
          }
        }
      }) : Promise.resolve(null),
      
      // Followers query
      prisma.follower.findMany({
        where: { patchId: { in: [] } }, // Will be updated after patch query
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
      }),
      
      // Follower count query
      prisma.follower.count({
        where: { patchId: { in: [] } } // Will be updated after patch query
      }),
      
      // Bot subscriptions query
      prisma.botSubscription.findMany({
        where: { patchId: { in: [] } }, // Will be updated after patch query
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
      })
    ]);

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

    // Now get the actual related data with the correct patch ID
    const [actualFollowers, actualFollowerCount, actualBotSubscriptions] = await Promise.all([
      prisma.follower.findMany({
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
      }),
      prisma.follower.count({
        where: { patchId: patch.id }
      }),
      prisma.botSubscription.findMany({
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
      })
    ]);

    // Get user theme with correct patch ID
    const actualUserTheme = session?.user?.id ? await prisma.userPatchTheme.findUnique({
      where: {
        user_patch_theme_unique: {
          userId: session.user.id,
          patchId: patch.id
        }
      }
    }) : null;

    // Add mock bot data to match the expected interface
    const botSubscriptionsWithBotData = actualBotSubscriptions.map(sub => ({
      ...sub,
      bot: {
        id: sub.botId,
        name: `AI Bot ${sub.botId.slice(-4)}`,
        avatar: undefined,
        lastIndexed: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    }));

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
        patch_user_member_unique: {
          patchId: patch.id,
          userId: session.user.id
        }
      }
    }) : null;

    // Convert events to the format expected by TimelineView
    const formattedEvents = events.map(event => ({
      id: event.id,
      title: event.title,
      dateStart: event.dateStart.toISOString(),
      dateEnd: event.dateEnd?.toISOString(),
      summary: event.summary,
      media: event.media ? (event.media as any) : undefined,
      tags: event.tags,
      sources: event.sources.map(source => ({
        id: source.id,
        title: source.title,
        url: source.url,
        author: source.author || undefined
      }))
    }));

    return (
      <Suspense fallback={<PatchPageSkeleton />}>
        <div className="min-h-screen bg-white">
          {/* Header */}
          <PatchHeader
            patch={{
              ...patch,
              updatedAt: patch.updatedAt.toISOString()
            }}
            isMember={!!isMember}
            userTheme={actualUserTheme ? {
              mode: actualUserTheme.mode as 'preset' | 'image',
              preset: actualUserTheme.preset as 'light' | 'warm' | 'stone' | 'civic' | 'ink' | undefined,
              imageUrl: actualUserTheme.imageUrl || undefined
            } : null}
          />

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 py-8">
              {/* Main Content Area */}
              <div className="max-w-[880px]">
                <PatchTabs activeTab={activeTab} patch={patch}>
                  {activeTab === 'overview' && <Overview patch={patch} />}
                  {activeTab === 'documents' && <DocumentsView patch={patch} />}
                  {activeTab === 'timeline' && <TimelineView events={formattedEvents as any} patchId={patch.id} />}
                  {activeTab === 'sources' && <SourcesView patch={patch} />}
                  {activeTab === 'discussions' && <DiscussionsView patch={patch} />}
                </PatchTabs>
              </div>

              {/* Right Rail */}
              <div className="w-[320px]">
                <RightRail
                  patch={patch}
                  followers={actualFollowers}
                  botSubscriptions={botSubscriptionsWithBotData as any}
                  followerCount={actualFollowerCount}
                />
              </div>
            </div>
          </div>
        </div>
      </Suspense>
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