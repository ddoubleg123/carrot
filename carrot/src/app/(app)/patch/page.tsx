'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Search, 
  MessageSquare, 
  History, 
  BookOpen, 
  Users, 
  Plus,
  Filter,
  SortAsc,
  Calendar,
  Link as LinkIcon,
  FileText,
  Shield,
  Star,
  TrendingUp,
  Clock,
  ChevronRight,
  Globe,
  Lock,
  Edit3,
  BarChart3,
  Zap,
  Brain,
  Target,
  Sparkles
} from 'lucide-react';
import MinimalNav from '../../../components/MinimalNav';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

// Mock data for design
const mockGroups = [
  {
    id: '1',
    name: 'Clean Energy',
    slug: 'clean-energy',
    description: 'Sustainable energy solutions, renewable technology, and environmental impact',
    avatar: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=100&h=100&fit=crop',
    cover: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    stats: { members: 1240, threads: 89, events: 23 },
    tags: ['renewable', 'solar', 'wind', 'sustainability'],
    latestUpdate: '2 hours ago',
    isJoined: true,
    role: 'member'
  },
  {
    id: '2', 
    name: 'Universal Basic Income',
    slug: 'ubi',
    description: 'Exploring UBI implementation, economic models, and social impact studies',
    avatar: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=100&h=100&fit=crop',
    cover: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    stats: { members: 980, threads: 156, events: 41 },
    tags: ['economics', 'policy', 'welfare', 'automation'],
    latestUpdate: '5 hours ago',
    isJoined: false,
    role: 'guest'
  },
  {
    id: '3',
    name: 'Term Limits',
    slug: 'term-limits', 
    description: 'Political reform, governance, and democratic accountability',
    avatar: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=100&h=100&fit=crop',
    cover: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    stats: { members: 2110, threads: 203, events: 67 },
    tags: ['politics', 'reform', 'governance', 'democracy'],
    latestUpdate: '1 day ago',
    isJoined: true,
    role: 'editor'
  }
];

const mockTimelineEvents = [
  {
    id: '1',
    date: '2024-09-20',
    title: 'New Solar Efficiency Breakthrough',
    summary: 'Researchers achieve 47% efficiency in perovskite solar cells',
    type: 'breakthrough',
    relatedThreads: 3,
    sources: 2
  },
  {
    id: '2', 
    date: '2024-09-19',
    title: 'UBI Pilot Program Results',
    summary: 'Stockton, CA pilot shows positive economic impact',
    type: 'study',
    relatedThreads: 8,
    sources: 5
  },
  {
    id: '3',
    date: '2024-09-18', 
    title: 'Term Limits Bill Passes Committee',
    summary: 'House committee advances constitutional amendment',
    type: 'policy',
    relatedThreads: 12,
    sources: 3
  }
];

const mockLibrarySources = [
  {
    id: '1',
    title: 'Solar Panel Efficiency Study 2024',
    type: 'research',
    url: 'https://example.com/solar-study',
    credibility: 'high',
    tags: ['solar', 'efficiency', 'research'],
    addedBy: 'Dr. Sarah Chen',
    addedAt: '2 days ago'
  },
  {
    id: '2',
    title: 'UBI Economic Impact Analysis',
    type: 'report',
    url: 'https://example.com/ubi-analysis',
    credibility: 'high', 
    tags: ['ubi', 'economics', 'analysis'],
    addedBy: 'Economic Policy Institute',
    addedAt: '1 week ago'
  }
];

type TabType = 'overview' | 'threads' | 'timeline' | 'library' | 'members';

