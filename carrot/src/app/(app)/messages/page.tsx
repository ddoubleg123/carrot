'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Search, 
  MessageSquare, 
  Mail, 
  Phone,
  Plus,
  MoreVertical,
  Settings,
  Users,
  Clock,
  Check,
  CheckCheck,
  Paperclip,
  Smile,
  Send,
  Bot,
  Shield,
  AlertCircle,
  Star,
  Archive,
  Trash2,
  Volume2,
  VolumeX,
  Flag,
  UserPlus,
  X
} from 'lucide-react';
import MinimalNav from '../../../components/MinimalNav';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

// Mock data for design
const mockThreads = [
  {
    id: '1',
    title: 'Clean Energy Discussion',
    isGroup: true,
    participants: [
      { id: '1', name: 'Sarah Chen', avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=40&h=40&fit=crop', isOnline: true, isExternal: false },
      { id: '2', name: 'Mike Johnson', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop', isOnline: false, isExternal: false },
      { id: '3', name: 'Alex Rivera', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop', isOnline: true, isExternal: false }
    ],
    lastMessage: {
      text: 'The new solar efficiency breakthrough is really promising for our project timeline.',
      sender: 'Sarah Chen',
      timestamp: '2m ago',
      isRead: true,
      channel: 'in_app'
    },
    unreadCount: 0,
    channels: ['in_app'],
    contextCarrotId: 'cmf123',
    contextTitle: 'Solar Panel Efficiency Study',
    isMuted: false,
    isPinned: true
  },
  {
    id: '2',
    title: 'Dr. Emily Watson',
    isGroup: false,
    participants: [
      { id: '4', name: 'Dr. Emily Watson', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop', isOnline: false, isExternal: false }
    ],
    lastMessage: {
      text: 'Thanks for sharing the research paper. I\'ll review it and get back to you by tomorrow.',
      sender: 'Dr. Emily Watson',
      timestamp: '1h ago',
      isRead: false,
      channel: 'email'
    },
    unreadCount: 2,
    channels: ['in_app', 'email'],
    isMuted: false,
    isPinned: false
  },
  {
    id: '3',
    title: 'Policy Research Team',
    isGroup: true,
    participants: [
      { id: '5', name: 'David Kim', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop', isOnline: true, isExternal: false },
      { id: '6', name: 'Lisa Wang', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=40&h=40&fit=crop', isOnline: false, isExternal: false },
      { id: '7', name: 'external@policy.org', avatar: null, isOnline: false, isExternal: true }
    ],
    lastMessage: {
      text: 'The UBI implementation data from Finland shows interesting patterns we should discuss.',
      sender: 'David Kim',
      timestamp: '3h ago',
      isRead: true,
      channel: 'in_app'
    },
    unreadCount: 0,
    channels: ['in_app', 'email'],
    isMuted: false,
    isPinned: false
  },
  {
    id: '4',
    title: 'Marketing Team',
    isGroup: true,
    participants: [
      { id: '8', name: 'Jennifer Lee', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40&h=40&fit=crop', isOnline: true, isExternal: false },
      { id: '9', name: 'Tom Wilson', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=40&h=40&fit=crop', isOnline: false, isExternal: false }
    ],
    lastMessage: {
      text: 'Can we schedule a meeting to discuss the Q4 campaign strategy?',
      sender: 'Jennifer Lee',
      timestamp: '1d ago',
      isRead: true,
      channel: 'in_app'
    },
    unreadCount: 0,
    channels: ['in_app'],
    isMuted: true,
    isPinned: false
  }
];

type FilterType = 'all' | 'dms' | 'email' | 'sms';
type ChannelType = 'in_app' | 'email' | 'sms';

export default function MessagesPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showNewThread, setShowNewThread] = useState(false);
  const [showAIDraft, setShowAIDraft] = useState(false);

  const filteredThreads = mockThreads.filter(thread => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'dms') return !thread.isGroup;
    if (activeFilter === 'email') return thread.channels.includes('email');
    return false;
  });

  const ThreadRow = ({ thread }: { thread: typeof mockThreads[0] }) => (
    <div 
      className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
        selectedThread === thread.id ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''
      }`}
      onClick={() => setSelectedThread(thread.id)}
    >
      <div className="flex items-start gap-3">
        {/* Avatar Stack */}
        <div className="flex -space-x-2">
          {thread.participants.slice(0, 3).map((participant, index) => (
            <div key={participant.id} className="relative">
              <div className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white overflow-hidden">
                {participant.avatar ? (
                  <img 
                    src={participant.avatar} 
                    alt={participant.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold">
                    {participant.isExternal ? 'E' : participant.name.charAt(0)}
                  </div>
                )}
              </div>
              {participant.isOnline && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
              )}
            </div>
          ))}
          {thread.participants.length > 3 && (
            <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-semibold text-gray-600">
              +{thread.participants.length - 3}
            </div>
          )}
        </div>

        {/* Thread Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-900 truncate">{thread.title}</h3>
            <div className="flex items-center gap-2">
              {thread.isPinned && <Star className="w-4 h-4 text-orange-500" />}
              {thread.isMuted && <VolumeX className="w-4 h-4 text-gray-400" />}
              <span className="text-xs text-gray-500">{thread.lastMessage.timestamp}</span>
            </div>
          </div>

          {/* Channel Pills */}
          <div className="flex items-center gap-1 mb-2">
            {thread.channels.map((channel) => (
              <span 
                key={channel}
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  channel === 'in_app' 
                    ? 'bg-blue-100 text-blue-700' 
                    : channel === 'email'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {channel === 'in_app' ? 'DM' : channel === 'email' ? 'Email' : 'SMS'}
              </span>
            ))}
            {thread.contextCarrotId && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Carrot
              </span>
            )}
          </div>

          {/* Last Message */}
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-600 truncate flex-1">
              <span className="font-medium">{thread.lastMessage.sender}:</span> {thread.lastMessage.text}
            </p>
            <div className="flex items-center gap-1">
              {thread.lastMessage.channel === 'email' && (
                <Mail className="w-3 h-3 text-orange-500" />
              )}
              {thread.lastMessage.isRead ? (
                <CheckCheck className="w-4 h-4 text-blue-500" />
              ) : (
                <Check className="w-4 h-4 text-gray-400" />
              )}
              {thread.unreadCount > 0 && (
                <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold">
                  {thread.unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const ThreadView = ({ threadId }: { threadId: string }) => {
    const thread = mockThreads.find(t => t.id === threadId);
    if (!thread) return null;

    return (
      <div className="flex flex-col h-full">
        {/* Thread Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {thread.participants.slice(0, 3).map((participant, index) => (
                  <div key={participant.id} className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white overflow-hidden">
                    {participant.avatar ? (
                      <img src={participant.avatar} alt={participant.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-400 to-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                        {participant.isExternal ? 'E' : participant.name.charAt(0)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">{thread.title}</h2>
                <div className="flex items-center gap-2">
                  {thread.channels.map((channel) => (
                    <span 
                      key={channel}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        channel === 'in_app' 
                          ? 'bg-blue-100 text-blue-700' 
                          : channel === 'email'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {channel === 'in_app' ? 'DM' : channel === 'email' ? 'Email' : 'SMS'}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <UserPlus className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <Settings className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Context Ribbon */}
          {thread.contextCarrotId && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-800">Carrot Context</span>
                </div>
                <button className="text-sm text-green-600 hover:text-green-800 font-medium">
                  Open Carrot →
                </button>
              </div>
              <p className="text-sm text-green-700 mt-1">{thread.contextTitle}</p>
            </div>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Sample Messages */}
          <div className="flex justify-end">
            <div className="bg-blue-500 text-white rounded-2xl rounded-br-md px-4 py-2 max-w-xs">
              <p className="text-sm">Hey team, I found this interesting research about solar efficiency.</p>
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-xs opacity-75">2:30 PM</span>
                <CheckCheck className="w-3 h-3" />
              </div>
            </div>
          </div>

          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md px-4 py-2 max-w-xs">
              <p className="text-sm">That's really promising! Can you share the link?</p>
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-xs text-gray-500">2:32 PM</span>
                <Check className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Email Message */}
          <div className="flex justify-start">
            <div className="bg-orange-50 border border-orange-200 rounded-2xl rounded-bl-md px-4 py-2 max-w-xs">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-medium text-orange-700">Email</span>
              </div>
              <p className="text-sm text-gray-900">Thanks for sharing the research paper. I'll review it and get back to you by tomorrow.</p>
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-xs text-gray-500">1:45 PM</span>
                <Check className="w-3 h-3 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Carrot Post Reference */}
          <div className="flex justify-end">
            <div className="bg-blue-500 text-white rounded-2xl rounded-br-md px-4 py-2 max-w-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-xs font-medium">Carrot Post</span>
              </div>
              <div className="bg-white/20 rounded-lg p-2">
                <div className="w-full h-24 bg-gray-200 rounded mb-2"></div>
                <p className="text-xs font-medium">Solar Panel Efficiency Study</p>
                <p className="text-xs opacity-75">New breakthrough in perovskite technology...</p>
              </div>
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-xs opacity-75">2:35 PM</span>
                <CheckCheck className="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>

        {/* Composer */}
        <div className="p-4 border-t border-gray-200 bg-white">
          {/* Channel Selector */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-gray-600">Send via:</span>
            <div className="flex gap-1">
              <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                DM
              </button>
              <button className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                Email
              </button>
              <button className="px-3 py-1 bg-gray-100 text-gray-400 rounded-full text-xs font-medium opacity-50" disabled>
                SMS
              </button>
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <textarea
                placeholder="Type a message..."
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                rows={1}
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <Paperclip className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <Smile className="w-5 h-5" />
              </button>
              <button 
                className="p-2 text-orange-500 hover:text-orange-600 rounded-lg hover:bg-orange-50"
                onClick={() => setShowAIDraft(true)}
              >
                <Bot className="w-5 h-5" />
              </button>
              <button className="px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const NewThreadModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">New Thread</h2>
          <button 
            onClick={() => setShowNewThread(false)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Thread Type</label>
            <div className="flex gap-2">
              <button className="flex-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium">
                Direct Message
              </button>
              <button className="flex-1 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg">
                Email Thread
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Add People</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search people or enter email..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Thread Title (Optional)</label>
            <input
              type="text"
              placeholder="Enter thread title..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              onClick={() => setShowNewThread(false)}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
              Create Thread
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const AIDraftPanel = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-orange-500" />
            <h2 className="text-xl font-semibold">AI Email Draft</h2>
          </div>
          <button 
            onClick={() => setShowAIDraft(false)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
            <select className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option>Professional</option>
              <option>Casual</option>
              <option>Friendly</option>
              <option>Formal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Objective</label>
            <textarea
              placeholder="What do you want to achieve with this email?"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Key Points</label>
            <textarea
              placeholder="List the main points you want to cover..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
              rows={3}
            />
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-orange-500 mt-0.5" />
              <div className="text-sm text-orange-800">
                <p className="font-medium">AI Consent Required</p>
                <p>You must grant permission for AI to draft emails. This feature is opt-in only.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              onClick={() => setShowAIDraft(false)}
              className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
              Generate Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-gray-50 ${inter.className}`}>
      <MinimalNav />
      
      <div className="flex h-screen">
        {/* Thread List Sidebar */}
        <div className="w-96 border-r border-gray-200 bg-white flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
              <button 
                onClick={() => setShowNewThread(true)}
                className="p-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'All', count: mockThreads.length },
                { id: 'dms', label: 'DMs', count: mockThreads.filter(t => !t.isGroup).length },
                { id: 'email', label: 'Email', count: mockThreads.filter(t => t.channels.includes('email')).length },
                { id: 'sms', label: 'SMS', count: 0, disabled: true }
              ].map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id as FilterType)}
                  disabled={filter.disabled}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    activeFilter === filter.id
                      ? 'bg-orange-500 text-white'
                      : filter.disabled
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter.label} {filter.count > 0 && `(${filter.count})`}
                </button>
              ))}
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto">
            {filteredThreads.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} />
            ))}
          </div>
        </div>

        {/* Thread View */}
        <div className="flex-1 flex flex-col">
          {selectedThread ? (
            <ThreadView threadId={selectedThread} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
                <p className="text-gray-500">Choose a thread from the sidebar to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showNewThread && <NewThreadModal />}
      {showAIDraft && <AIDraftPanel />}
    </div>
  );
}
