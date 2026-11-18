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
import DiscoveryView from '@/components/patch/DiscoveryView'
import DiscussionsView from '@/components/patch/DiscussionsView'
import PatchChat from '@/components/patch/PatchChat'
import AskView from '@/components/patch/AskView'
import COLOR_SCHEMES from '@/config/colorSchemes'
import PerfTracker from '@/components/PerfTracker'
import { ensureGroupCover } from '@/lib/groups/cover'
import { topicLabel } from '@/lib/learn/topic'
// No need to import PatchPageSkeleton - using inline loading component

// Helper function to convert preset string to index
function getPresetIndex(preset: string | null | undefined): number | undefined {
  if (!preset) return undefined
  const asNumber = Number(preset)
  if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber < COLOR_SCHEMES.length) return asNumber
  const byName = COLOR_SCHEMES.findIndex((scheme) => scheme.name.toLowerCase() === preset.toLowerCase())
  return byName >= 0 ? byName : undefined
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
    
    // Fetch agents associated with this patch
    const agents = await prisma.agent.findMany({
      where: {
        isActive: true,
        associatedPatches: {
          has: handle
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Map agents to botSubscriptions format for RightRail compatibility
    const botSubscriptionsWithBotData = agents.map(agent => ({
      id: `agent-${agent.id}`,
      botId: agent.id,
      ownerUserId: null,
      createdAt: agent.createdAt,
      bot: {
        id: agent.id,
        name: agent.name,
        avatar: (agent.metadata as any)?.avatar || undefined
      }
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

    const activeTab = (search.tab as string) || 'ask';

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
            cover={await ensureGroupCover(patch).catch(() => '')}
            isOwner={Boolean(userId && patch.createdBy === userId)}
            isMember={Boolean(userId && (patch.createdBy === userId || patch.members.some((member) => member.user.id === userId)))}
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
                <PatchTabs activeTab={activeTab === 'discovery' ? 'facts' : activeTab} patch={patchWithName}>
                  {activeTab === 'ask' && <AskView patch={patchWithName} initialTopicId={typeof search.topic === 'string' ? search.topic : ''} />}
                  {activeTab === 'chat' && (
                    <div className="px-6 md:px-10 py-6">
                      <PatchChat patchId={patchWithName.id} patchHandle={patchWithName.handle} />
                    </div>
                  )}
                  {activeTab === 'documents' && <Overview patch={patchWithName} />}
                  {activeTab === 'timeline' && <TimelineView events={formattedEvents as any} patchId={patchWithName.id} />}
                  {(activeTab === 'facts' || activeTab === 'discovery') && <DiscoveryView patch={patchWithName} />}
                  {activeTab === 'discussions' && <DiscussionsView patch={patchWithName} />}
                </PatchTabs>
              </div>

              {/* Right Rail */}
              <div className="w-[320px] shrink-0 min-w-0 lg:sticky lg:top-4 lg:z-10 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
                <RightRail
                  patch={patchWithName}
                  followers={actualFollowers}
                  botSubscriptions={botSubscriptionsWithBotData as any}
                  followerCount={actualFollowerCount}
                  showAgents={false}
                />
                <div id="topic-add-dock" />
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

export async function generateMetadata({
  params,
  searchParams
}: {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}): Promise<Metadata> {
  const { handle } = await params
  const search = await searchParams

  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: {
      id: true,
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

  const key = typeof search.topic === 'string' ? search.topic : ''
  if (key) {
    const topic = await topicLabel(patch.id, key).catch(() => null)
    if (topic) {
      const path = `/patch/${handle}?topic=${topic.slug}`
      return {
        title: `${topic.question} · ${patch.title}`,
        description: topic.question,
        alternates: { canonical: path },
        openGraph: { title: topic.question, description: `A question on ${patch.title}`, url: path }
      }
    }
  }

  return {
    title: `${patch.title} - Carrot Patch`,
    description: patch.description,
    keywords: patch.tags.join(', '),
  };
}