export default function PatchPage() {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'hot' | 'new' | 'top' | 'controversial'>('hot');

  const currentGroup = selectedGroup ? mockGroups.find(g => g.id === selectedGroup) : null;

  const GroupHeader = ({ group }: { group: typeof mockGroups[0] }) => (
    <div className="relative rounded-2xl overflow-hidden mb-6">
      <div 
        className="h-48 w-full"
        style={{ background: group.cover }}
      />
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex items-end gap-4">
          <div className="w-20 h-20 rounded-2xl bg-white/90 backdrop-blur-sm border-4 border-white/50 overflow-hidden">
            <img 
              src={group.avatar} 
              alt={group.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 text-white">
            <h1 className="text-3xl font-bold mb-2">{group.name}</h1>
            <p className="text-white/90 mb-4 max-w-2xl">{group.description}</p>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{group.stats.members.toLocaleString()} members</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                <span>{group.stats.threads} threads</span>
              </div>
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" />
                <span>{group.stats.events} events</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            {group.isJoined ? (
              <>
                <button className="px-6 py-3 bg-white/20 backdrop-blur-sm text-white rounded-xl border border-white/30 hover:bg-white/30 transition-all">
                  <Plus className="w-4 h-4 mr-2 inline" />
                  New Thread
                </button>
                <button className="px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl border border-white/20 hover:bg-white/20 transition-all">
                  Leave Group
                </button>
              </>
            ) : (
              <button className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all font-semibold">
                Join Group
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const GroupTabs = () => (
    <div className="flex items-center gap-1 mb-6 bg-gray-50 rounded-2xl p-1">
      {[
        { id: 'overview', label: 'Overview', icon: BookOpen },
        { id: 'threads', label: 'Threads', icon: MessageSquare },
        { id: 'timeline', label: 'Timeline', icon: History },
        { id: 'library', label: 'Library', icon: FileText },
        { id: 'members', label: 'Members', icon: Users }
      ].map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setActiveTab(id as TabType)}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${
            activeTab === id
              ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          }`}
        >
          <Icon className="w-4 h-4" />
          <span className="font-medium">{label}</span>
        </button>
      ))}
    </div>
  );

  const OverviewTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column - Summary */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Group Summary</h2>
            <button className="flex items-center gap-2 text-orange-500 hover:text-orange-600 transition-colors">
              <Edit3 className="w-4 h-4" />
              <span className="text-sm font-medium">Suggest Edit</span>
            </button>
          </div>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 leading-relaxed mb-4">
              This group focuses on advancing clean energy solutions and sustainable technology. 
              We discuss the latest developments in solar, wind, and other renewable energy sources, 
              share research findings, and explore policy implications for a greener future.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              Our community includes researchers, engineers, policymakers, and advocates working 
              together to accelerate the transition to clean energy. We welcome evidence-based 
              discussions, technical analysis, and practical solutions.
            </p>
            <button className="text-orange-500 hover:text-orange-600 font-medium">
              Read full summary →
            </button>
          </div>
        </div>

        {/* Recent Timeline Items */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Timeline</h3>
          <div className="space-y-4">
            {mockTimelineEvents.slice(0, 3).map((event) => (
              <div key={event.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-gray-500">{event.date}</span>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                      {event.type}
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1">{event.title}</h4>
                  <p className="text-sm text-gray-600 mb-2">{event.summary}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{event.relatedThreads} threads</span>
                    <span>{event.sources} sources</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column - Stats & Links */}
      <div className="space-y-6">
        {/* Key Stats */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Key Stats</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Active Members</span>
              <span className="font-semibold">1,240</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Threads This Week</span>
              <span className="font-semibold">23</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Timeline Events</span>
              <span className="font-semibold">67</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Library Sources</span>
              <span className="font-semibold">142</span>
            </div>
          </div>
        </div>

        {/* Top Links */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Top Links</h3>
          <div className="space-y-3">
            {mockLibrarySources.slice(0, 3).map((source) => (
              <a 
                key={source.id}
                href={source.url}
                className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
              >
                <LinkIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0 group-hover:text-orange-500 transition-colors" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 group-hover:text-orange-600 transition-colors overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {source.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      {source.credibility}
                    </span>
                    <span className="text-xs text-gray-500">{source.addedAt}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* AI Suggestions */}
        <div className="bg-gradient-to-br from-orange-50 to-blue-50 rounded-2xl border border-orange-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-orange-500" />
            <h3 className="font-semibold text-gray-900">AI Suggestions</h3>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Based on recent activity, consider adding these topics to the timeline:
          </p>
          <div className="space-y-2">
            <div className="text-sm bg-white/50 rounded-lg p-2">
              "Solar storage breakthrough" - 3 related threads
            </div>
            <div className="text-sm bg-white/50 rounded-lg p-2">
              "Policy update" - 2 new sources available
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ThreadsTab = () => (
    <div className="space-y-6">
      {/* Filters & Sort */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
            {['Hot', 'New', 'Top', 'Controversial'].map((sort) => (
              <button
                key={sort}
                onClick={() => setSortBy(sort.toLowerCase() as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sortBy === sort.toLowerCase()
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {sort}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">Filters</span>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors">
          <Plus className="w-4 h-4" />
          New Thread
        </button>
      </div>

      {/* Thread Cards */}
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                U
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-gray-900">@user{123 + i}</span>
                  <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full">
                    <span className="text-xs">🇺🇸</span>
                    <span className="text-xs text-gray-600">US</span>
                  </div>
                  <span className="text-sm text-gray-500">• {i}h ago</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {i === 1 ? 'New Solar Panel Efficiency Record Broken' : 
                   i === 2 ? 'UBI Implementation in Nordic Countries' :
                   i === 3 ? 'Term Limits: Constitutional Amendment Progress' :
                   i === 4 ? 'Clean Energy Storage Solutions Discussion' :
                   'Policy Framework for Renewable Energy Adoption'}
                </h3>
                <p className="text-gray-600 mb-4 line-clamp-2">
                  {i === 1 ? 'Researchers at MIT have achieved a new efficiency record of 47.2% in perovskite solar cells, marking a significant breakthrough in renewable energy technology.' :
                   i === 2 ? 'Examining the successful implementation of Universal Basic Income programs across Nordic countries and their economic impact.' :
                   i === 3 ? 'Latest developments in the constitutional amendment process for implementing congressional term limits.' :
                   i === 4 ? 'Exploring various energy storage solutions for grid-scale renewable energy integration.' :
                   'Comprehensive analysis of policy frameworks needed to accelerate renewable energy adoption nationwide.'}
                </p>
                <div className="flex items-center gap-6 text-sm text-gray-500">
                  <button className="flex items-center gap-1 hover:text-orange-500 transition-colors">
                    <TrendingUp className="w-4 h-4" />
                    <span>Support</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-orange-500 transition-colors">
                    <MessageSquare className="w-4 h-4" />
                    <span>{12 + i * 3} comments</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-orange-500 transition-colors">
                    <Zap className="w-4 h-4" />
                    <span>Boost</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-orange-500 transition-colors">
                    <Star className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const TimelineTab = () => (
    <div className="space-y-6">
      {/* Timeline Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
            {['All', 'Year', 'Month', 'Week'].map((zoom) => (
              <button
                key={zoom}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-900 shadow-sm"
              >
                {zoom}
              </button>
            ))}
          </div>
          <span className="text-sm text-gray-500">Drag to navigate timeline</span>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors">
          <Plus className="w-4 h-4" />
          Add Event
        </button>
      </div>

      {/* Timeline Canvas */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="relative h-96 overflow-x-auto">
          {/* Timeline Line */}
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-200 transform -translate-y-1/2" />
          
          {/* Timeline Events */}
          <div className="relative flex gap-8">
            {mockTimelineEvents.map((event, index) => (
              <div key={event.id} className="flex-shrink-0 w-64">
                <div className="relative">
                  {/* Event Card */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full" />
                      <span className="text-xs text-gray-500">{event.date}</span>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-2">{event.title}</h4>
                    <p className="text-sm text-gray-600 mb-3">{event.summary}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{event.relatedThreads} threads</span>
                      <span>{event.sources} sources</span>
                    </div>
                  </div>
                  
                  {/* Connection Line */}
                  {index < mockTimelineEvents.length - 1 && (
                    <div className="absolute top-1/2 -right-4 w-8 h-0.5 bg-gray-200 transform -translate-y-1/2" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const LibraryTab = () => (
    <div className="space-y-6">
      {/* Library Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
            {['All', 'Research', 'Reports', 'Articles'].map((type) => (
              <button
                key={type}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-900 shadow-sm"
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors">
          <Plus className="w-4 h-4" />
          Add Source
        </button>
      </div>

      {/* Library Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockLibrarySources.map((source) => (
          <div key={source.id} className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-orange-600" />
                </div>
                <span className="text-sm font-medium text-gray-600 capitalize">{source.type}</span>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                source.credibility === 'high' 
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                {source.credibility}
              </div>
            </div>
            
            <h3 className="font-semibold text-gray-900 mb-2 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{source.title}</h3>
            
            <div className="flex flex-wrap gap-1 mb-4">
              {source.tags.map((tag) => (
                <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                  {tag}
                </span>
              ))}
            </div>
            
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Added by {source.addedBy}</span>
              <span>{source.addedAt}</span>
            </div>
            
            <a 
              href={source.url}
              className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <LinkIcon className="w-4 h-4" />
              View Source
            </a>
          </div>
        ))}
      </div>
    </div>
  );

  const MembersTab = () => (
    <div className="space-y-6">
      {/* Member Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
            {['All', 'Admins', 'Editors', 'Members'].map((role) => (
              <button
                key={role}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-900 shadow-sm"
              >
                {role}
              </button>
            ))}
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors">
          <Plus className="w-4 h-4" />
          Invite Members
        </button>
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-blue-500 flex items-center justify-center text-white font-semibold">
                U{i}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900">@user{i}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                    {i === 1 ? 'Admin' : i <= 3 ? 'Editor' : 'Member'}
                  </span>
                  <span className="text-xs text-gray-500">Joined {i}w ago</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
              <span>{i * 12} posts</span>
              <span>{i * 8} comments</span>
            </div>
            
            <div className="flex gap-2">
              <button className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm">
                Message
              </button>
              <button className="flex-1 px-3 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm">
                View Profile
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderTabContent = () => {
    if (!currentGroup) return null;
    
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'threads':
        return <ThreadsTab />;
      case 'timeline':
        return <TimelineTab />;
      case 'library':
        return <LibraryTab />;
      case 'members':
        return <MembersTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div className={`min-h-screen bg-gray-50 ${inter.className}`}>
      <MinimalNav />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <span>Carrot Patch</span>
          <ChevronRight className="w-4 h-4" />
          {currentGroup ? (
            <>
              <span>{currentGroup.name}</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-900 font-medium capitalize">{activeTab}</span>
            </>
          ) : (
            <span className="text-gray-900 font-medium">Groups</span>
          )}
        </div>

        {currentGroup ? (
          <>
            <GroupHeader group={currentGroup} />
            <GroupTabs />
            {renderTabContent()}
          </>
        ) : (
          <>
            {/* Groups List Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Carrot Patch</h1>
                <p className="text-gray-600">Public knowledge repositories for collaborative learning and discussion</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search groups..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-3 w-80 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <button className="flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors font-semibold">
                  <Plus className="w-5 h-5" />
                  Create Group
                </button>
              </div>
            </div>

            {/* Debug Info */}
            <div className="mb-4 p-4 bg-yellow-100 border border-yellow-300 rounded">
              <p>Debug: Found {mockGroups.length} groups</p>
              <p>Current group: {currentGroup ? currentGroup.name : 'None'}</p>
              <p>Selected group: {selectedGroup || 'None'}</p>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockGroups.map((group) => (
                <Link 
                  key={group.id}
                  href={`/patch/${group.slug}`}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer group block"
                >
                  <div 
                    className="h-32 w-full"
                    style={{ background: group.cover }}
                  />
                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-200 overflow-hidden -mt-6 flex-shrink-0">
                        <img 
                          src={group.avatar} 
                          alt={group.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNkI3MjgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=';
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 mb-1 text-lg">{group.name}</h3>
                        <p className="text-sm text-gray-600">{group.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{group.stats.members.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        <span>{group.stats.threads}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <History className="w-4 h-4" />
                        <span>{group.stats.events}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mb-4">
                      {group.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Updated {group.latestUpdate}</span>
                      <div className="flex items-center gap-2">
                        {group.isJoined ? (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                            Joined
                          </span>
                        ) : (
                          <button className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full hover:bg-orange-200 transition-colors">
                            Join
                          </button>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
