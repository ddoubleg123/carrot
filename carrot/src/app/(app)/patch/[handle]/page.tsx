import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPatchThemeClass } from '@/lib/patch-theme'
import PatchHeader from '@/components/patch/PatchHeader'
import PillNav from '@/components/patch/PillNav'
import FactSheet from '@/components/patch/FactSheet'
import Overview from '@/components/patch/Overview'
import TimelineView from '@/components/patch/TimelineView'
import ResourcesList from '@/components/patch/ResourcesList'
import PostFeed from '@/components/patch/PostFeed'
import AIAgentDock from '@/components/patch/AIAgentDock'

interface PatchPageProps {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PatchPage({ params, searchParams }: PatchPageProps) {
  try {
    const { handle } = await params
    const search = await searchParams
    const activeTab = (search.tab as string) || 'overview'

    // Fetch patch data with all related information
    const patch = await prisma.patch.findUnique({
    where: { handle },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          username: true,
          profilePhoto: true,
          image: true,
        }
      },
      facts: {
        include: {
          source: true
        }
      },
      events: {
        include: {
          sources: true
        },
        orderBy: {
          dateStart: 'desc'
        },
        take: 20
      },
      sources: {
        orderBy: {
          createdAt: 'desc'
        },
        take: 15
      },
      posts: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              username: true,
              profilePhoto: true,
              image: true,
              country: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 25
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              profilePhoto: true,
              image: true,
            }
          }
        },
        orderBy: {
          joinedAt: 'desc'
        },
        take: 10
      },
      _count: {
        select: {
          members: true,
          posts: true,
          events: true,
          sources: true,
        }
      }
    }
  })

  if (!patch) {
    notFound()
  }

  // Get top contributors (users with most posts in this patch)
  const topContributors = await prisma.patchPost.groupBy({
    by: ['authorId'],
    where: {
      patchId: patch.id
    },
    _count: {
      authorId: true
    },
    orderBy: {
      _count: {
        authorId: 'desc'
      }
    },
    take: 5
  })

  const contributorIds = topContributors.map(c => c.authorId)
  const contributors = await prisma.user.findMany({
    where: {
      id: {
        in: contributorIds
      }
    },
    select: {
      id: true,
      name: true,
      username: true,
      profilePhoto: true,
      image: true,
    }
  })

  const contributorsWithCounts = contributors.map(user => ({
    ...user,
    contributions: topContributors.find(c => c.authorId === user.id)?._count.authorId || 0
  }))

  // Get theme class
  const themeClass = getPatchThemeClass(patch.theme)

  // Transform data for components
  const typedEvents = patch.events.map(event => ({
    ...event,
    media: event.media && typeof event.media === 'object' && event.media !== null && 'type' in event.media && 'url' in event.media
      ? event.media as { type: 'image' | 'video'; url: string; alt?: string }
      : null
  }))

  const typedPosts = patch.posts.map(post => ({
    ...post,
    metrics: post.metrics && typeof post.metrics === 'object' && post.metrics !== null && 
      'likes' in post.metrics && 'comments' in post.metrics && 'reposts' in post.metrics && 'views' in post.metrics
      ? post.metrics as { likes: number; comments: number; reposts: number; views: number }
      : { likes: 0, comments: 0, reposts: 0, views: 0 }
  }))

  const typedSources = patch.sources.map(source => ({
    ...source,
    citeMeta: source.citeMeta && typeof source.citeMeta === 'object' && source.citeMeta !== null && 
      'title' in source.citeMeta && 'url' in source.citeMeta
      ? source.citeMeta as { title: string; url: string; author?: string; publisher?: string; publishedAt?: string }
      : null
  }))

  return (
    <div className={`min-h-screen ${themeClass}`}>
      {/* Header with theme background */}
      <div className="bg-white border-b border-[#E6E8EC]">
        <div className="max-w-7xl mx-auto">
          <PatchHeader patch={patch} />
          {/* Metric Bar */}
          <div className="bg-white border-b border-[#E6E8EC] py-2">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-4 text-sm text-[#60646C]">
              <span className="flex items-center gap-1">👥 {patch._count.members} Members</span>
              <span className="flex items-center gap-1">💬 {patch._count.posts} Posts</span>
              <span className="flex items-center gap-1">🗓️ {patch._count.events} Events</span>
              <span className="flex items-center gap-1">📚 {patch._count.sources} Sources</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Navigation */}
      <PillNav activeTab={activeTab} patchHandle={patch.handle} />

      {/* Main content area - Two column layout */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main column - 3 columns */}
          <div className="lg:col-span-3">
            {activeTab === 'overview' && (
              <Overview 
                facts={patch.facts}
                recentEvents={typedEvents.slice(0, 5)}
                recentSources={typedSources.slice(0, 5)}
                recentPosts={typedPosts.slice(0, 5)}
              />
            )}

            {activeTab === 'timeline' && (
              <TimelineView events={typedEvents} />
            )}

            {activeTab === 'resources' && (
              <ResourcesList sources={typedSources} />
            )}

            {activeTab === 'posts' && (
              <PostFeed 
                patch={patch}
                posts={typedPosts}
              />
            )}
          </div>

          {/* Sidebar - 1 column */}
          <div className="lg:col-span-1">
            <FactSheet 
              patch={patch}
              facts={patch.facts}
              topContributors={contributorsWithCounts}
            />
          </div>
        </div>
      </div>

      {/* AI Agent Dock */}
      <AIAgentDock 
        patchId={patch.id}
        onAddFact={(fact) => {
          // Mock server action - in real app, this would call a server action
          console.log('Adding fact:', fact)
        }}
        onAddEvent={(event) => {
          // Mock server action
          console.log('Adding event:', event)
        }}
        onAddSource={(source) => {
          // Mock server action
          console.log('Adding source:', source)
        }}
        onSummarize={(content) => {
          // Mock server action
          console.log('Summarizing:', content)
        }}
      />
    </div>
  )
  } catch (error) {
    console.error('Patch page error:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      handle: await params.then(p => p.handle).catch(() => 'unknown')
    })
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Patch</h1>
          <p className="text-gray-600 mb-4">There was an error loading this patch page.</p>
          <p className="text-sm text-gray-500">Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
          <p className="text-sm text-gray-500">Please try refreshing the page or contact support if the issue persists.</p>
        </div>
      </div>
    )
  }
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  
  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: {
      name: true,
      tagline: true,
      description: true,
      tags: true,
    }
  })

  if (!patch) {
    return {
      title: 'Patch Not Found',
    }
  }

  return {
    title: `${patch.name} - Carrot Patch`,
    description: patch.tagline || patch.description,
    keywords: patch.tags.join(', '),
  }
}