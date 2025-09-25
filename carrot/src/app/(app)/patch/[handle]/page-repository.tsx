import React from 'react';
import { prisma } from '@/lib/prisma';
import { Metadata } from 'next';
import { 
  Calendar, 
  Users, 
  MessageSquare, 
  FileText, 
  Link, 
  Image, 
  Video, 
  Upload, 
  Clock, 
  Share2, 
  Heart, 
  MoreHorizontal, 
  Plus, 
  Search, 
  Filter, 
  Grid,
  BookOpen,
  Archive,
  ExternalLink,
  Copy,
  Bookmark,
  Star,
  TrendingUp,
  Eye,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  Bot,
  Lightbulb,
  History,
  Globe
} from 'lucide-react';

interface PatchPageProps {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function RepositoryPatchPage({ params, searchParams }: PatchPageProps) {
  try {
    const { handle } = await params
    const search = await searchParams
    const activeTab = (search.tab as string) || 'overview'

    console.log('[RepositoryPatchPage] Loading patch with handle:', handle)

    // Fetch patch with all related data
    let patch = await prisma.patch.findUnique({
      where: { handle },
      select: {
        id: true,
        handle: true,
        name: true,
        tagline: true,
        description: true,
        theme: true,
        tags: true,
        createdBy: true,
        createdAt: true,
        facts: {
          take: 8
        },
        events: {
          orderBy: { dateStart: 'asc' },
          take: 20
        },
        sources: {
          orderBy: { createdAt: 'desc' },
          take: 50
        },
        posts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
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
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Patch Not Found</h1>
            <p className="text-gray-600">The patch "{handle}" does not exist.</p>
          </div>
        </div>
      );
    }

    // Get theme variant
    const themeVariant = patch.theme || 'light';
    const themeClasses = {
      light: 'bg-[linear-gradient(180deg,#FFFFFF,rgba(10,90,255,0.03))]',
      warm: 'bg-[linear-gradient(180deg,#FFFFFF,rgba(255,106,0,0.04))]',
      stone: 'bg-gradient-to-b from-[#FFFFFF] to-[#F7F8FA]'
    };

    return (
      <div className={`min-h-screen ${themeClasses[themeVariant as keyof typeof themeClasses]}`}>
        {/* Compact Header (max 88px) */}
        <div className="bg-white border-b border-[#E6E8EC] sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-6">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-[#0B0B0F]">{patch.name}</h1>
                    {patch.tagline && (
                      <span className="text-[#60646C] text-sm line-clamp-1">{patch.tagline}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    {patch.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 bg-[#E6E8EC] text-[#60646C] rounded-md text-xs font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] transition-colors text-sm font-medium">
                    Join
                  </button>
                  <button className="p-2 text-[#60646C] hover:text-[#0B0B0F] hover:bg-[#E6E8EC] rounded-lg transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Metric Bar */}
              <div className="flex items-center gap-6 text-sm text-[#60646C]">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{patch._count.members} members</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  <span>{patch._count.posts} posts</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{patch._count.events} events</span>
                </div>
                <div className="flex items-center gap-1">
                  <Archive className="w-4 h-4" />
                  <span>{patch._count.sources} sources</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Pill Nav */}
        <div className="bg-white border-b border-[#E6E8EC] sticky top-[88px] z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: Grid },
                { id: 'timeline', label: 'Timeline', icon: Calendar },
                { id: 'resources', label: 'Resources', icon: Archive },
                { id: 'posts', label: 'Posts', icon: MessageSquare }
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-[#FF6A00] text-[#FF6A00]'
                      : 'border-transparent text-[#60646C] hover:text-[#0B0B0F] hover:border-[#E6E8EC]'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Content Area (max-w-[880px]) */}
            <div className="lg:col-span-3 max-w-[880px]">
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  {/* Key Facts Grid */}
                  <div className="bg-white rounded-2xl border border-[#E6E8EC] p-6">
                    <h2 className="text-xl font-semibold text-[#0B0B0F] mb-6">Key Facts</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {patch.facts.length > 0 ? patch.facts.map((fact) => (
                        <div key={fact.id} className="p-4 bg-[#F7F8FA] rounded-xl border border-[#E6E8EC]">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="text-sm text-[#60646C] mb-1">{fact.label}</div>
                              <div className="font-semibold text-[#0B0B0F]">{fact.value}</div>
                            </div>
                            {fact.sourceId && (
                              <div className="ml-2">
                                <span className="px-2 py-1 bg-[#0A5AFF]/10 text-[#0A5AFF] rounded text-xs">
                                  source
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )) : (
                        <div className="col-span-2 text-center py-8 text-[#60646C]">
                          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No facts added yet. Add some key information about this topic.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-white rounded-2xl border border-[#E6E8EC] p-6">
                    <h2 className="text-xl font-semibold text-[#0B0B0F] mb-6">Recent Activity</h2>
                    <div className="space-y-4">
                      {patch.events.slice(0, 3).map((event) => (
                        <div key={event.id} className="flex items-start gap-3 p-3 hover:bg-[#F7F8FA] rounded-lg transition-colors">
                          <div className="w-8 h-8 bg-[#0A5AFF]/10 rounded-full flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-[#0A5AFF]" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-[#0B0B0F]">New event added</div>
                            <div className="text-sm text-[#60646C]">{event.title}</div>
                            <div className="text-xs text-[#60646C] mt-1">
                              {new Date(event.dateStart).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))}
                      {patch.sources.slice(0, 2).map((source) => (
                        <div key={source.id} className="flex items-start gap-3 p-3 hover:bg-[#F7F8FA] rounded-lg transition-colors">
                          <div className="w-8 h-8 bg-[#FF6A00]/10 rounded-full flex items-center justify-center">
                            <Archive className="w-4 h-4 text-[#FF6A00]" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-[#0B0B0F]">New source added</div>
                            <div className="text-sm text-[#60646C]">{source.title}</div>
                            <div className="text-xs text-[#60646C] mt-1">
                              {source.publisher || 'Unknown publisher'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-6">
                  {/* Timeline Filters */}
                  <div className="bg-white rounded-2xl border border-[#E6E8EC] p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-[#0B0B0F]">Timeline</h2>
                      <div className="flex items-center gap-3">
                        <button className="px-3 py-2 border border-[#E6E8EC] text-[#60646C] rounded-lg hover:bg-[#F7F8FA] transition-colors flex items-center gap-2">
                          <Filter className="w-4 h-4" />
                          Filter
                        </button>
                        <button className="px-3 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] transition-colors flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Add Event
                        </button>
                      </div>
                    </div>
                    
                    {/* Tag Filters */}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-sm text-[#60646C]">Filter by tags:</span>
                      {Array.from(new Set(patch.events.flatMap(e => e.tags))).slice(0, 8).map((tag) => (
                        <button key={tag} className="px-3 py-1 bg-[#E6E8EC] text-[#60646C] rounded-full text-sm hover:bg-[#FF6A00]/10 hover:text-[#FF6A00] transition-colors">
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timeline Events */}
                  <div className="space-y-6">
                    {patch.events.length > 0 ? patch.events.map((event) => (
                      <div key={event.id} className="bg-white rounded-2xl border border-[#E6E8EC] p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-sm text-[#60646C]">
                                {new Date(event.dateStart).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}
                              </span>
                              {event.dateEnd && (
                                <span className="text-sm text-[#60646C]">
                                  - {new Date(event.dateEnd).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  })}
                                </span>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold text-[#0B0B0F] mb-2">{event.title}</h3>
                            <p className="text-[#60646C] leading-relaxed mb-3">{event.summary}</p>
                            <div className="flex flex-wrap gap-2">
                              {event.tags.map((tag) => (
                                <span key={tag} className="px-2 py-1 bg-[#E6E8EC] text-[#60646C] rounded text-xs">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {event.media && (
                              <div className="w-8 h-8 bg-[#0A5AFF]/10 rounded flex items-center justify-center">
                                <Image className="w-4 h-4 text-[#0A5AFF]" />
                              </div>
                            )}
                            <button className="p-2 text-[#60646C] hover:text-[#FF6A00] transition-colors">
                              <Bookmark className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Source Badges */}
                        {event.sourceIds.length > 0 && (
                          <div className="flex items-center gap-2 pt-3 border-t border-[#E6E8EC]">
                            <span className="text-xs text-[#60646C]">Sources:</span>
                            {event.sourceIds.slice(0, 3).map((sourceId) => (
                              <span key={sourceId} className="px-2 py-1 bg-[#0A5AFF]/10 text-[#0A5AFF] rounded text-xs">
                                source
                              </span>
                            ))}
                            {event.sourceIds.length > 3 && (
                              <span className="text-xs text-[#60646C]">+{event.sourceIds.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </div>
                    )) : (
                      <div className="bg-white rounded-2xl border border-[#E6E8EC] p-12 text-center">
                        <Calendar className="w-12 h-12 mx-auto mb-4 text-[#60646C] opacity-50" />
                        <h3 className="text-lg font-semibold text-[#0B0B0F] mb-2">No timeline events yet</h3>
                        <p className="text-[#60646C] mb-4">Start building the timeline by adding key events and milestones.</p>
                        <button className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] transition-colors">
                          Add First Event
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'resources' && (
                <div className="space-y-6">
                  {/* Resources Header */}
                  <div className="bg-white rounded-2xl border border-[#E6E8EC] p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-[#0B0B0F]">Reference Library</h2>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#60646C]" size={16} />
                          <input
                            type="text"
                            placeholder="Search sources..."
                            className="pl-10 pr-4 py-2 border border-[#E6E8EC] rounded-lg focus:ring-2 focus:ring-[#FF6A00] focus:border-transparent outline-none text-sm"
                          />
                        </div>
                        <button className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] transition-colors flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Add Source
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sources List */}
                  <div className="space-y-3">
                    {patch.sources.length > 0 ? patch.sources.map((source) => (
                      <div key={source.id} className="bg-white rounded-xl border border-[#E6E8EC] p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-[#E6E8EC] rounded flex items-center justify-center flex-shrink-0">
                                <Globe className="w-4 h-4 text-[#60646C]" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-[#0B0B0F] mb-1 line-clamp-1">{source.title}</h3>
                                <div className="text-sm text-[#60646C] mb-2">
                                  {source.author && <span>{source.author}</span>}
                                  {source.publisher && <span> • {source.publisher}</span>}
                                  {source.publishedAt && (
                                    <span> • {new Date(source.publishedAt).toLocaleDateString()}</span>
                                  )}
                                </div>
                                <div className="text-xs text-[#60646C] truncate">{source.url}</div>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button className="p-2 text-[#60646C] hover:text-[#0A5AFF] transition-colors" title="Open">
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-[#60646C] hover:text-[#0A5AFF] transition-colors" title="Copy citation">
                              <Copy className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-[#60646C] hover:text-[#FF6A00] transition-colors" title="Attach to timeline">
                              <Calendar className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-[#60646C] hover:text-[#FF6A00] transition-colors" title="Add note">
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="bg-white rounded-2xl border border-[#E6E8EC] p-12 text-center">
                        <Archive className="w-12 h-12 mx-auto mb-4 text-[#60646C] opacity-50" />
                        <h3 className="text-lg font-semibold text-[#0B0B0F] mb-2">No sources yet</h3>
                        <p className="text-[#60646C] mb-4">Build your reference library by adding credible sources and citations.</p>
                        <button className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] transition-colors">
                          Add First Source
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'posts' && (
                <div className="space-y-6">
                  {/* Posts Header */}
                  <div className="bg-white rounded-2xl border border-[#E6E8EC] p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-[#0B0B0F]">Community Posts</h2>
                      <div className="flex items-center gap-2">
                        <button className="px-3 py-2 bg-[#FF6A00] text-white rounded-lg text-sm">Top</button>
                        <button className="px-3 py-2 text-[#60646C] hover:bg-[#F7F8FA] rounded-lg text-sm">New</button>
                        <button className="px-3 py-2 text-[#60646C] hover:bg-[#F7F8FA] rounded-lg text-sm">Ending Soon</button>
                      </div>
                    </div>
                  </div>

                  {/* Posts Feed */}
                  <div className="space-y-4">
                    {patch.posts.length > 0 ? patch.posts.map((post) => (
                      <div key={post.id} className="bg-white rounded-xl border border-[#E6E8EC] p-6 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 bg-[#FF6A00]/10 rounded-full flex items-center justify-center">
                            <span className="text-[#FF6A00] font-semibold text-sm">
                              {post.author.name?.charAt(0) || 'U'}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-[#0B0B0F]">{post.author.name || 'Anonymous'}</span>
                              <span className="text-sm text-[#60646C]">
                                {new Date(post.createdAt).toLocaleDateString()}
                              </span>
                              <span className="px-2 py-1 bg-[#E6E8EC] text-[#60646C] rounded text-xs">
                                {post.type}
                              </span>
                            </div>
                            {post.title && (
                              <h3 className="font-semibold text-[#0B0B0F] mb-2">{post.title}</h3>
                            )}
                            {post.body && (
                              <p className="text-[#60646C] mb-3">{post.body}</p>
                            )}
                            <div className="flex items-center gap-4 text-sm text-[#60646C]">
                              <button className="flex items-center gap-1 hover:text-[#FF6A00] transition-colors">
                                <ThumbsUp className="w-4 h-4" />
                                <span>{(post.metrics as any)?.likes || 0}</span>
                              </button>
                              <button className="flex items-center gap-1 hover:text-[#FF6A00] transition-colors">
                                <MessageSquare className="w-4 h-4" />
                                <span>{(post.metrics as any)?.comments || 0}</span>
                              </button>
                              <button className="flex items-center gap-1 hover:text-[#FF6A00] transition-colors">
                                <Share2 className="w-4 h-4" />
                                <span>{(post.metrics as any)?.reposts || 0}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="bg-white rounded-2xl border border-[#E6E8EC] p-12 text-center">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 text-[#60646C] opacity-50" />
                        <h3 className="text-lg font-semibold text-[#0B0B0F] mb-2">No posts yet</h3>
                        <p className="text-[#60646C] mb-4">Start the conversation by sharing your thoughts on this topic.</p>
                        <button className="px-4 py-2 bg-[#FF6A00] text-white rounded-lg hover:bg-[#E55A00] transition-colors">
                          Create First Post
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar (w-[320px]) */}
            <div className="space-y-6">
              {/* Fact Sheet */}
              <div className="bg-white rounded-2xl border border-[#E6E8EC] p-6">
                <h3 className="text-lg font-semibold text-[#0B0B0F] mb-4">Fact Sheet</h3>
                <div className="space-y-3">
                  <div className="text-sm">
                    <div className="text-[#60646C] mb-1">Created</div>
                    <div className="font-medium text-[#0B0B0F]">
                      {new Date(patch.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div className="text-[#60646C] mb-1">Members</div>
                    <div className="font-medium text-[#0B0B0F]">{patch._count.members}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-[#60646C] mb-1">Last Updated</div>
                    <div className="font-medium text-[#0B0B0F]">
                      {new Date(patch.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl border border-[#E6E8EC] p-6">
                <h3 className="text-lg font-semibold text-[#0B0B0F] mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#F7F8FA] rounded-lg transition-colors">
                    <div className="w-8 h-8 bg-[#FF6A00]/10 rounded-lg flex items-center justify-center">
                      <Plus className="w-4 h-4 text-[#FF6A00]" />
                    </div>
                    <span className="text-sm font-medium text-[#0B0B0F]">Add Fact</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#F7F8FA] rounded-lg transition-colors">
                    <div className="w-8 h-8 bg-[#0A5AFF]/10 rounded-lg flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-[#0A5AFF]" />
                    </div>
                    <span className="text-sm font-medium text-[#0B0B0F]">Add Event</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#F7F8FA] rounded-lg transition-colors">
                    <div className="w-8 h-8 bg-[#0A5AFF]/10 rounded-lg flex items-center justify-center">
                      <Archive className="w-4 h-4 text-[#0A5AFF]" />
                    </div>
                    <span className="text-sm font-medium text-[#0B0B0F]">Add Source</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#F7F8FA] rounded-lg transition-colors">
                    <div className="w-8 h-8 bg-[#FF6A00]/10 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-[#FF6A00]" />
                    </div>
                    <span className="text-sm font-medium text-[#0B0B0F]">Create Post</span>
                  </button>
                </div>
              </div>

              {/* Top Contributors */}
              <div className="bg-white rounded-2xl border border-[#E6E8EC] p-6">
                <h3 className="text-lg font-semibold text-[#0B0B0F] mb-4">Top Contributors</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#FF6A00]/10 rounded-full flex items-center justify-center">
                      <span className="text-[#FF6A00] font-semibold text-sm">U</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#0B0B0F]">User Name</div>
                      <div className="text-xs text-[#60646C]">12 contributions</div>
                    </div>
                    <div className="flex items-center gap-1 text-[#FF6A00]">
                      <Star className="w-3 h-3" />
                      <span className="text-xs">4.8</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Agent Dock (right-edge floating) */}
        <div className="fixed right-6 top-1/2 transform -translate-y-1/2 z-30">
          <div className="bg-white rounded-2xl border border-[#E6E8EC] shadow-lg p-4">
            <div className="space-y-3">
              <button className="w-12 h-12 bg-[#0A5AFF]/10 rounded-xl flex items-center justify-center hover:bg-[#0A5AFF]/20 transition-colors" title="Summarize">
                <Bot className="w-5 h-5 text-[#0A5AFF]" />
              </button>
              <button className="w-12 h-12 bg-[#FF6A00]/10 rounded-xl flex items-center justify-center hover:bg-[#FF6A00]/20 transition-colors" title="Add Fact">
                <Lightbulb className="w-5 h-5 text-[#FF6A00]" />
              </button>
              <button className="w-12 h-12 bg-[#0A5AFF]/10 rounded-xl flex items-center justify-center hover:bg-[#0A5AFF]/20 transition-colors" title="Add Event">
                <History className="w-5 h-5 text-[#0A5AFF]" />
              </button>
              <button className="w-12 h-12 bg-[#FF6A00]/10 rounded-xl flex items-center justify-center hover:bg-[#FF6A00]/20 transition-colors" title="Find Sources">
                <Search className="w-5 h-5 text-[#FF6A00]" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Repository patch page error:', error);
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Repository</h1>
          <p className="text-gray-600 mb-4">There was an error loading this repository page.</p>
          <p className="text-sm text-gray-500">Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
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
      tagline: true,
      description: true,
      tags: true,
    }
  });

  if (!patch) {
    return {
      title: 'Repository Not Found',
    };
  }

  return {
    title: `${patch.name} - Carrot Repository`,
    description: patch.tagline || patch.description,
    keywords: patch.tags.join(', '),
  };
}
