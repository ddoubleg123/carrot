'use client';

import { useState, useEffect, useRef } from 'react';
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
  ChevronUp
} from 'lucide-react';

// Design Tokens
const COLORS = {
  actionOrange: '#FF6A00',
  civicBlue: '#0A5AFF', 
  ink: '#0B0B0F',
  surface: '#FFFFFF',
  slate: '#64748B',
  gray: '#6B7280'
};

// AI Agents with their expertise
const AGENTS = [
  {
    id: 'friedman',
    name: 'Milton Friedman',
    role: 'Free Market Economics',
    avatar: '/agents/Milton Friedman.png',
    expertise: ['Economics', 'Monetarism', 'Free Markets'],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'keynes',
    name: 'John Maynard Keynes',
    role: 'Keynesian Economics',
    avatar: '/agents/John Maynard Keynes.png',
    expertise: ['Macroeconomics', 'Fiscal Policy', 'Government Intervention'],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'brzezinski',
    name: 'Zbigniew Brzezinski',
    role: 'Geopolitics Expert',
    avatar: '/agents/Zbigniew Brzezinski.png',
    expertise: ['Geopolitics', 'International Relations', 'Strategy'],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'finney',
    name: 'Hal Finney',
    role: 'Cryptocurrency Pioneer',
    avatar: '/agents/Hal Finney.png',
    expertise: ['Cryptocurrency', 'Blockchain', 'Digital Security'],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'mandela',
    name: 'Nelson Mandela',
    role: 'Anti-Colonialism Leader',
    avatar: '/agents/Nelson Mandela.png',
    expertise: ['Liberation', 'Reconciliation', 'Social Justice'],
    status: 'idle',
    pinned: false,
    hidden: false
  },
  {
    id: 'socrates',
    name: 'Socrates',
    role: 'Philosophy Master',
    avatar: '/agents/Socrates.png',
    expertise: ['Philosophy', 'Ethics', 'Critical Thinking'],
    status: 'idle',
    pinned: false,
    hidden: false
  }
];

// Message types
interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
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

// Chat Starter Component
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
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Your AI Council
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Summon, feed, and collaborate with focused agents representing specific domains
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What's your obsession today?"
          className="w-full px-8 py-6 text-xl border-2 border-gray-200 rounded-2xl focus:border-orange-500 focus:outline-none transition-colors shadow-lg"
        />
        <button
          type="submit"
          className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
        >
          <Send size={24} />
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-gray-500 mb-4">Try asking about:</p>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            "Argentina's economy in the 80s",
            "Cryptocurrency regulation",
            "Climate change solutions",
            "AI ethics and governance"
          ].map((example, index) => (
            <button
              key={index}
              onClick={() => setQuery(example)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
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
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Thread Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-900">{thread.title}</h2>
        <p className="text-sm text-gray-500">
          {thread.activeAgents.length} advisors • {thread.messages.length} messages
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {thread.messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-4 ${
              message.type === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.type === 'agent' && message.agent && (
              <div className="flex-shrink-0">
                <img
                  src={message.agent.avatar}
                  alt={message.agent.name}
                  className="w-10 h-10 rounded-full object-cover"
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
              {message.type === 'agent' && message.agent && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm">{message.agent.name}</span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    {message.agent.role}
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
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSend} className="flex gap-3">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Continue the conversation..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
          >
            <Send size={20} />
          </button>
        </form>
      </div>
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
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Your Council</h3>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

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

      {/* Create New Agent */}
      <div className="p-4 border-b border-gray-200">
        <button className="w-full p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-colors flex items-center justify-center gap-2">
          <Plus size={20} />
          <span className="font-medium text-gray-700">Create New Agent</span>
        </button>
      </div>

      {/* Active Agents */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
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

// Feed the Agent Modal
function FeedAgentModal({ 
  isOpen, 
  onClose, 
  agent 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  agent: typeof AGENTS[0] | null;
}) {
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [label, setLabel] = useState('');

  if (!isOpen || !agent) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-6">
          <img
            src={agent.avatar}
            alt={agent.name}
            className="w-12 h-12 rounded-full object-cover"
          />
          <div>
            <h3 className="font-semibold text-gray-900">Feed {agent.name}</h3>
            <p className="text-sm text-gray-500">Add knowledge to this agent</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL or Document
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note or Context (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add context about this source..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Label (optional)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., 'X says this' vs 'Y counters with this'"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              console.log('Feeding agent:', { agent: agent.name, url, note, label });
              onClose();
            }}
            className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Feed Agent
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Rabbit Page Component
export default function RabbitPage() {
  const [currentView, setCurrentView] = useState<'starter' | 'conversation'>('starter');
  const [agents, setAgents] = useState(AGENTS);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [currentThread, setCurrentThread] = useState<Thread | null>(null);
  const [showFeedModal, setShowFeedModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<typeof AGENTS[0] | null>(null);

  // Auto-join agents based on query
  const autoJoinAgents = (query: string) => {
    const queryLower = query.toLowerCase();
    const relevantAgents = agents.filter(agent => 
      agent.expertise.some(skill => 
        skill.toLowerCase().includes(queryLower) || 
        queryLower.includes(skill.toLowerCase())
      )
    );
    return relevantAgents.map(agent => agent.id);
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
          timestamp: new Date()
        }
      ],
      activeAgents: autoJoined,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setCurrentThread(newThread);
    setCurrentView('conversation');
  };

  const handleSendMessage = (content: string) => {
    if (!currentThread) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    };

    setCurrentThread(prev => prev ? {
      ...prev,
      messages: [...prev.messages, newMessage],
      updatedAt: new Date()
    } : null);
  };

  const handleToggleAgent = (agentId: string) => {
    setActiveAgents(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  const handleRemoveAgent = (agentId: string) => {
    setActiveAgents(prev => prev.filter(id => id !== agentId));
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

  const handleFeedAgent = (agent: typeof AGENTS[0]) => {
    setSelectedAgent(agent);
    setShowFeedModal(true);
  };

  if (currentView === 'starter') {
    return (
      <div className="min-h-screen bg-gray-50">
        <ChatStarter onStartConversation={handleStartConversation} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
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
      <AgentRoster
        agents={agents}
        activeAgents={activeAgents}
        onToggleAgent={handleToggleAgent}
        onRemoveAgent={handleRemoveAgent}
        onPinAgent={handlePinAgent}
        onHideAgent={handleHideAgent}
      />

      {/* Feed Agent Modal */}
      <FeedAgentModal
        isOpen={showFeedModal}
        onClose={() => setShowFeedModal(false)}
        agent={selectedAgent}
      />
    </div>
  );
}