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
import { knownCover, portraitCover } from '@/lib/groups/cover'
import { topicTitleFromSlug } from '@/lib/learn/topic'
// No need to import PatchPageSkeleton - using inline loading component

// Helper function to convert preset string to index
function getPresetIndex(preset: string | null | undefined): number | undefined {
  if (!preset) return undefined
  const asNumber = Number(preset)
  if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber < COLOR_SCHEMES.length) return asNumber
  const byName = COLOR_SCHEMES.findIndex((scheme) => scheme.name.toLowerCase() === preset.toLowerCase())
  return byName >= 0 ? byName : undefined
}

export default async function PatchBody({
  handle,
  topicKey = '',
  search
}: {
  handle: string
  topicKey?: string
  search: { [key: string]: string | string[] | undefined }
}) {
  try {
    
    // Fetch patch data
    const sessionPromise = auth()
    const patchPromise = prisma.patch.findUnique({
      where: { handle },
      include: {
        _count: {
          select: {
            members: true,
            posts: true,
            events: true,
            sources: true,
            discoveredContent: true
          }
        }
      }
    })
    const session = await sessionPromise
    const userId = session?.user?.id
    const [patch, actualUserTheme, membership] = await Promise.all([
      patchPromise,
      userId
        ? prisma.userPatchTheme.findFirst({
          where: { userId, patch: { handle } },
          select: { mode: true, preset: true, imageUrl: true }
        })
        : Promise.resolve(null),
      userId
        ? prisma.patchMember.findFirst({
          where: { userId, patch: { handle } },
          select: { id: true }
        })
        : Promise.resolve(null)
    ])

    if (!patch) {
      notFound();
    }

    const patchWithName = { ...patch, name: patch.title }
    const hasContent = patch._count.posts + patch._count.discoveredContent > 0
    const activeTab = (search.tab as string) || 'ask'
    const formattedEvents = activeTab === 'timeline'
      ? (await prisma.patchMember.findMany({
        where: { patchId: patch.id },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { joinedAt: 'desc' },
        take: 40
      })).map((member) => ({
        id: `member-${member.user.id}`,
        title: `${member.user.name} joined the patch`,
        dateStart: member.joinedAt.toISOString(),
        dateEnd: undefined,
        summary: `${member.user.name} joined the patch on ${member.joinedAt.toLocaleDateString()}`,
        tags: ['member_joined'],
        sources: []
      }))
      : []

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
            cover={portraitCover(patch.handle) || knownCover(patch.entity)}
            isOwner={Boolean(userId && patch.createdBy === userId)}
            isMember={Boolean(userId && (patch.createdBy === userId || membership))}
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
                {hasContent ? (
                  <PatchTabs activeTab={activeTab === 'discovery' ? 'facts' : activeTab} patch={patchWithName}>
                    {activeTab === 'ask' && <AskView patch={patchWithName} initialTopicId={topicKey || (typeof search.topic === 'string' ? search.topic : '')} />}
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
                ) : null}
              </div>

              {/* Right Rail */}
              <div className="w-[320px] shrink-0 min-w-0 lg:sticky lg:top-4 lg:z-10 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto">
                <RightRail
                  patch={patchWithName}
                  followerCount={patch._count.members}
                  botSubscriptions={[]}
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

export async function patchMetadata(handle: string, topicKey = ''): Promise<Metadata> {
  if (topicKey) {
    const question = topicTitleFromSlug(topicKey)
    const path = `/patch/${handle}/${topicKey}`
    const description = `Sources and discussion for “${question}”.`
    return {
      title: `${question} · Carrot`,
      description,
      alternates: { canonical: path },
      openGraph: { title: question, description, url: path, type: 'article' }
    }
  }

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

  return {
    title: `${patch.title} - Carrot Patch`,
    description: patch.description,
    alternates: { canonical: `/patch/${handle}` },
    keywords: patch.tags.join(', '),
  };
}