'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  X, 
  Plus, 
  Settings, 
  Brain, 
  MessageSquare, 
  History, 
  Pin, 
  EyeOff,
  Users,
  Link,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Play, 
  CheckCircle, 
  AlertTriangle, 
  Command, 
  Clock, 
  User, 
  ArrowRight, 
  ArrowLeft, 
  Target, 
  Palette, 
  Code, 
  Shield,
  Upload,
  Image,
  File,
  ExternalLink
} from 'lucide-react';
// import { OptimizedImage, AvatarImage } from '@/components/ui/OptimizedImage';
import { getAutoJoinAgents, getAllAgents, getAgentById, logAgentInteraction } from '@/lib/agentMatching';
import { useSession } from 'next-auth/react';

// Design Tokens
const COLORS = {
  actionOrange: '#FF6A00',
  civicBlue: '#0A5AFF',
  ink: '#0B0B0F',
  surface: '#FFFFFF',
  slate: '#64748B',
  gray: '#6B7280'
};

// Use enhanced agents from the matching library
const AGENTS = getAllAgents();

// Message types
interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  user?: {
    id: string;
    name: string;
    username: string;
    avatar: string;
  };
  agent?: {
    id: string;
    name: string;
    role: string;
    avatar: string;
  };
  timestamp: Date;
}

// Thread types
interface Thread {
  id: string;
  title: string;
  messages: Message[];
  activeAgents: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Original Agent Card Component (from the original design)
function AgentCard({ agent, onClick }: { agent: any; onClick: () => void }) {
  // Format name to ensure last name is on second line for consistency
  const formatName = (name: string) => {
    const parts = name.split(' ');
    if (parts.length <= 2) {
      return { first: parts[0], last: parts[1] || '' };
    } else {
      // For names with 3+ parts, put everything except first name on second line
      return { first: parts[0], last: parts.slice(1).join(' ') };
    }
  };

  const { first, last } = formatName(agent.name);

  return (
    <div className="group cursor-pointer" onClick={onClick}>
      <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-200 hover:border-orange-500 hover:shadow-xl transition-all duration-300 hover:scale-105 h-[280px] flex flex-col">
        {/* Avatar - Main Focus - Fixed height for consistency */}
        <div className="h-[200px] relative">
          <img
            src={agent.avatar}
            alt={agent.name}
            className="w-full h-full object-cover object-top"
            onError={(e) => {
              console.error('Image failed to load:', agent.avatar);
              e.currentTarget.style.display = 'none';
            }}
          />
          {/* Subtle overlay on hover */}
          <div className="absolute inset-0 bg-orange-500/0 group-hover:bg-orange-500/10 transition-colors duration-300" />
          </div>
          
        {/* Agent Info - Fixed height for consistency */}
        <div className="h-[80px] p-4 text-center flex flex-col justify-center">
          <h3 className="font-bold text-gray-900 text-lg mb-1 leading-tight">
            {first}
            {last && (
              <>
                <br />
                {last}
              </>
            )}
          </h3>
          <p className="text-sm text-gray-600 font-medium">{agent.role}</p>
        </div>
      </div>
    </div>
  );
}

// Chat Starter Component (Original Design)
function ChatStarter({ onStartConversation }: { onStartConversation: (query: string) => void }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onStartConversation(query.trim());
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What's your obsession today?"
          className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:outline-none transition-colors shadow-sm"
          onKeyPress={(e) => e.key === 'Enter' && handleSubmit(e)}
        />
              <button
          onClick={handleSubmit}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
        >
          <Send size={20} />
          </button>
      </div>
    </div>
  );
}

