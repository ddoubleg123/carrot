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
  Smile,
  Hash,
  MapPin
} from 'lucide-react';

interface PatchPageProps {
  params: Promise<{ handle: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Composer Component (like home page)
function HistoryComposer() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [content, setContent] = React.useState('');
  const [mediaType, setMediaType] = React.useState<'text' | 'image' | 'video' | 'pdf' | 'link'>('text');
  const [dateInput, setDateInput] = React.useState('');
  const [era, setEra] = React.useState<'BCE' | 'CE'>('CE');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement submission logic
    console.log('Submitting:', { content, mediaType, dateInput, era });
    setContent('');
    setDateInput('');
    setIsOpen(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
          <Plus className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Add to History</h3>
          <p className="text-sm text-gray-500">Share documents, events, or insights</p>
        </div>
      </div>

      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Plus className="w-5 h-5 text-gray-400" />
            <span className="text-gray-600">What would you like to add to the historical record?</span>
          </div>
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Media Type Selector */}
          <div className="flex gap-2">
            {[
              { id: 'text', label: 'Text', icon: FileText },
              { id: 'image', label: 'Image', icon: FileImage },
              { id: 'video', label: 'Video', icon: FileVideo },
              { id: 'pdf', label: 'PDF', icon: FileTextIcon },
              { id: 'link', label: 'Link', icon: Link2 }
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setMediaType(type.id as any)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mediaType === type.id
                    ? 'bg-purple-100 text-purple-700 border border-purple-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <type.icon className="w-4 h-4" />
                {type.label}
              </button>
            ))}
          </div>

