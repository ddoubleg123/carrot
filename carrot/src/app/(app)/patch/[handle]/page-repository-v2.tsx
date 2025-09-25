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
  Globe,
  Sparkles,
  Zap,
  Target,
  Crown,
  Award,
  UserPlus,
  Brain,
  BookmarkCheck,
  CalendarDays,
  FileImage,
  FileVideo,
  FileText as FileTextIcon,
  Link2,
  Send,
  X,
  Check
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
          take: 8,
          include: {
            source: {
              select: {
                id: true,
                title: true,
                url: true,
                author: true
              }
            }
          }
        },
        events: {
          orderBy: { dateStart: 'asc' },
          take: 20,
          include: {
            sources: {
              select: {
                id: true,
                title: true,
                url: true,
                author: true
              }
            }
          }
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

    // Get theme-based background
    const getBackgroundClass = (theme: string | null) => {
      switch (theme) {
        case 'warm':
          return 'bg-gradient-to-br from-[#FFFFFF] to-[rgba(255,106,0,0.04)]';
        case 'stone':
          return 'bg-gradient-to-br from-[#FFFFFF] to-[#F7F8FA]';
        case 'light':
        default:
          return 'bg-gradient-to-br from-[#FFFFFF] to-[rgba(10,90,255,0.03)]';
      }
    };

    return (
      <div className={`min-h-screen ${getBackgroundClass(patch.theme)}`}>
        {/* Compact Header (max 88px) */}
        <div className="bg-white border-b border-[#E6E8EC] sticky top-0 z-20 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-[#0B0B0F] truncate">{patch.name}</h1>
                {patch.tagline && (
                  <p className="text-[#60646C] text-sm mt-1 line-clamp-1">{patch.tagline}</p>
                )}
                <div className="flex gap-2 mt-2">
                  {patch.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-1 bg-[#E6E8EC] text-[#60646C] rounded-lg text-xs font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <button className="px-4 py-2 bg-[#0A5AFF] text-white rounded-xl hover:bg-[#0047CC] transition-colors text-sm font-semibold">
                  <UserPlus className="w-4 h-4 inline-block mr-2" /> Join
                </button>
                <button className="p-2 text-[#60646C] hover:bg-[#E6E8EC] rounded-xl transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
                <button className="p-2 text-[#60646C] hover:bg-[#E6E8EC] rounded-xl transition-colors">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Metric Bar */}
            <div className="flex items-center gap-6 text-[#60646C] text-sm mt-4">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{patch._count?.members || 0} members</span>
              </div>
              <div className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                <span>{patch._count?.posts || 0} posts</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{patch._count?.events || 0} events</span>
              </div>
              <div className="flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                <span>{patch._count?.sources || 0} sources</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Content Column */}
            <div className="lg:col-span-3 space-y-8">
              {/* Sticky Pill Nav */}
              <div className="bg-white rounded-2xl shadow-sm border border-[#E6E8EC] p-1 flex justify-around sticky top-[120px] z-10">
                {[
                  { id: 'overview', label: 'Overview', icon: Grid },
                  { id: 'timeline', label: 'Timeline', icon: Calendar },
                  { id: 'resources', label: 'Resources', icon: Archive },
                  { id: 'posts', label: 'Posts', icon: MessageSquare }
                ].map((tab) => (
                  <a
                    key={tab.id}
                    href={`?tab=${tab.id}`}
                    className={`flex-1 text-center py-3 px-2 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
                      activeTab === tab.id
                        ? 'bg-[#0A5AFF] text-white shadow-sm'
                        : 'text-[#60646C] hover:bg-[#E6E8EC] hover:text-[#0B0B0F]'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </a>
                ))}
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <div className="space-y-8">
                  {/* Key Facts */}
                  <div className="bg-white rounded-2xl shadow-sm border border-[#E6E8EC] p-6">
                    <h2 className="text-xl font-bold text-[#0B0B0F] mb-6">Key Facts</h2>
                    {patch.facts.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {patch.facts.map((fact) => (
                          <div key={fact.id} className="flex justify-between items-start p-4 bg-[#F7F8FA] rounded-xl">
                            <div className="flex-1">
                              <div className="font-semibold text-[#0B0B0F] text-sm">{fact.label}</div>
                              <div className="text-[#60646C] text-sm mt-1">{fact.value}</div>
                            </div>
                            {fact.source && (
                              <div className="ml-3">
                                <span className="px-2 py-1 bg-[#0A5AFF]/10 text-[#0A5AFF] rounded-lg text-xs font-medium">
                                  {fact.source.title}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-[#60646C]">
                        <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">No facts yet</p>
                        <p className="text-sm">Add facts to build the knowledge base</p>
                      </div>
                    )}
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-white rounded-2xl shadow-sm border border-[#E6E8EC] p-6">
                    <h2 className="text-xl font-bold text-[#0B0B0F] mb-6">Recent Activity</h2>
                    <div className="space-y-4">
                      {patch.events.slice(0, 3).map((event) => (
                        <div key={event.id} className="flex items-start gap-3 p-3 hover:bg-[#F7F8FA] rounded-xl transition-colors">
                          <div className="w-8 h-8 bg-[#0A5AFF]/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-4 h-4 text-[#0A5AFF]" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-[#0B0B0F] text-sm">{event.title}</div>
                            <div className="text-[#60646C] text-xs mt-1">{new Date(event.dateStart).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))}
                      {patch.sources.slice(0, 2).map((source) => (
                        <div key={source.id} className="flex items-start gap-3 p-3 hover:bg-[#F7F8FA] rounded-xl transition-colors">
                          <div className="w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <Link className="w-4 h-4 text-green-500" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-[#0B0B0F] text-sm">{source.title}</div>
                            <div className="text-[#60646C] text-xs mt-1">{source.url}</div>
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
                  <div className="bg-white rounded-2xl shadow-sm border border-[#E6E8EC] p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold text-[#0B0B0F]">Timeline</h2>
                      <div className="flex items-center gap-3">
                        <button className="px-3 py-1 bg-[#E6E8EC] text-[#60646C] rounded-lg text-sm hover:bg-[#D1D5DB] transition-colors">
                          <Filter className="w-4 h-4 inline-block mr-1" /> Filter
                        </button>
                        <button className="px-3 py-1 bg-[#E6E8EC] text-[#60646C] rounded-lg text-sm hover:bg-[#D1D5DB] transition-colors">
                          <Calendar className="w-4 h-4 inline-block mr-1" /> Date Range
                        </button>
                      </div>
                    </div>
                    
                    {/* Timeline Events */}
                    <div className="relative pl-8">
                      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-[#E6E8EC]"></div>
                      {patch.events.map((event, index) => (
                        <div key={event.id} className="mb-8 relative">
                          <div className="absolute -left-2 top-1 w-4 h-4 bg-[#0A5AFF] rounded-full border-2 border-white"></div>
                          <div className="ml-6 bg-white rounded-2xl shadow-sm border border-[#E6E8EC] p-4 hover:shadow-md transition-shadow">
                            <h3 className="text-lg font-bold text-[#0B0B0F] mb-2">{event.title}</h3>
                            <p className="text-[#60646C] text-sm mb-3">
                              {new Date(event.dateStart).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                              {event.dateEnd && ` – ${new Date(event.dateEnd).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}`}
                            </p>
                            <p className="text-[#0B0B0F] text-sm mb-3 line-clamp-3">{event.summary}</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {event.tags.map((tag) => (
                                <span key={tag} className="px-2 py-1 bg-[#E6E8EC] text-[#60646C] rounded-lg text-xs font-medium">
                                  {tag}
                                </span>
                              ))}
                              {event.sources.length > 0 && (
                                <span className="px-2 py-1 bg-[#0A5AFF]/10 text-[#0A5AFF] rounded-lg text-xs font-medium">
                                  {event.sources.length} sources
                                </span>
                              )}
                              {event.media && (
                                <span className="px-2 py-1 bg-[#FF6A00]/10 text-[#FF6A00] rounded-lg text-xs font-medium flex items-center gap-1">
                                  {event.media.type === 'image' && <Image className="w-3 h-3" />}
                                  {event.media.type === 'video' && <Video className="w-3 h-3" />}
                                  Media
                                </span>
                              )}
                            </div>
                            {event.media?.url && event.media.type === 'image' && (
                              <img src={event.media.url} alt={event.title} className="mt-3 rounded-lg max-h-48 object-cover w-full" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'resources' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-[#E6E8EC] p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-[#0B0B0F]">Reference Library</h2>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#60646C]" size={16} />
                        <input
                          type="text"
                          placeholder="Search resources..."
                          className="w-64 pl-10 pr-4 py-2 border border-[#E6E8EC] rounded-xl focus:ring-2 focus:ring-[#0A5AFF] focus:border-transparent outline-none text-sm bg-white"
                        />
                      </div>
                    </div>
                    
                    {patch.sources.length > 0 ? (
                      <div className="space-y-3">
                        {patch.sources.map((source) => (
                          <div key={source.id} className="bg-[#F7F8FA] rounded-xl p-4 flex items-center justify-between hover:bg-[#E6E8EC] transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-[#E6E8EC] rounded-lg flex items-center justify-center flex-shrink-0">
                                <Link className="w-4 h-4 text-[#60646C]" />
                              </div>
                              <div>
                                <p className="font-semibold text-[#0B0B0F] text-sm">{source.title}</p>
                                <p className="text-[#60646C] text-xs">{new URL(source.url).hostname}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button className="p-2 text-[#60646C] hover:bg-white rounded-lg transition-colors" title="Open Source">
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <button className="p-2 text-[#60646C] hover:bg-white rounded-lg transition-colors" title="Copy Citation">
                                <Copy className="w-4 h-4" />
                              </button>
                              <button className="p-2 text-[#60646C] hover:bg-white rounded-lg transition-colors" title="Attach to Timeline">
                                <CalendarDays className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-[#60646C]">
                        <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">No sources yet</p>
                        <p className="text-sm">Add sources to build the reference library</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'posts' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm border border-[#E6E8EC] p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-[#0B0B0F]">Community Posts</h2>
                      <div className="flex items-center gap-3">
                        <button className="px-3 py-1 bg-[#0A5AFF] text-white rounded-lg text-sm font-medium">
                          <TrendingUp className="w-4 h-4 inline-block mr-1" /> Top
                        </button>
                        <button className="px-3 py-1 bg-[#E6E8EC] text-[#60646C] rounded-lg text-sm hover:bg-[#D1D5DB] transition-colors">
                          <Clock className="w-4 h-4 inline-block mr-1" /> New
                        </button>
                      </div>
                    </div>
                    
                    {patch.posts.length > 0 ? (
                      <div className="space-y-4">
                        {patch.posts.map((post) => (
                          <div key={post.id} className="bg-[#F7F8FA] rounded-xl p-4 hover:bg-[#E6E8EC] transition-colors">
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-8 h-8 bg-[#0A5AFF] rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                                {post.author.name.charAt(0)}
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-[#0B0B0F] text-sm">{post.author.name}</p>
                                <p className="text-[#60646C] text-xs">{new Date(post.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            {post.title && <h3 className="text-lg font-bold text-[#0B0B0F] mb-2">{post.title}</h3>}
                            {post.body && <p className="text-[#0B0B0F] text-sm mb-3">{post.body}</p>}
                            <div className="flex items-center gap-4 text-[#60646C] text-xs">
                              <div className="flex items-center gap-1">
                                <ThumbsUp className="w-4 h-4" /> {post.metrics.likes || 0}
                              </div>
                              <div className="flex items-center gap-1">
                                <MessageSquare className="w-4 h-4" /> {post.metrics.comments || 0}
                              </div>
                              <div className="flex items-center gap-1">
                                <Eye className="w-4 h-4" /> {post.metrics.views || 0}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-[#60646C]">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">No posts yet</p>
                        <p className="text-sm">Start the conversation</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Fact Sheet */}
              <div className="bg-white rounded-2xl shadow-sm border border-[#E6E8EC] p-6">
                <h3 className="text-lg font-bold text-[#0B0B0F] mb-4">Fact Sheet</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#60646C]">Created</span>
                    <span className="text-[#0B0B0F] font-medium">{new Date(patch.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#60646C]">Members</span>
                    <span className="text-[#0B0B0F] font-medium">{patch._count?.members || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#60646C]">Events</span>
                    <span className="text-[#0B0B0F] font-medium">{patch._count?.events || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#60646C]">Sources</span>
                    <span className="text-[#0B0B0F] font-medium">{patch._count?.sources || 0}</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl shadow-sm border border-[#E6E8EC] p-6">
                <h3 className="text-lg font-bold text-[#0B0B0F] mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#F7F8FA] rounded-xl transition-colors">
                    <div className="w-8 h-8 bg-[#FF6A00]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Plus className="w-4 h-4 text-[#FF6A00]" />
                    </div>
                    <span className="text-sm font-semibold text-[#0B0B0F]">Add Fact</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#F7F8FA] rounded-xl transition-colors">
                    <div className="w-8 h-8 bg-[#0A5AFF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-[#0A5AFF]" />
                    </div>
                    <span className="text-sm font-semibold text-[#0B0B0F]">Add Event</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#F7F8FA] rounded-xl transition-colors">
                    <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Link className="w-4 h-4 text-green-500" />
                    </div>
                    <span className="text-sm font-semibold text-[#0B0B0F]">Add Source</span>
                  </button>
                </div>
              </div>

              {/* AI Agents */}
              <div className="bg-white rounded-2xl shadow-sm border border-[#E6E8EC] p-6">
                <h3 className="text-lg font-bold text-[#0B0B0F] mb-4">AI Agents</h3>
                <div className="space-y-3">
                  {[
                    { name: 'Research Assistant', role: 'Fact Finding', icon: Brain },
                    { name: 'Timeline Curator', role: 'Event Organization', icon: Calendar },
                    { name: 'Source Validator', role: 'Citation Check', icon: Check }
                  ].map((agent, index) => (
                    <div key={index} className="flex items-center gap-3 p-2 hover:bg-[#F7F8FA] rounded-lg transition-colors">
                      <div className="w-8 h-8 bg-[#0A5AFF]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <agent.icon className="w-4 h-4 text-[#0A5AFF]" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-[#0B0B0F] text-sm">{agent.name}</p>
                        <p className="text-[#60646C] text-xs">{agent.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Agent Dock (right-edge floating) */}
        <div className="fixed right-6 top-1/2 transform -translate-y-1/2 z-30">
          <div className="bg-white rounded-2xl shadow-lg border border-[#E6E8EC] p-2">
            <div className="space-y-2">
              <button className="w-12 h-12 bg-[#0A5AFF]/10 text-[#0A5AFF] rounded-xl hover:bg-[#0A5AFF]/20 transition-colors flex items-center justify-center" title="Summarize">
                <Sparkles className="w-5 h-5" />
              </button>
              <button className="w-12 h-12 bg-[#FF6A00]/10 text-[#FF6A00] rounded-xl hover:bg-[#FF6A00]/20 transition-colors flex items-center justify-center" title="Add Fact">
                <Plus className="w-5 h-5" />
              </button>
              <button className="w-12 h-12 bg-green-500/10 text-green-500 rounded-xl hover:bg-green-500/20 transition-colors flex items-center justify-center" title="Add Event">
                <Calendar className="w-5 h-5" />
              </button>
              <button className="w-12 h-12 bg-purple-500/10 text-purple-500 rounded-xl hover:bg-purple-500/20 transition-colors flex items-center justify-center" title="Find Sources">
                <Search className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Repository page error:', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Repository</h1>
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
      description: true,
      tags: true,
      tagline: true,
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