// Upload Modal Component
function UploadModal({ 
  isOpen, 
  onClose, 
  onUpload 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onUpload: (type: 'pdf' | 'link' | 'image', data: string) => void;
}) {
  const [uploadType, setUploadType] = useState<'pdf' | 'link' | 'image'>('link');
  const [linkUrl, setLinkUrl] = useState('');
  const [fileInput, setFileInput] = useState<HTMLInputElement | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadType === 'link' && linkUrl.trim()) {
      onUpload('link', linkUrl.trim());
      setLinkUrl('');
      onClose();
    } else if (uploadType === 'pdf' || uploadType === 'image') {
      // File upload will be handled by the file input change event
      fileInput?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // For now, we'll just send the file name
      // In a real implementation, you'd upload the file and get a URL
      onUpload(uploadType, file.name);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Share Content</h3>
                <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X size={20} />
                </button>
          </div>

        {/* Upload Type Selector */}
        <div className="flex gap-2 mb-4">
              <button
            onClick={() => setUploadType('link')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
              uploadType === 'link'
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <ExternalLink size={20} />
            <span className="font-medium">Link</span>
              </button>
            <button
            onClick={() => setUploadType('pdf')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
              uploadType === 'pdf'
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <File size={20} />
            <span className="font-medium">PDF</span>
            </button>
              <button
            onClick={() => setUploadType('image')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
              uploadType === 'image'
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <Image size={20} />
            <span className="font-medium">Image</span>
              </button>
          </div>

        {/* Upload Form */}
        <form onSubmit={handleSubmit}>
          {uploadType === 'link' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website URL
                </label>
            <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  required
                />
              </div>
          </div>
          )}

          {(uploadType === 'pdf' || uploadType === 'image') && (
            <div className="space-y-4">
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-xl">
                <div className="flex flex-col items-center gap-3">
                  {uploadType === 'pdf' ? (
                    <File className="text-gray-400" size={48} />
                  ) : (
                    <Image className="text-gray-400" size={48} />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Click to upload {uploadType === 'pdf' ? 'PDF' : 'image'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {uploadType === 'pdf' ? 'PDF files up to 10MB' : 'JPG, PNG, GIF up to 5MB'}
                    </p>
                          </div>
                        </div>
              </div>
          </div>
          )}
          
          <div className="flex gap-3 mt-6">
          <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
          </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
            >
              {uploadType === 'link' ? 'Share Link' : `Upload ${uploadType === 'pdf' ? 'PDF' : 'Image'}`}
            </button>
        </div>
        </form>

        {/* Hidden file input */}
        <input
          ref={setFileInput}
          type="file"
          accept={uploadType === 'pdf' ? '.pdf' : 'image/*'}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}

// Conversation Thread Component
function ConversationThread({ 
  thread, 
  onSendMessage 
}: { 
  thread: Thread; 
  onSendMessage: (content: string) => void;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  const lastMessageCountRef = useRef(0);

  // Check if user is at the bottom of the chat
  const checkIfAtBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return false;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 30; // allow buffer
  };

  // Bulletproof scroll to bottom with DOM timing
  const scrollToBottom = () => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
  };

  // Handle scroll events
  const handleScroll = () => {
    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);
    
    // Show scroll button if user has scrolled up significantly
    if (scrollContainerRef.current) {
      const { scrollTop } = scrollContainerRef.current;
      setShowScrollButton(!atBottom && scrollTop > 100);
      
      // Track user scroll behavior
      if (!atBottom && scrollTop > 0) {
        setHasUserScrolled(true);
      } else if (atBottom) {
        setHasUserScrolled(false);
      }
    }
  };

  // Initialize scroll behavior for new thread
  useEffect(() => {
    setIsAtBottom(true);
    setHasUserScrolled(false);
    setShowScrollButton(false);
    
    // Delay scroll until DOM is painted
    const timeout = setTimeout(() => {
      scrollToBottom();
    }, 100);

    return () => clearTimeout(timeout);
  }, [thread.id]);

  // Handle new messages with proper DOM timing
  useEffect(() => {
    const currentMessageCount = thread.messages.length;
    const hasNewMessages = currentMessageCount > lastMessageCountRef.current;
    
    if (hasNewMessages) {
      // Only auto-scroll if user is at bottom
      if (isAtBottom) {
        // Delay scroll until DOM is painted
        const timeout = setTimeout(() => {
          scrollToBottom();
        }, 100);
        
        return () => clearTimeout(timeout);
      }
    }
    
    lastMessageCountRef.current = currentMessageCount;
  }, [thread.messages.length, isAtBottom]);

  // Set up scroll event listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Optional: ResizeObserver for dynamic content (images, markdown, etc.)
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      // Only auto-scroll if user is at bottom
      if (isAtBottom) {
        const timeout = setTimeout(() => {
          scrollToBottom();
        }, 50);
        
        return () => clearTimeout(timeout);
      }
    });

    resizeObserver.observe(scrollContainerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [isAtBottom]);


  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div 
        ref={scrollContainerRef}
        style={{
          height: '100%',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
        className="flex-1 px-6 py-6 pb-24"
      >
        <div className="space-y-4">
          {thread.messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-4 ${
              message.type === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {/* User Avatar */}
            {message.type === 'user' && message.user && (
              <div className="flex-shrink-0">
                <img
                  src={message.user.avatar}
                  alt={message.user.name}
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => {
                    console.error('User avatar failed to load:', message.user?.avatar);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Agent Avatar */}
            {message.type === 'agent' && message.agent && (
              <div className="flex-shrink-0">
                <img
                  src={message.agent.avatar}
                  alt={message.agent.name}
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => {
                    console.error('Agent avatar failed to load:', message.agent?.avatar);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            <div
              className={`max-w-2xl px-4 py-3 rounded-2xl ${
                message.type === 'user'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {/* User Message Header */}
              {message.type === 'user' && message.user && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm text-white">{message.user.name}</span>
                  <span className="text-xs text-orange-200">@{message.user.username}</span>
                </div>
              )}

              {/* Agent Message Header */}
              {message.type === 'agent' && message.agent && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm">{message.agent.name}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    AI Expert
                  </span>
                </div>
              )}

              <p className="text-sm">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to Bottom Button */}
      {showScrollButton && (
        <div className="fixed bottom-24 right-6 z-30">
          <button
            onClick={() => {
              if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-105"
            title="Scroll to latest messages"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

// Agent Roster Sidebar Component
function AgentRoster({ 
  agents, 
  activeAgents, 
  onToggleAgent, 
  onRemoveAgent,
  onPinAgent,
  onHideAgent 
}: {
  agents: typeof AGENTS;
  activeAgents: string[];
  onToggleAgent: (agentId: string) => void;
  onRemoveAgent: (agentId: string) => void;
  onPinAgent: (agentId: string) => void;
  onHideAgent: (agentId: string) => void;
}) {
  const [showSettings, setShowSettings] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'responding': return 'bg-orange-500';
      case 'idle': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h4 className="font-medium text-gray-900 mb-3">Agent Preferences</h4>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2">
              <Pin size={16} />
              Pin agents to always include
                  </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2">
              <EyeOff size={16} />
              Hide agents from auto-join
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2">
              <Users size={16} />
              Curate "My Council"
            </button>
                    </div>
                  </div>
                )}
              
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search agents..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
          />
        </div>
      </div>

      {/* Active Agents */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pt-6">
          <h4 className="text-sm font-medium text-gray-500 mb-3">Active Advisors</h4>
          <div className="space-y-3">
            {agents
              .filter(agent => activeAgents.includes(agent.id))
              .map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                >
                  <div className="relative">
                    <img
                      src={agent.avatar}
                      alt={agent.name}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        console.error('Agent avatar failed to load:', agent.avatar);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(agent.status)} rounded-full border-2 border-white`} />
            </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{agent.name}</p>
                    <p className="text-sm text-gray-500 truncate">{agent.role}</p>
        </div>

          <button
                    onClick={() => onRemoveAgent(agent.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
          >
                    <X size={16} />
          </button>
                </div>
                      ))}
                    </div>
                  </div>

        {/* Available Agents */}
        <div className="p-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-500 mb-3">Available Advisors</h4>
          <div className="space-y-2">
            {agents
              .filter(agent => !activeAgents.includes(agent.id) && !agent.hidden)
              .map((agent) => (
              <button
                  key={agent.id}
                  onClick={() => onToggleAgent(agent.id)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <img
                    src={agent.avatar}
                    alt={agent.name}
                    className="w-8 h-8 rounded-full object-cover"
                    onError={(e) => {
                      console.error('Agent avatar failed to load:', agent.avatar);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900">{agent.name}</p>
                    <p className="text-xs text-gray-500">{agent.role}</p>
                  </div>
                  <Plus size={16} className="text-gray-400" />
              </button>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Rabbit Page Component
export default function RabbitPage() {
  const { data: session } = useSession();
  
  // Session data is available for avatar fallback
  const [currentView, setCurrentView] = useState<'grid' | 'conversation'>('grid');
  const [agents, setAgents] = useState(AGENTS);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [currentThread, setCurrentThread] = useState<Thread | null>(null);

  // Enhanced auto-join agents using smart matching
  const autoJoinAgents = (query: string) => {
    return getAutoJoinAgents(query, 5); // Get top 5 most relevant agents
  };

  const handleStartConversation = (query: string) => {
    const autoJoined = autoJoinAgents(query);
    setActiveAgents(autoJoined);
    
    const newThread: Thread = {
      id: Date.now().toString(),
      title: query.length > 50 ? query.substring(0, 50) + '...' : query,
      messages: [
        {
          id: '1',
          type: 'user',
          content: query,
          user: {
            id: (session?.user as any)?.id || 'unknown',
            name: (session?.user as any)?.name || (session?.user as any)?.username || 'User',
            username: (session?.user as any)?.username || 'user',
            avatar: (session?.user as any)?.profilePhoto || (session?.user as any)?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent((session?.user as any)?.name || (session?.user as any)?.username || 'User')}&background=FF6A00&color=fff&size=40`
          },
          timestamp: new Date()
        }
      ],
      activeAgents: autoJoined,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setCurrentThread(newThread);
    setCurrentView('conversation');
    
    // Start streaming assistant reply
    streamAssistantReply(query);
  };

  // Handle direct agent click - show only that agent as active
  const handleAgentClick = (agent: any) => {
    const singleAgent = [agent.id];
    setActiveAgents(singleAgent);
    
    const newThread: Thread = {
      id: Date.now().toString(),
      title: `Chat with ${agent.name} about ${agent.role}`,
      messages: [
        {
          id: '1',
          type: 'user',
          content: `Chat with ${agent.name} about ${agent.role}`,
          user: {
            id: (session?.user as any)?.id || 'unknown',
            name: (session?.user as any)?.name || (session?.user as any)?.username || 'User',
            username: (session?.user as any)?.username || 'user',
            avatar: (session?.user as any)?.profilePhoto || (session?.user as any)?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent((session?.user as any)?.name || (session?.user as any)?.username || 'User')}&background=FF6A00&color=fff&size=40`
          },
          timestamp: new Date()
        }
      ],
      activeAgents: singleAgent,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setCurrentThread(newThread);
    setCurrentView('conversation');
    
    // Start streaming assistant reply
    streamAssistantReply(`Chat with ${agent.name} about ${agent.role}`);
  };

  async function streamAssistantReply(userMsg: string) {
    try {
      const thread = currentThread;
      if (!thread) return;
      
      // Get responses from ALL active agents, not just the first one
      const agentsToRespond = activeAgents.length > 0 
        ? activeAgents.map(id => getAgentById(id)).filter(Boolean)
        : [getAgentById('brzezinski')]; // Default to Brzezinski for geopolitics
      
      if (agentsToRespond.length === 0) {
        console.warn('[Rabbit] No agents found to respond');
        return;
      }

      // Get responses from each active agent
      for (const respondingAgent of agentsToRespond) {
        if (!respondingAgent) continue;
        
        await getAgentResponse(respondingAgent, userMsg, thread);
      }
    } catch (e) {
      // Soft-fail with better error handling
      console.warn('[Rabbit] streamAssistantReply error', e);
      
      // Add error message to the thread if we have a current thread
      if (currentThread) {
        const respondingAgent = activeAgents.length > 0 
          ? getAgentById(activeAgents[0]) 
          : getAgentById('brzezinski');
        
        if (respondingAgent) {
          setCurrentThread(prev => {
            if (!prev) return prev;
            const msgs = prev.messages.slice();
            // Find the last agent message to update it with error
            const lastAgentMsg = msgs.reverse().find(m => m.type === 'agent');
            if (lastAgentMsg) {
              const idx = msgs.findIndex(m => m.id === lastAgentMsg.id);
              if (idx >= 0) {
                msgs[idx] = { ...msgs[idx], content: `I'm ${respondingAgent.name}. I'm experiencing technical difficulties. Please try again.` } as any;
              }
            }
            return { ...prev, messages: msgs, updatedAt: new Date() };
          });
        }
      }
    }
  }

  // Helper function to get response from a single agent
  async function getAgentResponse(respondingAgent: any, userMsg: string, thread: Thread) {
    try {
      // Get information about other active agents for context
      const otherActiveAgents = activeAgents
        .filter(id => id !== respondingAgent.id)
        .map(id => getAgentById(id))
        .filter(Boolean);
      
      const otherAgentsContext = otherActiveAgents.length > 0 
        ? `\n\nIMPORTANT: You are currently in a conversation with these other experts: ${otherActiveAgents.map(agent => agent ? `${agent.name} (${agent.role})` : '').filter(Boolean).join(', ')}. You can reference their expertise, build on their ideas, or respectfully disagree with their perspectives. This is a collaborative discussion.`
        : '';

      const payload = {
        provider: 'deepseek',
        model: 'deepseek-chat',
        temperature: 0.3,
        max_tokens: 512,
        messages: [
          // System message to set the agent's personality with awareness of other agents
          { 
            role: 'system', 
            content: `You are ${respondingAgent.name}, an expert in ${respondingAgent.role}. Respond in character as this historical figure, drawing from their expertise and perspective. Keep responses concise and engaging.${otherAgentsContext}` 
          },
          ...thread.messages.map(m => ({ role: m.type === 'user' ? 'user' : 'assistant', content: m.content })),
          { role: 'user', content: userMsg }
        ]
      };

      console.log('[Rabbit] Calling DeepSeek API with payload:', payload);
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log('[Rabbit] API response status:', resp.status, 'ok:', resp.ok);
      if (!resp.ok || !resp.body) {
        console.warn('[Rabbit] API call failed:', resp.status, resp.statusText);
        
        // Add a fallback response when API fails
        const fallbackResponse = `I'm ${respondingAgent.name}. I'm experiencing technical difficulties. Please try again.`;
        
        // Add the fallback response to the thread
        setCurrentThread(prev => {
          if (!prev) return prev;
          const msgs = prev.messages.slice();
          const idx = msgs.findIndex(m => m.id === agentMsgId);
          if (idx >= 0) {
            msgs[idx] = { ...msgs[idx], content: fallbackResponse } as any;
          }
          return { ...prev, messages: msgs, updatedAt: new Date() };
        });
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      // Insert placeholder agent message with correct agent data
      const agentMsgId = `a-${Date.now()}-${respondingAgent.id}`;
      setCurrentThread(prev => prev ? {
        ...prev,
        messages: [...prev.messages, { 
          id: agentMsgId, 
          type: 'agent', 
          content: '', 
          timestamp: new Date(), 
          agent: { 
            id: respondingAgent.id, 
            name: respondingAgent.name, 
            role: respondingAgent.role, 
            avatar: respondingAgent.avatar 
          } 
        }],
        updatedAt: new Date()
      } : prev);

      const pushToken = (tok: string) => {
        setCurrentThread(prev => {
          if (!prev) return prev;
          const msgs = prev.messages.slice();
          const idx = msgs.findIndex(m => m.id === agentMsgId);
          if (idx >= 0) {
            msgs[idx] = { ...msgs[idx], content: msgs[idx].content + tok } as any;
          }
          return { ...prev, messages: msgs, updatedAt: new Date() };
        });
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split(/\n\n/);
        buf = lines.pop() || '';
        for (const block of lines) {
          const line = block.trim();
          if (!line) continue;
          if (line.startsWith('data:')) {
            const payload = line.slice(5).trim();
            console.log('[Rabbit] Received data payload:', payload);
            if (payload === '[DONE]') continue;
            try {
              const j = JSON.parse(payload);
              console.log('[Rabbit] Parsed JSON:', j);
              if (j.type === 'token' && j.token) {
                console.log('[Rabbit] Pushing token:', j.token);
                pushToken(j.token);
              } else if (j.type === 'error') {
                console.error('[Rabbit] API Error:', j.error);
                // Update the agent message with error content
                setCurrentThread(prev => {
                  if (!prev) return prev;
                  const msgs = prev.messages.slice();
                  const idx = msgs.findIndex(m => m.id === agentMsgId);
                  if (idx >= 0) {
                    msgs[idx] = { ...msgs[idx], content: `I'm ${respondingAgent.name}. I'm experiencing technical difficulties. Please try again.` } as any;
                  }
                  return { ...prev, messages: msgs, updatedAt: new Date() };
                });
                break; // Exit the loop on error
              }
            } catch (e) { 
              console.warn('[Rabbit] Failed to parse JSON:', payload, e);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Rabbit] getAgentResponse error for', respondingAgent.name, e);
    }
  }

  const handleSendMessage = (content: string) => {
    if (!currentThread) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      user: {
        id: (session?.user as any)?.id || 'unknown',
        name: (session?.user as any)?.name || (session?.user as any)?.username || 'User',
        username: (session?.user as any)?.username || 'user',
        avatar: (session?.user as any)?.profilePhoto || (session?.user as any)?.image || `https://ui-avatars.com/api/?name=${encodeURIComponent((session?.user as any)?.name || (session?.user as any)?.username || 'User')}&background=FF6A00&color=fff&size=40`
      },
      timestamp: new Date()
    };

    setCurrentThread(prev => prev ? {
      ...prev,
      messages: [...prev.messages, newMessage],
      updatedAt: new Date()
    } : null);

    // Kick off assistant streaming reply (DeepSeek)
    streamAssistantReply(content);
  };

  const handleToggleAgent = (agentId: string) => {
    const isAdding = !activeAgents.includes(agentId);
    setActiveAgents(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
    
    // Log user interaction for learning
    if (currentThread) {
      logAgentInteraction(
        currentThread.title,
        currentThread.activeAgents,
        isAdding ? [] : [agentId],
        isAdding ? [agentId] : []
      );
    }
  };

  const handleRemoveAgent = (agentId: string) => {
    setActiveAgents(prev => prev.filter(id => id !== agentId));
    
    // Log user interaction for learning
    if (currentThread) {
      logAgentInteraction(
        currentThread.title,
        currentThread.activeAgents,
        [agentId],
        []
      );
    }
  };

  const handlePinAgent = (agentId: string) => {
    setAgents(prev => prev.map(agent => 
      agent.id === agentId 
        ? { ...agent, pinned: !agent.pinned }
        : agent
    ));
  };

  const handleHideAgent = (agentId: string) => {
    setAgents(prev => prev.map(agent => 
      agent.id === agentId 
        ? { ...agent, hidden: !agent.hidden }
        : agent
    ));
  };

  // Original Grid View (Default State)
  if (currentView === 'grid') {
  return (
    <div className="bg-white">
      {/* Generous white space and main phrase */}
      <div className="pt-24 pb-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-12">What do you want your AI agents to do?</h1>
          
            {/* Chat Starter */}
            <ChatStarter onStartConversation={handleStartConversation} />
        </div>
      </div>
      
      {/* Agent Grid - Avatar Focused */}
      <div className="px-6 pb-16">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
              {agents.map((agent) => (
              <AgentCard 
                key={agent.id} 
                agent={agent} 
                onClick={() => handleAgentClick(agent)}
              />
            ))}
          </div>
        </div>
      </div>
      </div>
    );
  }

  // Conversation View (After User Engagement)
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Unified Header - extends from left to right - STICKY */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        {/* Left side - Chat title */}
        <div className="flex-1">
          {currentThread && (
            <>
              <h2 className="text-xl font-semibold text-gray-900">
                Chat with {currentThread.title.split(' about ')[0].replace('Chat with ', '')}
              </h2>
              <p className="text-sm text-gray-500">
                {currentThread.activeAgents.length} advisors • {currentThread.messages.length} messages
              </p>
            </>
          )}
        </div>
        
        {/* Right side - Create Agent button and Settings */}
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2">
            <Plus size={16} />
            Create New Agent
          </button>
          <button className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Settings size={24} />
          </button>
        </div>
      </div>


      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Main Conversation Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {currentThread && (
            <ConversationThread 
              thread={currentThread}
              onSendMessage={handleSendMessage}
            />
          )}
        </div>

        {/* Agent Roster Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          {/* Agent List */}
          <div className="flex-1 overflow-y-auto">
            <AgentRoster
              agents={agents}
              activeAgents={activeAgents}
              onToggleAgent={handleToggleAgent}
              onRemoveAgent={handleRemoveAgent}
              onPinAgent={handlePinAgent}
              onHideAgent={handleHideAgent}
            />
          </div>
        </div>
      </div>

      {/* Fixed Chat Input Bar - Duplicated from header container structure */}
      <div className="sticky bottom-0 z-20 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
        {/* Left side - Upload button */}
        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              // TODO: Implement upload modal
              console.log('Upload clicked');
            }}
            className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            title="Upload file or share link"
          >
            <Upload size={18} />
          </button>
        </div>
        
        {/* Center - Chat input */}
        <div className="flex-1 mx-4">
          <input
            id="chat-input"
            type="text"
            placeholder="Continue the conversation..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                const message = e.currentTarget.value.trim();
                if (message) {
                  handleSendMessage(message);
                  e.currentTarget.value = '';
                }
              }
            }}
          />
        </div>
        
        {/* Right side - Send button */}
        <div className="flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              const input = document.getElementById('chat-input') as HTMLInputElement;
              const message = input?.value.trim();
              if (message) {
                handleSendMessage(message);
                input.value = '';
              }
            }}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}