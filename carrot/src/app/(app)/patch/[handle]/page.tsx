import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PatchHeader from '@/components/patch/PatchHeader'
import PatchTabs from '@/components/patch/PatchTabs'
import FactSheet from '@/components/patch/FactSheet'
import TimelineView from '@/components/patch/TimelineView'
import ReferencesList from '@/components/patch/ReferencesList'
import PostFeed from '@/components/patch/PostFeed'

interface PatchTheme {
  bg?: string
  accent?: string
}

interface PatchPageProps {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PatchPage({ params, searchParams }: PatchPageProps) {
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
    postCount: topContributors.find(c => c.authorId === user.id)?._count.authorId || 0
  }))

  const theme = patch.theme as PatchTheme | null

  // Create a properly typed patch object for components
  // This ensures TypeScript compatibility with theme objects
  const typedPatch = {
    ...patch,
    theme: theme
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with theme background */}
      <div className={`${theme?.bg || 'bg-white'} border-b border-gray-200`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <PatchHeader patch={typedPatch} />
        </div>
      </div>

      {/* Main content area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main content - 3 columns */}
          <div className="lg:col-span-3">
            <PatchTabs activeTab={activeTab} patch={typedPatch}>
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">About {patch.name}</h2>
                    <p className="text-gray-700 leading-relaxed">{patch.description}</p>
                  </div>
                  
                  {patch.rules && (
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-3">Community Rules</h3>
                      <div className="bg-white rounded-2xl border border-gray-200 p-6">
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                          {patch.rules}
                        </pre>
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">Recent Activity</h3>
                    <div className="space-y-4">
                      {patch.posts.slice(0, 5).map((post) => (
                        <div key={post.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <img 
                              src={post.author.profilePhoto || post.author.image || '/default-avatar.png'} 
                              alt={post.author.name || 'User'} 
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <div>
                              <p className="font-medium text-gray-900">{post.author.name || post.author.username}</p>
                              <p className="text-sm text-gray-500">{post.createdAt.toLocaleDateString()}</p>
                            </div>
                          </div>
                          <h4 className="font-semibold text-gray-900 mb-1">{post.title}</h4>
                          {post.body && (
                            <p className="text-gray-700 text-sm line-clamp-2">{post.body}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'timeline' && (
                <TimelineView 
                  patch={typedPatch} 
                  events={patch.events}
                  sources={patch.sources}
                />
              )}

              {activeTab === 'posts' && (
                <PostFeed 
                  patch={typedPatch}
                  posts={patch.posts}
                />
              )}

              {activeTab === 'references' && (
                <ReferencesList 
                  sources={patch.sources}
                />
              )}
            </PatchTabs>
          </div>

          {/* Sidebar - 1 column */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              <FactSheet 
                patch={typedPatch}
                facts={patch.facts}
                stats={{
                  members: patch._count.members,
                  posts: patch._count.posts,
                  events: patch._count.events,
                  sources: patch._count.sources,
                }}
              />

              {contributorsWithCounts.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Contributors</h3>
                  <div className="space-y-3">
                    {contributorsWithCounts.map((contributor) => (
                      <div key={contributor.id} className="flex items-center gap-3">
                        <img 
                          src={contributor.profilePhoto || contributor.image || '/default-avatar.png'} 
                          alt={contributor.name || 'User'} 
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{contributor.name || contributor.username}</p>
                          <p className="text-sm text-gray-500">{contributor.postCount} posts</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  
  const patch = await prisma.patch.findUnique({
    where: { handle },
    select: {
      name: true,
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
    description: patch.description,
    keywords: patch.tags.join(', '),
  }
}