          {/* Date Input */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="text"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                placeholder="e.g., 753 BCE, 1066, September 11, 2001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Era</label>
              <select
                value={era}
                onChange={(e) => setEra(e.target.value as 'BCE' | 'CE')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm"
              >
                <option value="CE">CE (Common Era)</option>
                <option value="BCE">BCE (Before Common Era)</option>
              </select>
            </div>
          </div>

          {/* Content Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe the historical event, document, or insight..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Add to History
            </button>
          </div>
        </form>
      )}
    </div>
  );
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

    // Mock data for AI agents and contributors
    const aiAgents = [
      { id: '1', name: 'Historical Scholar AI', role: 'Ancient History Expert', avatar: 'https://ui-avatars.com/api/?name=HSA&background=8B5CF6&color=fff', contributions: 45 },
      { id: '2', name: 'Document Analyzer', role: 'Primary Source Specialist', avatar: 'https://ui-avatars.com/api/?name=DA&background=3B82F6&color=fff', contributions: 32 },
      { id: '3', name: 'Timeline Curator', role: 'Chronological Expert', avatar: 'https://ui-avatars.com/api/?name=TC&background=10B981&color=fff', contributions: 28 }
    ];

    const contributors = [
      { id: '1', name: 'Dr. Sarah Chen', role: 'Medieval Historian', avatar: 'https://ui-avatars.com/api/?name=SC&background=F59E0B&color=fff', contributions: 67 },
      { id: '2', name: 'Michael Torres', role: 'Archaeologist', avatar: 'https://ui-avatars.com/api/?name=MT&background=EF4444&color=fff', contributions: 54 },
      { id: '3', name: 'Emma Wilson', role: 'Classical Studies', avatar: 'https://ui-avatars.com/api/?name=EW&background=8B5CF6&color=fff', contributions: 41 }
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
        {/* Colorful Header with Better Spacing */}
        <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white sticky top-0 z-20 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="py-8">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-6">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                      <History className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold text-white">{patch.name}</h1>
                      {patch.tagline && (
                        <p className="text-blue-100 text-sm mt-1">{patch.tagline}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    {patch.tags.map((tag) => (
                      <span key={tag} className="px-3 py-1 bg-white/20 text-white rounded-full text-xs font-medium backdrop-blur-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                  {/* Metric Bar */}
                  <div className="flex items-center gap-6 text-sm text-blue-100">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>{patch._count?.members || 0} members</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      <span>{patch._count?.posts || 0} posts</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>{patch._count?.events || 0} events</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4" />
                      <span>{patch._count?.sources || 0} sources</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button className="px-6 py-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-colors text-sm font-medium backdrop-blur-sm border border-white/20">
                    <Share2 className="w-4 h-4 inline-block mr-2" /> Share
                  </button>
                  <button className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors text-sm font-medium shadow-lg">
                    <Plus className="w-4 h-4 inline-block mr-2" /> Join
                  </button>
                  <button className="p-3 text-white/80 hover:bg-white/20 rounded-xl transition-colors backdrop-blur-sm">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Pill Nav with Better Spacing */}
        <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-[120px] z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <nav className="flex space-x-8 py-4">
              {[
                { id: 'overview', label: 'Overview', icon: Grid },
                { id: 'timeline', label: 'Timeline', icon: Calendar },
                { id: 'resources', label: 'Resources', icon: Archive },
                { id: 'posts', label: 'Posts', icon: MessageSquare }
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
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
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Content Area */}
            <div className="lg:col-span-3 max-w-[880px] space-y-8">
              {/* Fixed Composer Box */}
              <HistoryComposer />

              {activeTab === 'overview' && (
                <div className="space-y-8">
                  {/* Recent Activity */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      Recent Activity
                    </h2>
                    <div className="space-y-4">
                      {[
                        { type: 'event', title: 'New archaeological discovery in Pompeii', date: '2 hours ago', icon: Calendar, color: 'blue' },
                        { type: 'resource', title: 'Ancient Roman Coinage Database added', date: '5 hours ago', icon: FileText, color: 'green' },
                        { type: 'post', title: 'Discussion: The impact of Roman roads on trade', date: '1 day ago', icon: MessageSquare, color: 'purple' },
                        { type: 'event', title: 'Lecture: Roman Engineering Feats', date: '2 days ago', icon: Calendar, color: 'blue' },
                        { type: 'resource', title: 'Digital archive of Roman texts', date: '3 days ago', icon: FileText, color: 'green' },
                      ].map((activity, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                          <div className={`w-8 h-8 bg-${activity.color}-100 rounded-full flex items-center justify-center`}>
                            <activity.icon className={`w-4 h-4 text-${activity.color}-600`} />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{activity.title}</div>
                            <div className="text-sm text-gray-500">{activity.type === 'post' ? `by ${contributors[0].name}` : ''}</div>
                            <div className="text-xs text-gray-400 mt-1">{activity.date}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'timeline' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-6 h-6 text-purple-500" />
                      Timeline of {patch.name}
                    </h2>
                    <div className="flex items-center gap-4">
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm">
                        <Filter className="w-4 h-4" /> Filter Tags
                      </button>
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4" /> Date Range
                      </button>
                    </div>
                  </div>
                  <div className="relative pl-8">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500 to-blue-500"></div>
                    {[
                      { title: 'Founding of Rome', date: '753 BCE', summary: 'According to Roman mythology, Rome was founded by Romulus and Remus.', tags: ['founding', 'mythology'] },
                      { title: 'Roman Republic Established', date: '509 BCE', summary: 'The Roman Kingdom was overthrown and replaced with a republic.', tags: ['republic', 'government'] },
                      { title: 'Julius Caesar Assassinated', date: '44 BCE', summary: 'Julius Caesar was assassinated by a group of senators led by Brutus.', tags: ['assassination', 'politics'] },
                      { title: 'Fall of Western Roman Empire', date: '476 CE', summary: 'The Western Roman Empire officially ended when Germanic chieftain Odoacer deposed the last Roman emperor.', tags: ['fall', 'empire'] }
                    ].map((event, index) => (
                      <div key={index} className="mb-8 relative">
                        <div className="absolute -left-1.5 top-1 w-3 h-3 bg-purple-500 rounded-full ring-4 ring-white shadow-lg"></div>
                        <div className="ml-8 bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">{event.title}</h3>
                          <p className="text-sm text-purple-600 mb-3 font-medium">{event.date}</p>
                          <p className="text-gray-700 text-base mb-3">{event.summary}</p>
                          <div className="flex flex-wrap gap-2">
                            {event.tags.map((tag) => (
                              <span key={tag} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'resources' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      <Archive className="w-6 h-6 text-blue-500" />
                      Reference Library
                    </h2>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        placeholder="Search resources..."
                        className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    {[
                      { title: 'British Museum Collection', domain: 'britishmuseum.org', type: 'Museum Archive' },
                      { title: 'Library of Congress Digital Collections', domain: 'loc.gov', type: 'Library' },
                      { title: 'Vatican Secret Archives', domain: 'vatican.va', type: 'Religious Archive' },
                      { title: 'JSTOR: Scholarly Journals', domain: 'jstor.org', type: 'Academic Database' },
                      { title: 'Project Gutenberg: Classical Texts', domain: 'gutenberg.org', type: 'Digital Library' },
                    ].map((source, index) => (
                      <div key={index} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                            <Link className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{source.title}</p>
                            <p className="text-sm text-gray-500">{source.domain}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors" title="Open Source">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors" title="Copy Citation">
                            <Copy className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors" title="Attach to Timeline">
                            <Calendar className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'posts' && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      <MessageSquare className="w-6 h-6 text-green-500" />
                      Community Posts
                    </h2>
                    <div className="flex items-center gap-4">
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm">
                        <Filter className="w-4 h-4" /> Top
                      </button>
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4" /> New
                      </button>
                    </div>
                  </div>
                  <div className="space-y-6">
                    {[
                      { author: 'Dr. Sarah Chen', title: 'Reevaluating the Fall of Rome: Economic vs. Military Factors', body: 'A deep dive into the complex reasons behind the collapse of the Western Roman Empire...', likes: 45, comments: 12 },
                      { author: 'Prof. Emma Wilson', title: 'New Discoveries at Pompeii: Insights into Daily Roman Life', body: 'Recent excavations have unearthed fascinating artifacts providing new perspectives...', likes: 30, comments: 8 },
                    ].map((post, index) => (
                      <div key={index} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                            {post.author.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{post.author}</p>
                            <p className="text-xs text-gray-500">2 hours ago</p>
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{post.title}</h3>
                        <p className="text-gray-700 text-base mb-4">{post.body}</p>
                        <div className="flex items-center gap-6 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Heart className="w-4 h-4" /> {post.likes}
                          </div>
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" /> {post.comments}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* AI Agents */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-500" />
                  AI Agents
                </h3>
                <div className="space-y-3">
                  {aiAgents.map((agent) => (
                    <div key={agent.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <img
                        src={agent.avatar}
                        alt={agent.name}
                        className="w-8 h-8 rounded-full"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{agent.name}</p>
                        <p className="text-xs text-gray-500">{agent.role}</p>
                      </div>
                      <span className="text-xs text-gray-400">{agent.contributions}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Contributors */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-yellow-500" />
                  Top Contributors
                </h3>
                <div className="space-y-3">
                  {contributors.map((contributor) => (
                    <div key={contributor.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <img
                        src={contributor.avatar}
                        alt={contributor.name}
                        className="w-8 h-8 rounded-full"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{contributor.name}</p>
                        <p className="text-xs text-gray-500">{contributor.role}</p>
                      </div>
                      <span className="text-xs text-gray-400">{contributor.contributions}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-500" />
                  Quick Actions
                </h3>
                <div className="space-y-3">
                  <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Plus className="w-4 h-4 text-purple-600" />
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
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Repository page error:', error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error Loading Repository</h1>
          <p className="text-gray-400 mb-4">There was an error loading this repository page.</p>
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
