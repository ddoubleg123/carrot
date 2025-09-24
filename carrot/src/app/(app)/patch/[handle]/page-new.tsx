import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getPatchThemeClass } from '@/lib/patch-theme'
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
  TrendingUp,
  BookOpen,
  Share2,
  Heart,
  Flag,
  MoreHorizontal,
  ChevronRight,
  Plus,
  Search,
  Filter,
  Grid,
  List
} from 'lucide-react'

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

    // Simple patch query without complex includes
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
        {/* Beautiful Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-8">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900">{patch.name}</h1>
                      <p className="text-gray-600">Repository & Community</p>
                    </div>
                  </div>
                  <p className="text-gray-700 text-lg max-w-3xl mb-4">{patch.description}</p>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      {patch.tags.map((tag) => (
                        <span key={tag} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>1.2k members</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        <span>847 posts</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>Updated {patch.createdAt.toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                  <button className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Join
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: Grid },
                { id: 'timeline', label: 'Timeline', icon: Calendar },
                { id: 'resources', label: 'Resources', icon: FileText },
                { id: 'discussions', label: 'Discussions', icon: MessageSquare }
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content Area */}
            <div className="lg:col-span-2 space-y-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Key Facts */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Key Facts</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-500 mb-1">Current Status</div>
                        <div className="font-semibold text-gray-900">Active Movement</div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-500 mb-1">Primary Goal</div>
                        <div className="font-semibold text-gray-900">Congressional Term Limits</div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-500 mb-1">Proposed Limit</div>
                        <div className="font-semibold text-gray-900">12 Years Maximum</div>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-500 mb-1">Support Level</div>
                        <div className="font-semibold text-gray-900">78% Public Support</div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">New research paper added</div>
                          <div className="text-sm text-gray-500">"Term Limits and Congressional Effectiveness" by Dr. Sarah Chen</div>
                          <div className="text-xs text-gray-400 mt-1">2 hours ago</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <MessageSquare className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">New discussion started</div>
                          <div className="text-sm text-gray-500">"What would be the ideal term limit structure?"</div>
                          <div className="text-xs text-gray-400 mt-1">5 hours ago</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <Link className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">External resource shared</div>
                          <div className="text-sm text-gray-500">Congressional Research Service report on term limits</div>
                          <div className="text-xs text-gray-400 mt-1">1 day ago</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline Tab Content */}
              {activeTab === 'timeline' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Timeline</h2>
                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <Filter className="w-4 h-4 mr-1" />
                        Filter
                      </button>
                      <button className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <Calendar className="w-4 h-4 mr-1" />
                        Date Range
                      </button>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-3 h-3 bg-orange-500 rounded-full mt-2"></div>
                        <div className="w-px h-16 bg-gray-200 ml-1.5"></div>
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-900">2024-03-15</span>
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">Legislation</span>
                          </div>
                          <h3 className="font-semibold text-gray-900 mb-2">H.R. 1234 Introduced</h3>
                          <p className="text-gray-600 text-sm">Representative Johnson introduces the Congressional Term Limits Act of 2024, proposing 12-year limits for all members of Congress.</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mt-2"></div>
                        <div className="w-px h-16 bg-gray-200 ml-1.5"></div>
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-900">2024-02-28</span>
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Research</span>
                          </div>
                          <h3 className="font-semibold text-gray-900 mb-2">Stanford Study Published</h3>
                          <p className="text-gray-600 text-sm">New research shows term limits increase legislative productivity and reduce corruption in state legislatures.</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-3 h-3 bg-green-500 rounded-full mt-2"></div>
                      </div>
                      <div className="flex-1">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-900">2024-01-10</span>
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Event</span>
                          </div>
                          <h3 className="font-semibold text-gray-900 mb-2">National Rally</h3>
                          <p className="text-gray-600 text-sm">Over 50,000 supporters gather in Washington D.C. to demand congressional term limits.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Resources Tab Content */}
              {activeTab === 'resources' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Resources</h2>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search resources..."
                          className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
                        />
                      </div>
                      <button className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Add Resource
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-red-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">Congressional Term Limits Act of 2024</h3>
                        <p className="text-sm text-gray-500">Full text of H.R. 1234 - PDF Document</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>Added 2 days ago</span>
                          <span>•</span>
                          <span>1.2MB</span>
                          <span>•</span>
                          <span>47 views</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Link className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">Stanford Term Limits Research</h3>
                        <p className="text-sm text-gray-500">Academic study on effectiveness of term limits</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>Added 1 week ago</span>
                          <span>•</span>
                          <span>External Link</span>
                          <span>•</span>
                          <span>89 views</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Discussions Tab Content */}
              {activeTab === 'discussions' && (
                <div className="space-y-6">
                  {/* Discussion Input */}
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">U</span>
                      </div>
                      <div className="flex-1">
                        <textarea
                          placeholder="Start a discussion..."
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
                          rows={3}
                        />
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                              <Image className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                              <Video className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                              <FileText className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                              <Link className="w-4 h-4" />
                            </button>
                          </div>
                          <button className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors">
                            Post
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Discussion Feed */}
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">S</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-gray-900">Sarah Chen</span>
                            <span className="text-sm text-gray-500">2 hours ago</span>
                          </div>
                          <p className="text-gray-700 mb-4">What do you think would be the ideal term limit structure? Should it be consecutive terms or total years served?</p>
                          <div className="flex items-center gap-4">
                            <button className="flex items-center gap-1 text-gray-500 hover:text-orange-500 transition-colors">
                              <Heart className="w-4 h-4" />
                              <span className="text-sm">24</span>
                            </button>
                            <button className="flex items-center gap-1 text-gray-500 hover:text-orange-500 transition-colors">
                              <MessageSquare className="w-4 h-4" />
                              <span className="text-sm">8 replies</span>
                            </button>
                            <button className="text-gray-500 hover:text-orange-500 transition-colors">
                              <Share2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Plus className="w-4 h-4 text-orange-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">Add to Timeline</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Upload className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">Upload Resource</span>
                  </button>
                  <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-900">Start Discussion</span>
                  </button>
                </div>
              </div>

              {/* Top Contributors */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Top Contributors</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-xs">SC</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">Sarah Chen</div>
                      <div className="text-xs text-gray-500">47 contributions</div>
                    </div>
                    <div className="text-xs text-gray-400">#1</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-xs">MJ</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">Mike Johnson</div>
                      <div className="text-xs text-gray-500">32 contributions</div>
                    </div>
                    <div className="text-xs text-gray-400">#2</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-xs">AL</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">Alex Lee</div>
                      <div className="text-xs text-gray-500">28 contributions</div>
                    </div>
                    <div className="text-xs text-gray-400">#3</div>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Statistics</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Members</span>
                    <span className="font-semibold text-gray-900">1,247</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Active Discussions</span>
                    <span className="font-semibold text-gray-900">23</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Resources</span>
                    <span className="font-semibold text-gray-900">156</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Timeline Events</span>
                    <span className="font-semibold text-gray-900">89</span>
                  </div>
                </div>
              </div>
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
