import React from 'react';
import { prisma } from '@/lib/prisma';
import { getPatchThemeClass } from '@/lib/patch-theme';
import { Metadata } from 'next';
import { 
  BookOpen, 
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
  Library,
  Scroll,
  Archive,
  Globe,
  Map,
  Calendar,
  Award,
  GraduationCap,
  Microscope,
  PenTool,
  Quote,
  ExternalLink,
  Download,
  Bookmark,
  Tag,
  User,
  Settings,
  ChevronRight,
  Star,
  TrendingUp,
  Eye,
  ThumbsUp
} from 'lucide-react';

interface PatchPageProps {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function HistoryPatchPage({ params, searchParams }: PatchPageProps) {
  try {
    const { handle } = await params
    const search = await searchParams
    const activeTab = (search.tab as string) || 'overview'

    console.log('[HistoryPatchPage] Loading History patch with handle:', handle)

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
        events: {
          orderBy: { dateStart: 'asc' }
        },
        facts: true
      }
    });

    if (!patch) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">History Not Found</h1>
            <p className="text-gray-400">The historical repository "{handle}" does not exist.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-900 text-white">
        {/* Academic Header */}
        <div className="bg-gradient-to-r from-slate-800 via-gray-800 to-slate-900 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-8 sm:px-12 lg:px-16">
            <div className="py-16">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-8">
                  <div className="flex items-center gap-6 mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-2xl">
                      <Library className="w-10 h-10 text-white" />
                    </div>
                    <div>
                      <h1 className="text-5xl font-extrabold tracking-tight mb-3 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                        {patch.name}
                      </h1>
                      <p className="text-gray-300 text-xl leading-relaxed max-w-4xl">
                        {patch.description}
                      </p>
                    </div>
                  </div>
                  
                  {/* Academic Tags */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex gap-3">
                      {patch.tags.map((tag) => (
                        <span key={tag} className="px-4 py-2 bg-amber-500/20 text-amber-300 rounded-full text-sm font-medium border border-amber-500/30">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Academic Stats */}
                  <div className="flex items-center gap-8 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      <span>2,847 Scholars</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Scroll className="w-4 h-4" />
                      <span>15,623 Documents</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Archive className="w-4 h-4" />
                      <span>8,941 Sources</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>Updated {patch.createdAt.toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <button className="px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2">
                    <Share2 className="w-5 h-5" />
                    Share Repository
                  </button>
                  <button className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2 font-semibold">
                    <Plus className="w-5 h-5" />
                    Join Scholars
                  </button>
                  <button className="p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                    <Settings className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-8 sm:px-12 lg:px-16 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            {/* Main Content Area */}
            <div className="lg:col-span-3">
              {/* Academic Navigation */}
              <div className="bg-slate-800 rounded-2xl border border-gray-700 overflow-hidden mb-8">
                <div className="bg-slate-900 border-b border-gray-700 px-8 py-6">
                  <div className="flex space-x-8">
                    {[
                      { id: 'overview', label: 'Overview', icon: Grid },
                      { id: 'documents', label: 'Documents', icon: FileText },
                      { id: 'timeline', label: 'Timeline', icon: Calendar },
                      { id: 'sources', label: 'Sources', icon: Archive },
                      { id: 'discussions', label: 'Discussions', icon: MessageSquare }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                          activeTab === tab.id
                            ? 'border-amber-500 text-amber-400'
                            : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                        }`}
                      >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-8">
                  {activeTab === 'overview' && (
                    <div className="space-y-8">
                      {/* Key Historical Facts Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {patch.facts.map((fact, index) => (
                          <div key={fact.id} className="bg-slate-800 rounded-xl border border-gray-700 p-6 hover:border-amber-500/50 transition-colors">
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center">
                                <Award className="w-6 h-6 text-amber-400" />
                              </div>
                              <div className="flex-1">
                                <div className="text-sm text-gray-400 mb-2">{fact.label}</div>
                                <div className="text-lg font-semibold text-white">{fact.value}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Recent Scholarly Activity */}
                      <div className="bg-slate-800 rounded-xl border border-gray-700 p-8">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                          <TrendingUp className="w-6 h-6 text-amber-400" />
                          Recent Scholarly Activity
                        </h2>
                        <div className="space-y-6">
                          <div className="flex items-start gap-4 p-4 hover:bg-slate-700 rounded-lg transition-colors">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                              <FileText className="w-5 h-5 text-blue-400" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-white mb-1">New primary source added</div>
                              <div className="text-gray-400 text-sm mb-2">"The Code of Hammurabi" - Babylonian legal text (1750 BCE)</div>
                              <div className="text-xs text-gray-500">Added by Dr. Sarah Chen • 2 hours ago</div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Eye className="w-3 h-3" />
                              <span>127 views</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-4 p-4 hover:bg-slate-700 rounded-lg transition-colors">
                            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                              <MessageSquare className="w-5 h-5 text-green-400" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-white mb-1">New scholarly discussion</div>
                              <div className="text-gray-400 text-sm mb-2">"Reevaluating the Fall of Rome: Economic vs. Military Factors"</div>
                              <div className="text-xs text-gray-500">Started by Prof. Michael Torres • 5 hours ago</div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <ThumbsUp className="w-3 h-3" />
                              <span>23 upvotes</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'documents' && (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white">Historical Documents</h2>
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input
                              type="text"
                              placeholder="Search documents..."
                              className="pl-10 pr-4 py-2 bg-slate-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-sm text-white placeholder-gray-400"
                            />
                          </div>
                          <button className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Add Document
                          </button>
                        </div>
                      </div>

                      {/* Document Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                          {
                            title: "The Code of Hammurabi",
                            period: "1750 BCE",
                            type: "Legal Code",
                            description: "Ancient Babylonian law code, one of the earliest known legal documents.",
                            citations: 47,
                            views: 1234
                          },
                          {
                            title: "The Art of War",
                            period: "5th Century BCE",
                            type: "Military Treatise",
                            description: "Ancient Chinese military strategy text by Sun Tzu.",
                            citations: 89,
                            views: 2156
                          },
                          {
                            title: "The Republic",
                            period: "380 BCE",
                            type: "Philosophical Work",
                            description: "Plato's dialogue on justice and the ideal state.",
                            citations: 156,
                            views: 3421
                          }
                        ].map((doc, index) => (
                          <div key={index} className="bg-slate-800 rounded-xl border border-gray-700 p-6 hover:border-amber-500/50 transition-colors group">
                            <div className="flex items-start justify-between mb-4">
                              <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center">
                                <Scroll className="w-6 h-6 text-amber-400" />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">{doc.type}</span>
                                <button className="p-1 text-gray-400 hover:text-amber-400 transition-colors">
                                  <Bookmark className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-amber-400 transition-colors">
                              {doc.title}
                            </h3>
                            <p className="text-gray-400 text-sm mb-4">{doc.description}</p>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{doc.period}</span>
                              <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                  <Quote className="w-3 h-3" />
                                  {doc.citations}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  {doc.views}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'timeline' && (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white">Historical Timeline</h2>
                        <div className="flex items-center gap-4">
                          <button className="px-4 py-2 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 transition-colors flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            Filter Era
                          </button>
                          <button className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Add Event
                          </button>
                        </div>
                      </div>

                      {/* Timeline */}
                      <div className="relative">
                        <div className="absolute left-8 top-8 bottom-0 w-1 bg-gradient-to-b from-amber-500 to-orange-500 rounded-full"></div>
                        
                        <div className="space-y-12 pl-16">
                          {patch.events.map((event, index) => (
                            <div key={event.id} className="relative flex items-start gap-8">
                              <div className="relative z-10 flex-shrink-0 -ml-4">
                                <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg bg-gradient-to-br from-amber-500 to-orange-500 border-4 border-slate-900">
                                  <span className="text-white font-bold text-sm">
                                    {new Date(event.dateStart).getFullYear()}
                                  </span>
                                </div>
                              </div>

                              <div className="flex-1 bg-slate-800 rounded-xl border border-gray-700 p-6 hover:border-amber-500/50 transition-colors">
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                      <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-medium">
                                        Historical Event
                                      </span>
                                      <span className="text-sm text-gray-400">
                                        {new Date(event.dateStart).toLocaleDateString('en-US', { 
                                          year: 'numeric', 
                                          month: 'long', 
                                          day: 'numeric' 
                                        })}
                                      </span>
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-3">{event.title}</h3>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button className="p-2 text-gray-400 hover:text-amber-400 transition-colors">
                                      <Bookmark className="w-4 h-4" />
                                    </button>
                                    <button className="p-2 text-gray-400 hover:text-amber-400 transition-colors">
                                      <Share2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                                
                                <p className="text-gray-300 mb-4 leading-relaxed">{event.summary}</p>
                                
                                <div className="flex flex-wrap gap-2">
                                  {event.tags.map((tag) => (
                                    <span key={tag} className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-xs font-medium">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'sources' && (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white">Primary Sources</h2>
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input
                              type="text"
                              placeholder="Search sources..."
                              className="pl-10 pr-4 py-2 bg-slate-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none text-sm text-white placeholder-gray-400"
                            />
                          </div>
                          <button className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Add Source
                          </button>
                        </div>
                      </div>

                      {/* Sources List */}
                      <div className="space-y-4">
                        {[
                          {
                            title: "British Museum Collection",
                            type: "Museum Archive",
                            description: "Extensive collection of ancient artifacts and documents",
                            items: 125000,
                            lastUpdated: "2024-01-15"
                          },
                          {
                            title: "Library of Congress",
                            type: "National Library",
                            description: "Historical documents and manuscripts collection",
                            items: 89000,
                            lastUpdated: "2024-01-12"
                          },
                          {
                            title: "Vatican Secret Archives",
                            type: "Religious Archive",
                            description: "Historical documents from the Catholic Church",
                            items: 45000,
                            lastUpdated: "2024-01-10"
                          }
                        ].map((source, index) => (
                          <div key={index} className="bg-slate-800 rounded-xl border border-gray-700 p-6 hover:border-amber-500/50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-lg font-semibold text-white">{source.title}</h3>
                                  <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs">{source.type}</span>
                                </div>
                                <p className="text-gray-400 mb-3">{source.description}</p>
                                <div className="flex items-center gap-6 text-sm text-gray-500">
                                  <span>{source.items.toLocaleString()} items</span>
                                  <span>Updated {source.lastUpdated}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button className="p-2 text-gray-400 hover:text-amber-400 transition-colors">
                                  <ExternalLink className="w-4 h-4" />
                                </button>
                                <button className="p-2 text-gray-400 hover:text-amber-400 transition-colors">
                                  <Download className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'discussions' && (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-white">Scholarly Discussions</h2>
                        <button className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          Start Discussion
                        </button>
                      </div>

                      {/* Discussion Feed */}
                      <div className="space-y-6">
                        <div className="bg-slate-800 rounded-xl border border-gray-700 p-8">
                          <div className="flex items-start gap-6">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-bold">LC</span>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <span className="font-bold text-white">Dr. Lucius Cassius</span>
                                <span className="text-sm text-gray-400">Professor of Ancient History</span>
                                <span className="text-sm text-gray-500">3 hours ago</span>
                              </div>
                              <h3 className="text-lg font-semibold text-white mb-3">
                                Reevaluating the Fall of Rome: Economic vs. Military Factors
                              </h3>
                              <p className="text-gray-300 mb-4 leading-relaxed">
                                Recent archaeological evidence suggests that economic factors may have played a larger role in Rome's decline than previously thought. The traditional narrative of barbarian invasions as the primary cause needs reexamination...
                              </p>
                              <div className="flex items-center gap-6">
                                <button className="flex items-center gap-2 text-gray-400 hover:text-amber-400 transition-colors">
                                  <ThumbsUp className="w-4 h-4" />
                                  <span>23 upvotes</span>
                                </button>
                                <button className="flex items-center gap-2 text-gray-400 hover:text-amber-400 transition-colors">
                                  <MessageSquare className="w-4 h-4" />
                                  <span>8 replies</span>
                                </button>
                                <button className="text-gray-400 hover:text-amber-400 transition-colors">
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
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-8">
              {/* Quick Actions */}
              <div className="bg-slate-800 rounded-2xl border border-gray-700 p-8">
                <h3 className="text-xl font-bold text-white mb-6">Scholar Actions</h3>
                <div className="space-y-4">
                  <button className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-700 rounded-xl transition-colors">
                    <div className="w-10 h-10 bg-amber-500/20 rounded-lg flex items-center justify-center">
                      <Plus className="w-5 h-5 text-amber-400" />
                    </div>
                    <span className="text-lg font-medium text-white">Add Document</span>
                  </button>
                  <button className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-700 rounded-xl transition-colors">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <Upload className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-lg font-medium text-white">Upload Source</span>
                  </button>
                  <button className="w-full flex items-center gap-4 p-4 text-left hover:bg-slate-700 rounded-xl transition-colors">
                    <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-green-400" />
                    </div>
                    <span className="text-lg font-medium text-white">Start Discussion</span>
                  </button>
                </div>
              </div>

              {/* Featured Scholars */}
              <div className="bg-slate-800 rounded-2xl border border-gray-700 p-8">
                <h3 className="text-xl font-bold text-white mb-6">Featured Scholars</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 hover:bg-slate-700 rounded-lg transition-colors">
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face"
                      alt="Dr. Sarah Chen"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-white">Dr. Sarah Chen</p>
                      <p className="text-sm text-gray-400">Ancient History</p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400">
                      <Star className="w-4 h-4" />
                      <span className="text-sm">4.9</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 hover:bg-slate-700 rounded-lg transition-colors">
                    <img
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face"
                      alt="Prof. Michael Torres"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-white">Prof. Michael Torres</p>
                      <p className="text-sm text-gray-400">Medieval Studies</p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400">
                      <Star className="w-4 h-4" />
                      <span className="text-sm">4.8</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 hover:bg-slate-700 rounded-lg transition-colors">
                    <img
                      src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face"
                      alt="Dr. Emma Wilson"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-white">Dr. Emma Wilson</p>
                      <p className="text-sm text-gray-400">Classical Studies</p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400">
                      <Star className="w-4 h-4" />
                      <span className="text-sm">4.9</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Repository Statistics */}
              <div className="bg-slate-800 rounded-2xl border border-gray-700 p-8">
                <h3 className="text-xl font-bold text-white mb-6">Repository Statistics</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Total Documents</span>
                    <span className="font-bold text-xl text-amber-400">15,623</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Primary Sources</span>
                    <span className="font-bold text-xl text-amber-400">8,941</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Active Scholars</span>
                    <span className="font-bold text-xl text-amber-400">2,847</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Discussions</span>
                    <span className="font-bold text-xl text-amber-400">1,234</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('History patch page error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      handle: await params.then(p => p.handle).catch(() => 'unknown')
    });
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error Loading History</h1>
          <p className="text-gray-400 mb-4">There was an error loading the History repository.</p>
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
      title: 'History Not Found',
    };
  }

  return {
    title: `${patch.name} - Carrot History`,
    description: patch.description,
    keywords: patch.tags.join(', '),
  };
}
