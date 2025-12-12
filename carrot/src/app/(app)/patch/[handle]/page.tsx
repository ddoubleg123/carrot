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
import DiscoveryView from '@/components/patch/DiscoveryView'
import DiscussionsView from '@/components/patch/DiscussionsView'
import COLOR_SCHEMES from '@/config/colorSchemes'
import PerfTracker from '@/components/PerfTracker'
// No need to import PatchPageSkeleton - using inline loading component

// Helper function to convert preset string to index
function getPresetIndex(preset: string | null | undefined): number | undefined {
  if (!preset) return undefined;
  
  // Map preset strings to indices
  const presetMap: { [key: string]: number } = {
    'following': 0,
    'for-you': 1,
    'subjects': 2
  };
  
  return presetMap[preset] ?? undefined;
}

export default async function PatchPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  try {
    const { handle } = await params;
    const search = await searchParams;
    
    // Fetch patch data
    const patch = await prisma.patch.findUnique({
      where: { handle },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                profilePhoto: true,
                username: true,
                country: true
              }
            }
          }
        },
        botSubscriptions: true,
        _count: {
          select: {
            members: true,
            posts: true,
            events: true,
            sources: true
          }
        }
      }
    });

    if (!patch) {
      notFound();
    }

    // Get user session
    const session = await auth();
    const userId = session?.user?.id;

    // Get user theme if logged in
    let actualUserTheme = null;
    if (userId) {
      const userPatchTheme = await prisma.userPatchTheme.findUnique({
        where: {
          user_patch_theme_unique: {
            userId: userId,
            patchId: patch.id
          }
        }
      });
      actualUserTheme = userPatchTheme;
    }

    // Get followers data
    const patchWithName = { ...patch, name: patch.title }

    const actualFollowers = patchWithName.members.map(member => ({
      id: member.id,
      user: {
        id: member.user.id,
        name: member.user.name,
        image: member.user.image,
        profilePhoto: member.user.profilePhoto,
        username: member.user.username
      }
    }));

    const actualFollowerCount = actualFollowers.length;
    const botSubscriptionsWithBotData = patchWithName.botSubscriptions.map(sub => ({
      id: sub.id,
      botId: sub.botId,
      ownerUserId: sub.ownerUserId,
      createdAt: sub.createdAt
    }));

    // Format events for timeline
    const formattedEvents = (patchWithName.members || []).map(member => ({
      id: `member-${member.user.id}`,
      title: `${member.user.name} joined the patch`,
      dateStart: member.joinedAt.toISOString(),
      dateEnd: undefined,
      summary: `${member.user.name} joined the patch on ${member.joinedAt.toLocaleDateString()}`,
      tags: ['member_joined'],
      sources: [] // Empty array to prevent undefined errors
    }));

    // Determine active tab from URL search params (default to 'overview')
    const activeTab = (search.tab as string) || 'overview';

    return (
      <Suspense fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      }>
        <div className="min-h-screen bg-white">
          {/* Web Vitals telemetry */}
          <PerfTracker />
          {/* Header */}
          <PatchHeader
            patch={{
              ...patchWithName,
              updatedAt: patchWithName.updatedAt.toISOString()
            }}
            userTheme={actualUserTheme ? {
              mode: actualUserTheme.mode as 'preset' | 'image',
              preset: getPresetIndex(actualUserTheme.preset),
              imageUrl: actualUserTheme.imageUrl || undefined
            } : null}
          />

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-6 md:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 py-8">
              {/* Main Content Area */}
              <div className="max-w-[880px] min-w-0">
                <PatchTabs activeTab={activeTab} patch={patchWithName}>
                  {activeTab === 'overview' && <Overview patch={patchWithName} />}
                  {activeTab === 'documents' && <DocumentsView patch={patchWithName} />}
                  {activeTab === 'timeline' && <TimelineView events={formattedEvents as any} patchId={patchWithName.id} />}
                  {activeTab === 'discovery' && <DiscoveryView patch={patchWithName} />}
                  {activeTab === 'discussions' && <DiscussionsView patch={patchWithName} />}
                </PatchTabs>
              </div>

              {/* Right Rail */}
              <div className="w-[320px] shrink-0 min-w-0">
                <RightRail
                  patch={patchWithName}
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
      handle: 'unknown'
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

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;

  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: {
      title: true,
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
    title: `${patch.title} - Carrot Patch`,
    description: patch.description,
    keywords: patch.tags.join(', '),
  };
}