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
  BookOpen,
  Share2,
  Heart,
  MoreHorizontal,
  Plus,
  Search,
  Filter,
  Grid
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

    // Use Rome template for Rome handle
    if (handle === 'rome') {
      const RomePage = (await import('./page-rome')).default;
      return <RomePage params={params} searchParams={searchParams} />;
    }

    // Use Repository template for History handle
    if (handle === 'history') {
      const RepositoryPage = (await import('./page-repository-v2')).default;
      return <RepositoryPage params={params} searchParams={searchParams} />;
    }

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